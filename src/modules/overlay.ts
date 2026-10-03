import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
	getPref,
	getPrefGlobalName,
	initialiseDefaultPref,
} from "../utils/prefs";
import { EmbeddedAnnotationIndexer } from "./embeddedIndexer";
import {
	AnnotationMetricsService,
	displayNumericSortValue,
	numericSortValue,
} from "./metrics";

const HIDE_ZERO_COUNTS_PREF = "hide-zero-counts";

type ColumnRegistration = string | false | undefined;
type ItemsViewLike = {
	refreshAndMaintainSelection?: () => unknown;
	tree?: { invalidate?: () => void };
};

export default class AnnotationCountOverlay {
	private readonly win: Window;
	private readonly metrics = new AnnotationMetricsService();
	private readonly indexer = new EmbeddedAnnotationIndexer();
	private columnIDs: ColumnRegistration[] = [];
	private preferenceObservers: symbol[] = [];
	private itemObserver?: string;
	private toolsMenuItem?: Element;
	private refreshTimer?: number;

	constructor(win: Window) {
		this.win = win;
		initialiseDefaultPref(HIDE_ZERO_COUNTS_PREF, true);
		this.registerColumns();
		this.registerPreferences();
		this.registerPreferenceObservers();
		this.registerItemObserver();
		this.registerToolsMenuItem();
	}

	unload(): void {
		for (const id of this.columnIDs) {
			if (id) Zotero.ItemTreeManager.unregisterColumn(id);
		}
		this.columnIDs = [];
		Zotero.PreferencePanes.unregister(config.addonID);
		for (const observer of this.preferenceObservers) {
			Zotero.Prefs.unregisterObserver(observer);
		}
		if (this.itemObserver !== undefined) {
			Zotero.Notifier.unregisterObserver(this.itemObserver);
		}
		this.toolsMenuItem?.remove();
		if (this.refreshTimer !== undefined)
			this.win.clearTimeout(this.refreshTimer);
	}

	private registerColumns(): void {
		this.columnIDs = [
			this.registerCountColumn(
				"marks",
				"marks-column-name",
				(item) => this.metrics.get(item).marks,
			),
			this.registerCountColumn(
				"comments",
				"comments-column-name",
				(item) => this.metrics.get(item).comments,
			),
			this.registerDateColumn(),
			this.registerCountColumn(
				"readcube-records",
				"readcube-records-column-name",
				(item) => this.metrics.get(item).readCubeRecords,
				(item) => item.isRegularItem(),
			),
		];
	}

	private registerCountColumn(
		key: string,
		labelKey: string,
		getValue: (item: Zotero.Item) => number,
		isApplicable: (item: Zotero.Item) => boolean = (item) =>
			this.metrics.get(item).applicable,
	): ColumnRegistration {
		return Zotero.ItemTreeManager.registerColumn({
			dataKey: this.dataKey(key),
			label: getString(labelKey),
			pluginID: config.addonID,
			minWidth: 48,
			staticWidth: false,
			sortReverse: true,
			dataProvider: (item: Zotero.Item) => {
				if (!isApplicable(item)) return "";
				return numericSortValue(getValue(item));
			},
			renderCell: (
				_index: number,
				data: string,
				column: { className: string },
			) =>
				this.renderCell(
					column.className,
					this.hideZero(data) ? "" : displayNumericSortValue(data),
					"center",
				),
			zoteroPersist: ["width", "hidden", "sortDirection"],
		});
	}

	private registerDateColumn(): ColumnRegistration {
		return Zotero.ItemTreeManager.registerColumn({
			dataKey: this.dataKey("last-annotated"),
			label: getString("last-annotated-column-name"),
			pluginID: config.addonID,
			minWidth: 92,
			staticWidth: false,
			sortReverse: true,
			dataProvider: (item: Zotero.Item) =>
				this.metrics.get(item).lastAnnotated,
			renderCell: (
				_index: number,
				data: string,
				column: { className: string },
			) => this.renderCell(column.className, data.slice(0, 10), "start"),
			zoteroPersist: ["width", "hidden", "sortDirection"],
		});
	}

	private renderCell(
		className: string,
		text: string,
		justifyContent: "center" | "start",
	): HTMLElement {
		const cell = this.win.document.createElementNS(
			"http://www.w3.org/1999/xhtml",
			"span",
		);
		cell.className = `cell ${className}`;
		cell.style.display = "flex";
		cell.style.justifyContent = justifyContent;
		cell.textContent = text;
		return cell;
	}

	private hideZero(data: string): boolean {
		return Boolean(getPref(HIDE_ZERO_COUNTS_PREF)) && /^0+$/.test(data);
	}

	private dataKey(key: string): string {
		return `${config.addonID.replace(/[^a-z0-9]/gi, "_")}_${key}`;
	}

	private registerPreferences(): void {
		void Zotero.PreferencePanes.register({
			pluginID: config.addonID,
			src: rootURI + "chrome/content/preferences.xhtml",
			label: getString("pref-title"),
			image: `chrome://${config.addonRef}/content/icons/favicon.png`,
			defaultXUL: true,
		});
	}

	private registerPreferenceObservers(): void {
		this.preferenceObservers = [
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(HIDE_ZERO_COUNTS_PREF),
				() => this.scheduleRefresh(),
				true,
			),
		];
	}

	private registerItemObserver(): void {
		this.itemObserver = Zotero.Notifier.registerObserver(
			{
				notify: (event: string, type: string) => {
					if (
						type === "item" &&
						["add", "modify", "delete", "trash"].includes(event)
					) {
						this.metrics.clear();
						this.scheduleRefresh();
					}
				},
			},
			["item"],
			config.addonID,
		);
	}

	private registerToolsMenuItem(): void {
		const doc = this.win.document;
		const toolsPopup = doc.getElementById("menu_ToolsPopup");
		if (!toolsPopup) return;

		const menuItem = (
			doc as Document & {
				createXULElement(name: string): Element;
			}
		).createXULElement("menuitem");
		menuItem.id = `${config.addonRef}-index-embedded`;
		menuItem.setAttribute("label", getString("menu-index-embedded"));
		menuItem.addEventListener(
			"command",
			() => void this.runIndexing(menuItem),
		);
		toolsPopup.append(menuItem);
		this.toolsMenuItem = menuItem;
	}

	private async runIndexing(menuItem: Element): Promise<void> {
		if (this.indexer.isRunning) return;
		if (
			!this.win.confirm(
				`${getString("index-confirm-title")}\n\n${getString("index-confirm-message")}`,
			)
		) {
			return;
		}

		menuItem.setAttribute("disabled", "true");
		menuItem.setAttribute("label", getString("menu-index-running"));
		try {
			const summary = await this.indexer.indexUserLibrary(
				(processed, total) => {
					if (processed === total || processed % 25 === 0) {
						menuItem.setAttribute(
							"label",
							`${getString("menu-index-running")} ${processed}/${total}`,
						);
					}
				},
			);
			this.metrics.clear();
			this.scheduleRefresh();
			const details = [
				`PDFs checked: ${summary.processed}/${summary.total}`,
				`PDFs whose Zotero annotation index changed: ${summary.changed}`,
				`Missing files: ${summary.missing}`,
				`Errors: ${summary.errors.length}`,
			].join("\n");
			this.win.alert(
				`${getString("index-complete-title")}\n\n${details}`,
			);
			if (summary.errors.length) {
				Zotero.logError(
					new Error(
						`Annotation Count indexing errors: ${JSON.stringify(summary.errors)}`,
					),
				);
			}
		} catch (error) {
			const normalizedError =
				error instanceof Error ? error : new Error(String(error));
			Zotero.logError(normalizedError);
			this.win.alert(
				`Annotation indexing failed:\n\n${normalizedError.message}`,
			);
		} finally {
			menuItem.removeAttribute("disabled");
			menuItem.setAttribute("label", getString("menu-index-embedded"));
		}
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer !== undefined)
			this.win.clearTimeout(this.refreshTimer);
		this.refreshTimer = this.win.setTimeout(() => {
			this.refreshTimer = undefined;
			const itemsView = (ZoteroPane as { itemsView?: ItemsViewLike })
				.itemsView;
			if (typeof itemsView?.refreshAndMaintainSelection === "function") {
				void itemsView.refreshAndMaintainSelection();
			} else {
				itemsView?.tree?.invalidate?.();
			}
		}, 250);
	}
}

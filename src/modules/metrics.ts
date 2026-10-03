export interface AnnotationMetrics {
	applicable: boolean;
	marks: number;
	comments: number;
	lastAnnotated: string;
	readCubeRecords: number;
}

const READCUBE_TAG = "readcube-annotations";

export class AnnotationMetricsService {
	private cache = new Map<number, AnnotationMetrics>();

	clear(): void {
		this.cache.clear();
	}

	get(item: Zotero.Item): AnnotationMetrics {
		const cached = this.cache.get(item.id);
		if (cached) return cached;
		const metrics = this.calculate(item);
		this.cache.set(item.id, metrics);
		return metrics;
	}

	private calculate(item: Zotero.Item): AnnotationMetrics {
		const attachments = this.getAttachments(item);
		if (!item.isRegularItem() && attachments.length === 0) {
			return {
				applicable: false,
				marks: 0,
				comments: 0,
				lastAnnotated: "",
				readCubeRecords: 0,
			};
		}

		let marks = 0;
		let comments = 0;
		let lastAnnotated = "";
		for (const attachment of attachments) {
			for (const annotation of attachment.getAnnotations()) {
				marks++;
				if (hasWrittenComment(annotation.annotationComment)) comments++;
				// Zotero assigns the indexing time to imported external annotations,
				// not necessarily the time the mark was made in the PDF. Only native
				// Zotero annotations have a trustworthy modification date here.
				if (
					!annotation.annotationIsExternal &&
					annotation.dateModified > lastAnnotated
				) {
					lastAnnotated = annotation.dateModified;
				}
			}
		}

		return {
			applicable: true,
			marks,
			comments,
			lastAnnotated,
			readCubeRecords: item.isRegularItem()
				? this.countReadCubeRecords(item)
				: 0,
		};
	}

	private getAttachments(item: Zotero.Item): Zotero.Item[] {
		if (item.isFileAttachment()) return [item];
		if (!item.isRegularItem()) return [];
		return Zotero.Items.get(item.getAttachments()).filter(
			(attachment): attachment is Zotero.Item =>
				Boolean(attachment?.isFileAttachment()),
		);
	}

	private countReadCubeRecords(item: Zotero.Item): number {
		let count = 0;
		for (const note of Zotero.Items.get(item.getNotes())) {
			if (!note?.isNote() || !note.hasTag(READCUBE_TAG)) continue;
			count += countReadCubeHeadings(note.getNote());
		}
		return count;
	}
}

export function hasWrittenComment(
	comment: string | false | undefined,
): boolean {
	if (!comment) return false;
	return (
		comment
			.replace(/<[^>]*>/g, "")
			.replace(/&nbsp;/gi, " ")
			.trim().length > 0
	);
}

export function countReadCubeHeadings(noteHTML: string): number {
	return noteHTML.match(/<h2(?:\s[^>]*)?>[\s\S]*?<\/h2>/gi)?.length ?? 0;
}

export function numericSortValue(value: number): string {
	return Math.max(0, value).toString().padStart(12, "0");
}

export function displayNumericSortValue(value: string): string {
	if (!value) return "";
	return String(Number.parseInt(value, 10));
}

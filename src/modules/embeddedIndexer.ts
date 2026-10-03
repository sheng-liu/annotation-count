export interface IndexingError {
	itemID: number;
	itemKey: string;
	path: string;
	message: string;
}

export interface IndexingSummary {
	total: number;
	processed: number;
	changed: number;
	missing: number;
	errors: IndexingError[];
	startedAt: string;
	finishedAt: string;
}

type ZoteroPDFWorker = {
	import(
		itemID: number,
		isPriority?: boolean,
		password?: string,
		transfer?: boolean,
	): Promise<boolean>;
};

/**
 * Builds Zotero's local, read-only representation of annotations embedded in
 * PDF files. `transfer=false` is essential: Zotero leaves the annotations in
 * the PDF and records them as external annotations in its database.
 */
export class EmbeddedAnnotationIndexer {
	private running = false;

	get isRunning(): boolean {
		return this.running;
	}

	async indexUserLibrary(
		onProgress?: (processed: number, total: number) => void,
	): Promise<IndexingSummary> {
		if (this.running)
			throw new Error("Annotation indexing is already running");
		this.running = true;
		const startedAt = new Date().toISOString();
		const errors: IndexingError[] = [];
		let changed = 0;
		let missing = 0;
		let processed = 0;

		try {
			const ids = (await Zotero.DB.columnQueryAsync(
				`SELECT ia.itemID
				 FROM itemAttachments ia
				 JOIN items i ON i.itemID = ia.itemID
				 LEFT JOIN deletedItems d ON d.itemID = ia.itemID
				 WHERE i.libraryID = ?
				   AND d.itemID IS NULL
				   AND ia.contentType = 'application/pdf'
				 ORDER BY ia.itemID`,
				[Zotero.Libraries.userLibraryID],
			)) as unknown as number[];

			const pdfWorker = Zotero.PDFWorker as unknown as ZoteroPDFWorker;
			for (const id of ids) {
				const attachment = await Zotero.Items.getAsync(id);
				const path = (await attachment?.getFilePathAsync()) || "";
				try {
					if (!attachment || !path) {
						missing++;
						continue;
					}
					// Do not transfer: the PDF remains the source of truth.
					if (await pdfWorker.import(id, false, undefined, false))
						changed++;
				} catch (error) {
					errors.push({
						itemID: id,
						itemKey: attachment?.key || "",
						path,
						message:
							error instanceof Error
								? error.message
								: String(error),
					});
				} finally {
					processed++;
					onProgress?.(processed, ids.length);
				}
			}

			return {
				total: ids.length,
				processed,
				changed,
				missing,
				errors,
				startedAt,
				finishedAt: new Date().toISOString(),
			};
		} finally {
			this.running = false;
		}
	}
}

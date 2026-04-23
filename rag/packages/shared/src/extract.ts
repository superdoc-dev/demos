import { createSuperDocClient } from "@superdoc-dev/sdk";

export type TableContext = {
	/**
	 * Grouping key for the containing table. Stable within one extract() call;
	 * combine with documentId for cross-run stability. Not a persistent identity
	 * (the underlying ECMA-376 spec doesn't expose one for w:tbl).
	 */
	tableOrdinal: number;
	/** Zero-based row index within the table. */
	rowIndex: number;
	/** Zero-based logical grid column. Merged cells report their anchor column. */
	columnIndex: number;
	/** Number of rows the cell spans. 1 for unmerged cells. */
	rowspan: number;
	/** Number of columns the cell spans. 1 for unmerged cells. */
	colspan: number;
};

export type ExtractedBlock = {
	id: string;
	nodeType: string;
	text: string;
	/** 1-6 for headings; undefined otherwise. */
	headingLevel?: number;
	/** Populated when this block lives inside a table cell. Omitted otherwise. */
	tableContext?: TableContext;
};

export type ExtractedComment = {
	id: string;
	text: string;
	anchoredText?: string;
	creatorName?: string;
	status: string;
	blockId?: string;
};

export type ExtractedTrackChange = {
	id: string;
	type: "insert" | "delete" | "format";
	author?: string;
	excerpt?: string;
	blockId?: string;
};

export type ExtractionResult = {
	blocks: ExtractedBlock[];
	comments: ExtractedComment[];
	trackChanges: ExtractedTrackChange[];
};

/**
 * Extract structured content from a .docx using SuperDoc SDK.
 * Returns paragraphs/headings with nodeIds, comments, and tracked changes.
 * All IDs are stable and work with superdoc.scrollToElement() in the browser.
 */
export async function extractDocument(
	filePath: string,
): Promise<ExtractionResult> {
	const client = createSuperDocClient();
	await client.connect();

	try {
		const doc = await client.open({ doc: filePath });
		const result = await doc.extract();

		// Empty cells inside tables are kept here so chunk.ts can decide what to
		// do with them (sparse rows often want the empty slot preserved). Only
		// drop blocks that have no nodeId at all - those are unaddressable.
		const blocks: ExtractedBlock[] = result.blocks
			.filter((b: any) => b.nodeId)
			.map((b: any) => {
				const extracted: ExtractedBlock = {
					id: b.nodeId,
					nodeType: b.type,
					text: b.text,
				};
				if (typeof b.headingLevel === "number")
					extracted.headingLevel = b.headingLevel;
				if (b.tableContext) {
					extracted.tableContext = {
						tableOrdinal: b.tableContext.tableOrdinal,
						rowIndex: b.tableContext.rowIndex,
						columnIndex: b.tableContext.columnIndex,
						rowspan: b.tableContext.rowspan ?? 1,
						colspan: b.tableContext.colspan ?? 1,
					};
				}
				return extracted;
			});

		const comments: ExtractedComment[] = result.comments
			.filter((c: any) => c.text)
			.map((c: any) => ({
				id: c.entityId,
				text: c.text ?? "",
				anchoredText: c.anchoredText,
				creatorName: c.author,
				status: c.status,
				blockId: c.blockId,
			}));

		const trackChanges: ExtractedTrackChange[] = result.trackedChanges
			.filter((tc: any) => tc.excerpt)
			.map((tc: any) => ({
				id: tc.entityId,
				type: tc.type,
				author: tc.author,
				excerpt: tc.excerpt,
			}));

		await doc.close();
		return { blocks, comments, trackChanges };
	} finally {
		await client.dispose();
	}
}

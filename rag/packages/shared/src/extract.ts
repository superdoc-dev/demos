import { createSuperDocClient } from "@superdoc-dev/sdk";

export type ExtractedBlock = {
	id: string;
	nodeType: string;
	text: string;
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
		// doc.extract() is available in superdoc >=1.26 / SDK >=0.7
		// Cast until the published SDK types include it
		const result = await (doc as any).extract();

		const blocks: ExtractedBlock[] = result.blocks
			.filter((b: any) => b.text.trim() && b.nodeId)
			.map((b: any) => ({
				id: b.nodeId,
				nodeType: b.type,
				text: b.text,
			}));

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

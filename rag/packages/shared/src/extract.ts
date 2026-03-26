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

/** Extract text from a node's inline content */
function nodeText(node: any): string {
	// Try direct text field first
	if (node?.text) return node.text;
	if (node?.bodyText) return node.bodyText;

	// Extract from paragraph/heading inlines
	const container = node?.paragraph ?? node?.heading;
	if (!container?.inlines) return "";
	return container.inlines
		.map((inline: any) => inline?.run?.text ?? "")
		.join("");
}

/** Extract blockId from a comment/trackChange target */
function targetBlockId(item: any): string | undefined {
	return item?.target?.segments?.[0]?.blockId;
}

/**
 * Extract structured content from a .docx using SuperDoc SDK.
 * Returns paragraphs/headings with nodeIds, comments, and tracked changes.
 */
export async function extractDocument(
	filePath: string,
): Promise<ExtractionResult> {
	const client = createSuperDocClient();
	await client.connect();

	try {
		const doc = await client.open({ doc: filePath });

		const PARA_LIMIT = 2000;
		const HEADING_LIMIT = 500;

		const [parasResult, headingsResult] = await Promise.all([
			doc.find({
				type: "node",
				nodeType: "paragraph",
				includeNodes: true,
				limit: PARA_LIMIT,
			}),
			doc.find({
				type: "node",
				nodeType: "heading",
				includeNodes: true,
				limit: HEADING_LIMIT,
			}),
		]);

		if (parasResult.items.length === PARA_LIMIT) {
			console.warn(
				`[extract] Document has ${PARA_LIMIT}+ paragraphs — results may be incomplete`,
			);
		}

		const blocks: ExtractedBlock[] = [
			...headingsResult.items,
			...parasResult.items,
		]
			.map((item: any) => ({
				id: item.node?.id ?? item.address?.nodeId ?? "",
				nodeType: item.address?.nodeType ?? "paragraph",
				text: nodeText(item.node),
			}))
			.filter((b) => b.text.trim() && b.id);

		// Extract comments
		const commentsResult = await doc.comments.list();
		const comments: ExtractedComment[] = commentsResult.items
			.filter((item: any) => item.text)
			.map((item: any) => ({
				id: item.id,
				text: item.text ?? "",
				anchoredText: item.anchoredText,
				creatorName: item.creatorName,
				status: item.status,
				blockId: targetBlockId(item),
			}));

		// Extract tracked changes
		const trackChangesResult = await doc.trackChanges.list();
		const trackChanges: ExtractedTrackChange[] = trackChangesResult.items
			.filter((item: any) => item.excerpt)
			.map((item: any) => ({
				id: item.id,
				type: item.type,
				author: item.author,
				excerpt: item.excerpt,
				blockId: targetBlockId(item),
			}));

		await doc.close();
		return { blocks, comments, trackChanges };
	} finally {
		await client.dispose();
	}
}

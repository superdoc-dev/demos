import type { ExtractionResult } from "./extract.js";

export type TargetType = "block" | "comment" | "track-change";

export type Chunk = {
	blockId: string;
	targetId: string;
	targetType: TargetType;
	nodeType: string;
	content: string;
	contextType: "body" | "comment" | "tracked_change";
	metadata: Record<string, unknown>;
};

/**
 * One chunk per block node. Comments and tracked changes as separate chunks.
 *
 * Each chunk carries a `targetId` + `targetType` for precise DOM navigation:
 * - body      → targetType: "block",        targetId: nodeId        → [data-block-id="X"]
 * - comment   → targetType: "comment",      targetId: commentId     → [data-comment-ids*="X"]
 * - tracked   → targetType: "track-change", targetId: trackChangeId → [data-track-change-id="X"]
 */
export function buildChunks(extraction: ExtractionResult): Chunk[] {
	const chunks: Chunk[] = [];

	for (const block of extraction.blocks) {
		chunks.push({
			blockId: block.id,
			targetId: block.id,
			targetType: "block",
			nodeType: block.nodeType,
			content: block.text,
			contextType: "body",
			metadata: {},
		});
	}

	for (const comment of extraction.comments) {
		if (!comment.text) continue;
		const blockId = comment.blockId ?? "unknown";
		const content = comment.anchoredText
			? `[Comment by ${comment.creatorName ?? "Unknown"}]: ${comment.text} (on: "${comment.anchoredText}")`
			: `[Comment by ${comment.creatorName ?? "Unknown"}]: ${comment.text}`;

		chunks.push({
			blockId,
			targetId: comment.id,
			targetType: "comment",
			nodeType: "comment",
			content,
			contextType: "comment",
			metadata: {
				commentId: comment.id,
				author: comment.creatorName,
				anchoredText: comment.anchoredText,
			},
		});
	}

	for (const change of extraction.trackChanges) {
		if (!change.excerpt) continue;
		const blockId = change.blockId ?? "unknown";

		chunks.push({
			blockId,
			targetId: change.id,
			targetType: "track-change",
			nodeType: "tracked_change",
			content: `[${change.type} by ${change.author ?? "Unknown"}]: "${change.excerpt}"`,
			contextType: "tracked_change",
			metadata: {
				changeId: change.id,
				type: change.type,
				author: change.author,
			},
		});
	}

	return chunks;
}

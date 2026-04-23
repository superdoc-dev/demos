import type { ExtractedBlock, ExtractionResult } from "./extract.js";

export type TargetType = "block" | "comment" | "track-change" | "table-row";

export type Chunk = {
	blockId: string;
	targetId: string;
	targetType: TargetType;
	nodeType: string;
	content: string;
	contextType: "body" | "comment" | "tracked_change" | "table";
	metadata: Record<string, unknown>;
};

/**
 * One chunk per body block. Comments and tracked changes as separate chunks.
 * Table cells are grouped into one chunk per row so embeddings carry the row's
 * full context (e.g. "Square | 4 | 0 | 4") instead of isolated cell values
 * ("4"), which are nearly useless for semantic retrieval.
 *
 * Each chunk carries a `targetId` + `targetType` for precise DOM navigation:
 * - body       → targetType: "block",        targetId: nodeId        → [data-block-id="X"]
 * - table row  → targetType: "table-row",    targetId: firstCellId   → scroll to first cell
 * - comment    → targetType: "comment",      targetId: commentId     → [data-comment-ids*="X"]
 * - tracked    → targetType: "track-change", targetId: trackChangeId → [data-track-change-id="X"]
 */
export function buildChunks(extraction: ExtractionResult): Chunk[] {
	const chunks: Chunk[] = [];

	// Partition body blocks into (non-table blocks) + (table-row groups).
	// Row grouping key is `tableOrdinal + rowIndex` since the upstream contract
	// doesn't expose a stable cross-run table identity. tableOrdinal is unique
	// within one extract() call, which is the scope chunking runs in anyway.
	const nonTableBlocks: ExtractedBlock[] = [];
	const rowGroups = new Map<string, ExtractedBlock[]>();

	for (const block of extraction.blocks) {
		if (!block.tableContext) {
			nonTableBlocks.push(block);
			continue;
		}
		const key = `${block.tableContext.tableOrdinal}::${block.tableContext.rowIndex}`;
		const existing = rowGroups.get(key);
		if (existing) {
			existing.push(block);
		} else {
			rowGroups.set(key, [block]);
		}
	}

	for (const block of nonTableBlocks) {
		// Skip empty body paragraphs - they have no semantic content to embed.
		if (!block.text.trim()) continue;
		chunks.push({
			blockId: block.id,
			targetId: block.id,
			targetType: "block",
			nodeType: block.nodeType,
			content: block.text,
			contextType: "body",
			metadata:
				block.headingLevel !== undefined
					? { headingLevel: block.headingLevel }
					: {},
		});
	}

	for (const [key, rowBlocks] of rowGroups) {
		// Group paragraphs by their grid column. Multi-paragraph cells get joined
		// within-cell with newlines so a single cell reads as one unit, then
		// cells join across the row with " | " for left-to-right context.
		const paragraphsByColumn = new Map<number, ExtractedBlock[]>();
		for (const block of rowBlocks) {
			const col = block.tableContext?.columnIndex ?? 0;
			const arr = paragraphsByColumn.get(col) ?? [];
			arr.push(block);
			paragraphsByColumn.set(col, arr);
		}
		const sortedColumns = [...paragraphsByColumn.keys()].sort((a, b) => a - b);
		const cellTexts = sortedColumns.map((col) =>
			paragraphsByColumn
				.get(col)!
				.map((b) => b.text)
				.join("\n"),
		);
		const content = cellTexts.join(" | ");
		// Drop empty rows (every cell empty) - they carry no signal.
		if (!content.trim()) {
			void key;
			continue;
		}

		// Anchor at the first paragraph in document order so scrollToElement
		// lands at the visual top-left of the row.
		const firstBlock = rowBlocks[0];
		if (!firstBlock?.tableContext) continue;
		const { tableOrdinal, rowIndex } = firstBlock.tableContext;

		chunks.push({
			blockId: firstBlock.id,
			targetId: firstBlock.id,
			targetType: "table-row",
			nodeType: "table_row",
			content,
			contextType: "table",
			metadata: {
				tableOrdinal,
				rowIndex,
				cellIds: rowBlocks.map((b) => b.id),
				cellCoords: sortedColumns.map((col) => ({
					columnIndex: col,
					ids: paragraphsByColumn.get(col)!.map((b) => b.id),
					text: paragraphsByColumn
						.get(col)!
						.map((b) => b.text)
						.join("\n"),
				})),
			},
		});
		void key;
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

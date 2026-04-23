/**
 * End-to-end smoke test for the RAG demo's extract + chunk pipeline.
 *
 * Runs the SuperDoc SDK against every `.docx` fixture in `docs/`, feeds the
 * output through the demo's chunker, and asserts the contract each chunk
 * type depends on:
 *
 *   - Every block has a truthy nodeId (so `scrollToElement` has something
 *     to resolve).
 *   - No block is emitted with an opaque `nodeType: "table"` (the pre-fix
 *     shape flattened whole tables into one block and broke per-cell
 *     citations).
 *   - Every table-cell block carries a complete `tableContext`
 *     ({ tableOrdinal, rowIndex, columnIndex, rowspan, colspan }).
 *   - Exactly one chunk is emitted per (tableOrdinal, rowIndex) pair that
 *     has any non-empty text in it.
 *   - Documents with no tables emit zero row chunks.
 *
 * Uses whichever `@superdoc-dev/cli` is installed in the workspace. Pin to
 * a version that ships the paragraph-granular table extraction in
 * `apps/ingest/package.json` before running.
 */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildChunks, extractDocument } from "@docrag/shared";

const DOCS_DIR = resolve(import.meta.dir, "../../../docs");

type Check = { name: string; ok: boolean; detail?: string };

async function run(file: string, label: string): Promise<Check[]> {
	const checks: Check[] = [];
	console.log(`\n\n========================================`);
	console.log(`FILE: ${label}`);
	console.log(`========================================`);

	const extraction = await extractDocument(file);
	const chunks = buildChunks(extraction);

	const bodyBlocks = extraction.blocks.filter((b) => !b.tableContext);
	const cellBlocks = extraction.blocks.filter((b) => b.tableContext);
	const bodyChunks = chunks.filter((c) => c.targetType === "block");
	const rowChunks = chunks.filter((c) => c.targetType === "table-row");

	console.log(
		`Blocks: total=${extraction.blocks.length} body=${bodyBlocks.length} cell=${cellBlocks.length}`,
	);
	console.log(
		`Chunks: total=${chunks.length} body=${bodyChunks.length} row=${rowChunks.length}`,
	);

	// All blocks have a stable id.
	checks.push({
		name: "every block has a truthy id",
		ok: extraction.blocks.every((b) => typeof b.id === "string" && b.id.length > 0),
	});

	// No opaque table blocks.
	const opaqueTable = extraction.blocks.find((b) => b.nodeType === "table");
	checks.push({
		name: "no opaque type: 'table' block",
		ok: !opaqueTable,
		detail: opaqueTable ? `saw nodeType=table (id=${opaqueTable.id})` : undefined,
	});

	// If there are cell blocks, each must carry a complete tableContext.
	if (cellBlocks.length > 0) {
		const missingCtx = cellBlocks.find(
			(b) =>
				!b.tableContext ||
				typeof b.tableContext.tableOrdinal !== "number" ||
				typeof b.tableContext.rowIndex !== "number" ||
				typeof b.tableContext.columnIndex !== "number" ||
				typeof b.tableContext.rowspan !== "number" ||
				typeof b.tableContext.colspan !== "number",
		);
		checks.push({
			name: "every cell block carries { tableOrdinal, rowIndex, columnIndex, rowspan, colspan }",
			ok: !missingCtx,
			detail: missingCtx ? `first missing: ${JSON.stringify(missingCtx)}` : undefined,
		});

		// Row chunks were emitted for each distinct (tableOrdinal, rowIndex) that
		// produced any non-empty content.
		const nonEmptyRowKeys = new Set(
			cellBlocks
				.filter((b) => b.text.trim().length > 0)
				.map((b) => `${b.tableContext?.tableOrdinal}::${b.tableContext?.rowIndex}`),
		);
		checks.push({
			name: "one chunk per (table, row) with content",
			ok: rowChunks.length === nonEmptyRowKeys.size,
			detail: `expected ${nonEmptyRowKeys.size}, got ${rowChunks.length}`,
		});
	} else {
		checks.push({
			name: "no tables -> no row chunks",
			ok: rowChunks.length === 0,
		});
	}

	// Print what a row chunk looks like for RAG embedding.
	if (rowChunks.length > 0) {
		console.log("\nSample row chunks:");
		for (const c of rowChunks.slice(0, 5)) {
			console.log(
				`  [r${c.metadata.rowIndex}] ${JSON.stringify(c.content)}  ->  firstCell=${c.targetId}`,
			);
		}
	}

	// Print heading preservation.
	const headings = extraction.blocks.filter((b) => b.nodeType === "heading");
	if (headings.length > 0) {
		console.log(`\nHeadings: ${headings.length}`);
		for (const h of headings.slice(0, 3)) {
			console.log(`  L${h.headingLevel ?? "?"}: ${JSON.stringify(h.text.slice(0, 60))}`);
		}
	}

	return checks;
}

const allChecks: Array<{ label: string; checks: Check[] }> = [];

const sampleFiles = (await readdir(DOCS_DIR))
	.filter((f) => f.endsWith(".docx"))
	.sort();
for (const f of sampleFiles) {
	allChecks.push({ label: f, checks: await run(resolve(DOCS_DIR, f), f) });
}

console.log("\n\n========== RESULTS ==========");
let failed = 0;
for (const { label, checks } of allChecks) {
	console.log(`\n${label}`);
	for (const check of checks) {
		const status = check.ok ? "PASS" : "FAIL";
		if (!check.ok) failed++;
		console.log(
			`  [${status}] ${check.name}${check.detail ? ` - ${check.detail}` : ""}`,
		);
	}
}
console.log(
	`\n${failed === 0 ? "All checks passed." : `${failed} CHECK(S) FAILED.`}`,
);
process.exit(failed === 0 ? 0 : 1);

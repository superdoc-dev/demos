import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	buildChunks,
	createEmbeddingClient,
	extractDocument,
} from "@rag-demo/shared";

const API_URL = process.env.API_URL ?? "http://localhost:8787";
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
	console.error("Set OPENAI_API_KEY in .env");
	process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
	console.error("Usage: bun ingest <path-to-docx>");
	process.exit(1);
}

const absPath = resolve(filePath);
const filename = absPath.split("/").pop() ?? "unknown.docx";
console.log(`[ingest] File: ${filename}`);

const embed = createEmbeddingClient(OPENAI_KEY);

// Step 1: Extract with SuperDoc SDK
console.log("[ingest] Extracting...");
const extraction = await extractDocument(absPath);
console.log(
	`[ingest] ${extraction.blocks.length} blocks, ${extraction.comments.length} comments, ${extraction.trackChanges.length} tracked changes`,
);

// Step 2: Chunk
const chunks = buildChunks(extraction);
if (chunks.length === 0) {
	console.error("[ingest] No content found");
	process.exit(1);
}
console.log(`[ingest] ${chunks.length} chunks`);

// Step 3: Embed
console.log("[ingest] Embedding...");
const embeddings = await embed.embedBatch(chunks.map((c) => c.content));

// Step 4: Read file as base64 for R2 upload
const fileBuffer = await readFile(absPath);
const fileBase64 = Buffer.from(fileBuffer).toString("base64");

// Step 5: POST to Worker API
console.log(`[ingest] Uploading to ${API_URL}...`);
const payload = {
	filename,
	file: fileBase64,
	chunks: chunks.map((chunk, i) => ({
		id: `${Date.now()}-${i}`,
		blockId: chunk.blockId,
		targetId: chunk.targetId,
		targetType: chunk.targetType,
		nodeType: chunk.nodeType,
		content: chunk.content,
		contextType: chunk.contextType,
		metadata: JSON.stringify(chunk.metadata),
		embedding: embeddings[i],
	})),
};

const res = await fetch(`${API_URL}/api/ingest`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(payload),
});

if (!res.ok) {
	const err = await res.text();
	console.error(`[ingest] Upload failed: ${err}`);
	process.exit(1);
}

const result = await res.json();
console.log(
	`[ingest] Done! Document ID: ${(result as any).documentId}, ${chunks.length} chunks stored`,
);

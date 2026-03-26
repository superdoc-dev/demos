import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildChunks,
	createEmbeddingClient,
	extractDocument,
} from "@docrag/shared";

const PORT = Number(process.env.PORT ?? 4000);
const API_URL = process.env.API_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";

if (!OPENAI_KEY) {
	console.error("Missing OPENAI_API_KEY");
	process.exit(1);
}
if (!API_URL) {
	console.error(
		"Missing API_URL (e.g. https://docrag-api.<account>.workers.dev)",
	);
	process.exit(1);
}

const embed = createEmbeddingClient(OPENAI_KEY);

Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);

		if (url.pathname === "/health") {
			return Response.json({ status: "ok" });
		}

		if (url.pathname === "/ingest" && req.method === "POST") {
			// Verify auth token
			if (AUTH_TOKEN) {
				const token = req.headers.get("authorization")?.replace("Bearer ", "");
				if (token !== AUTH_TOKEN) {
					return Response.json({ error: "Unauthorized" }, { status: 401 });
				}
			}

			const body = (await req.json()) as {
				documentId: number;
				filename: string;
			};

			if (!body.documentId || !body.filename) {
				return Response.json(
					{ error: "documentId and filename required" },
					{ status: 400 },
				);
			}

			// Process async — return immediately so the Worker doesn't timeout
			processDocument(body.documentId, body.filename).catch((err) => {
				console.error(`[ingest] Failed for doc ${body.documentId}:`, err);
			});

			return Response.json({ status: "processing" });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	},
});

console.log(`Ingest service → http://localhost:${PORT}`);

async function processDocument(documentId: number, filename: string) {
	console.log(`[ingest] Processing: ${filename} (doc ${documentId})`);

	// Step 1: Download file from Worker API
	const fileRes = await fetch(`${API_URL}/api/documents/${documentId}/file`);
	if (!fileRes.ok) {
		throw new Error(`Failed to download file: ${fileRes.status}`);
	}

	const fileBuffer = await fileRes.arrayBuffer();
	const tempDir = await mkdtemp(join(tmpdir(), "rag-ingest-"));
	const tempPath = join(tempDir, filename);
	await writeFile(tempPath, Buffer.from(fileBuffer));

	try {
		// Step 2: Extract with SuperDoc SDK
		console.log(`[ingest] Extracting...`);
		const extraction = await extractDocument(tempPath);
		console.log(
			`[ingest] ${extraction.blocks.length} blocks, ${extraction.comments.length} comments, ${extraction.trackChanges.length} tracked changes`,
		);

		// Step 3: Chunk
		const chunks = buildChunks(extraction);
		if (chunks.length === 0) {
			console.warn(`[ingest] No content found for ${filename}`);
			return;
		}
		console.log(`[ingest] ${chunks.length} chunks`);

		// Step 4: Embed
		console.log(`[ingest] Embedding...`);
		const embeddings = await embed.embedBatch(chunks.map((c) => c.content));

		// Step 5: POST chunks + embeddings back to Worker API
		console.log(`[ingest] Uploading chunks to Worker...`);
		const payload = {
			documentId,
			chunks: chunks.map((chunk, i) => ({
				id: `${documentId}-${i}`,
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

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (AUTH_TOKEN) {
			headers.Authorization = `Bearer ${AUTH_TOKEN}`;
		}

		const uploadRes = await fetch(`${API_URL}/api/ingest/chunks`, {
			method: "POST",
			headers,
			body: JSON.stringify(payload),
		});

		if (!uploadRes.ok) {
			throw new Error(`Failed to upload chunks: ${await uploadRes.text()}`);
		}

		console.log(
			`[ingest] Done! ${chunks.length} chunks stored for ${filename}`,
		);
	} finally {
		// Cleanup temp file
		await unlink(tempPath).catch(() => {});
	}
}

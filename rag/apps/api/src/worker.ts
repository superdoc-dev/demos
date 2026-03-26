import Anthropic from "@anthropic-ai/sdk";
import { createNeonClient } from "./cf/neon";
import { createR2Client } from "./cf/r2";

interface Env {
	DOCS_BUCKET: R2Bucket;
	DATABASE_URL: string;
	OPENAI_API_KEY: string;
	ANTHROPIC_API_KEY: string;
	INGEST_SERVICE_URL?: string;
	AUTH_TOKEN?: string;
}

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: CORS_HEADERS });
}

const RAG_SYSTEM_PROMPT = `You are a document analysis assistant. Answer based ONLY on the provided document excerpts.

When citing, use [cite:TARGET_ID] with the target_id from the excerpt label.
Each excerpt has a target_id that points to the exact element (paragraph, comment, or tracked change).
If you cannot answer from the context, say so. Be concise.
Respond in plain text only. No markdown formatting.`;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		try {
			// POST /api/upload
			if (url.pathname === "/api/upload" && request.method === "POST") {
				return handleUpload(request, env);
			}

			// POST /api/ingest — CLI: file + pre-extracted chunks in one shot
			if (url.pathname === "/api/ingest" && request.method === "POST") {
				return handleIngest(request, env);
			}

			// POST /api/ingest/chunks — ingest service callback
			if (url.pathname === "/api/ingest/chunks" && request.method === "POST") {
				return handleIngestChunks(request, env);
			}

			// POST /api/query
			if (url.pathname === "/api/query" && request.method === "POST") {
				return handleQuery(request, env);
			}

			// GET /api/documents
			if (url.pathname === "/api/documents" && request.method === "GET") {
				const db = createNeonClient(env.DATABASE_URL);
				const [docs, chunkCount] = await Promise.all([
					db.listDocuments(),
					db.chunkCount(),
				]);
				const TIMEOUT_MS = 2 * 60 * 1000;
				const now = Date.now();
				for (const d of docs) {
					if (d.status === "processing") {
						const created = new Date(d.createdAt).getTime();
						if (now - created > TIMEOUT_MS) {
							await db.updateDocumentStatus(d.id, "error");
							d.status = "error";
						}
					}
				}
				return json({
					documents: docs.map((d) => ({
						id: d.id,
						filename: d.filename,
						status: d.status,
					})),
					chunkCount,
				});
			}

			// DELETE /api/documents/:id
			const deleteMatch = url.pathname.match(/^\/api\/documents\/(\d+)$/);
			if (deleteMatch && request.method === "DELETE") {
				return handleDeleteDocument(Number(deleteMatch[1]), env);
			}

			// GET /api/documents/:id/file
			const fileMatch = url.pathname.match(/^\/api\/documents\/(\d+)\/file$/);
			if (fileMatch && request.method === "GET") {
				return handleDocFile(Number(fileMatch[1]), env);
			}

			return json({ error: "Not found" }, 404);
		} catch (err) {
			console.error("Worker error:", err);
			return json({ error: "Internal server error" }, 500);
		}
	},
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
	const formData = await request.formData();
	const file = formData.get("file") as File | null;
	const fileHash = formData.get("hash") as string | null;

	if (!file?.name.endsWith(".docx")) {
		return json({ error: "Upload a .docx file" }, 400);
	}

	const db = createNeonClient(env.DATABASE_URL);
	const r2 = createR2Client(env.DOCS_BUCKET);

	if (fileHash) {
		const existing = await db.findByHash(fileHash);
		if (existing) {
			return json(
				{
					error: "duplicate",
					documentId: existing.id,
					filename: existing.filename,
				},
				409,
			);
		}
	}

	const docId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
	const r2Key = `docs/${docId}-${file.name}`;

	await r2.upload(r2Key, await file.arrayBuffer());
	await db.insertDocument(docId, file.name, r2Key, "processing", fileHash);

	if (env.INGEST_SERVICE_URL) {
		const ingestUrl = `${env.INGEST_SERVICE_URL}/ingest`;
		console.log(`[upload] Triggering ingest: ${ingestUrl}`);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (env.AUTH_TOKEN) {
			headers.Authorization = `Bearer ${env.AUTH_TOKEN}`;
		}
		try {
			const ingestRes = await fetch(ingestUrl, {
				method: "POST",
				headers,
				body: JSON.stringify({ documentId: docId, filename: file.name }),
			});
			console.log(
				`[upload] Ingest response: ${ingestRes.status} ${await ingestRes.text()}`,
			);
		} catch (err) {
			console.error(`[upload] Ingest webhook failed:`, err);
		}
	} else {
		console.warn("[upload] No INGEST_SERVICE_URL configured");
	}

	return json({
		documentId: docId,
		filename: file.name,
		status: "processing",
	});
}

async function handleIngest(request: Request, env: Env): Promise<Response> {
	const body = (await request.json()) as {
		filename: string;
		file: string;
		chunks: Array<{
			id: string;
			blockId: string;
			targetId: string;
			targetType: string;
			nodeType: string;
			content: string;
			contextType: string;
			metadata: string;
			embedding: number[];
		}>;
	};

	if (!body.filename || !body.chunks?.length) {
		return json({ error: "filename and chunks required" }, 400);
	}

	const db = createNeonClient(env.DATABASE_URL);
	const r2 = createR2Client(env.DOCS_BUCKET);

	const docId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
	const r2Key = `docs/${docId}-${body.filename}`;

	if (body.file) {
		const fileBuffer = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
		await r2.upload(r2Key, fileBuffer.buffer);
	}

	await db.insertDocument(docId, body.filename, r2Key, "ready");
	await db.insertChunks(body.chunks.map((c) => ({ ...c, documentId: docId })));

	return json({
		documentId: docId,
		filename: body.filename,
		chunks: body.chunks.length,
	});
}

async function handleIngestChunks(
	request: Request,
	env: Env,
): Promise<Response> {
	const body = (await request.json()) as {
		documentId: number;
		chunks: Array<{
			id: string;
			blockId: string;
			targetId: string;
			targetType: string;
			nodeType: string;
			content: string;
			contextType: string;
			metadata: string;
			embedding: number[];
		}>;
	};

	if (!body.documentId || !body.chunks?.length) {
		return json({ error: "documentId and chunks required" }, 400);
	}

	const db = createNeonClient(env.DATABASE_URL);

	await db.insertChunks(
		body.chunks.map((c) => ({ ...c, documentId: body.documentId })),
	);
	console.log(
		`[ingest/chunks] ${body.chunks.length} chunks inserted for doc ${body.documentId}`,
	);

	await db.updateDocumentStatus(body.documentId, "ready");

	return json({
		documentId: body.documentId,
		chunks: body.chunks.length,
	});
}

async function handleQuery(request: Request, env: Env): Promise<Response> {
	const body = (await request.json()) as { question: string };
	const question =
		typeof body?.question === "string" ? body.question.trim() : "";

	if (!question) {
		return json({ error: "Question required" }, 400);
	}

	const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			input: question,
			model: "text-embedding-3-small",
		}),
	});

	if (!embedRes.ok) {
		return json({ error: "Embedding failed" }, 500);
	}

	const embedData = (await embedRes.json()) as {
		data: Array<{ embedding: number[] }>;
	};
	const queryVector = embedData.data[0].embedding;

	const db = createNeonClient(env.DATABASE_URL);
	const chunks = await db.searchChunks(queryVector, 8);
	console.log(`[query] pgvector returned ${chunks.length} chunks`);

	if (chunks.length === 0) {
		return json({ answer: "No relevant content found.", citations: [] });
	}

	const context = chunks
		.map(
			(c) =>
				`[target_id: ${c.targetId}] (${c.contextType}, ${c.targetType}, from: ${c.filename})\n${c.content}`,
		)
		.join("\n\n---\n\n");

	const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const response = await anthropic.messages.create({
		model: "claude-sonnet-4-6",
		max_tokens: 2048,
		system: RAG_SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: `Document excerpts:\n\n${context}\n\n---\n\nQuestion: ${question}`,
			},
		],
	});

	const rawAnswer =
		response.content[0].type === "text" ? response.content[0].text : "";

	const seen = new Map<string, any>();
	const citations: any[] = [];

	for (const match of rawAnswer.matchAll(/\[cite:([^\]]+)\]/g)) {
		const targetId = match[1];
		if (seen.has(targetId)) continue;
		const chunk = chunks.find((c) => c.targetId === targetId);
		if (!chunk) continue;
		const meta = chunk.metadata ? JSON.parse(chunk.metadata) : {};
		const citation = {
			index: citations.length + 1,
			blockId: chunk.blockId,
			targetId: chunk.targetId,
			targetType: chunk.targetType,
			documentId: chunk.documentId,
			filename: chunk.filename,
			snippet: chunk.content.slice(0, 120),
			contextType: chunk.contextType,
			anchoredText: meta.anchoredText,
		};
		seen.set(targetId, citation);
		citations.push(citation);
	}

	const answer = rawAnswer.replace(/\[cite:([^\]]+)\]/g, (_, targetId) => {
		const c = seen.get(targetId);
		return c ? `[${c.index}]` : "";
	});

	return json({ answer, citations });
}

async function handleDeleteDocument(id: number, env: Env): Promise<Response> {
	const db = createNeonClient(env.DATABASE_URL);
	const r2 = createR2Client(env.DOCS_BUCKET);

	const doc = await db.getDocument(id);
	if (!doc) return json({ error: "Not found" }, 404);

	// Delete document + chunks (cascades) from Neon
	await db.deleteDocument(id);

	// Delete file from R2
	await r2.delete(doc.r2Key);

	return json({ deleted: true, id });
}

async function handleDocFile(id: number, env: Env): Promise<Response> {
	const db = createNeonClient(env.DATABASE_URL);
	const doc = await db.getDocument(id);
	if (!doc) return json({ error: "Not found" }, 404);

	const r2 = createR2Client(env.DOCS_BUCKET);
	const file = await r2.download(doc.r2Key);
	if (!file) return json({ error: "File not found" }, 404);

	const safeFilename = doc.filename.replace(/"/g, "");
	return new Response(file.body, {
		headers: {
			...CORS_HEADERS,
			"Content-Type":
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": `inline; filename="${safeFilename}"`,
		},
	});
}

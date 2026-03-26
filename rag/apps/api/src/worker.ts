import Anthropic from "@anthropic-ai/sdk";
import { createD1Client } from "./cf/d1";
import { createR2Client } from "./cf/r2";
import { createVectorizeClient } from "./cf/vectorize";

interface Env {
	DB: D1Database;
	DOCS_BUCKET: R2Bucket;
	VECTORIZE: VectorizeIndex;
	OPENAI_API_KEY: string;
	ANTHROPIC_API_KEY: string;
	INGEST_SERVICE_URL?: string;
	AUTH_TOKEN?: string;
}

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
			// POST /api/upload — UI file upload → R2 + D1 + trigger ingest service
			if (url.pathname === "/api/upload" && request.method === "POST") {
				return handleUpload(request, env);
			}

			// POST /api/ingest — CLI: file + pre-extracted chunks in one shot
			if (url.pathname === "/api/ingest" && request.method === "POST") {
				return handleIngest(request, env);
			}

			// POST /api/ingest/chunks — ingest service pushes back processed chunks
			if (url.pathname === "/api/ingest/chunks" && request.method === "POST") {
				return handleIngestChunks(request, env);
			}

			// POST /api/query — RAG query
			if (url.pathname === "/api/query" && request.method === "POST") {
				return handleQuery(request, env);
			}

			// GET /api/documents — list documents
			if (url.pathname === "/api/documents" && request.method === "GET") {
				const d1 = createD1Client(env.DB);
				const docs = await d1.listDocuments();
				return json(
					docs.map((d) => ({
						id: d.id,
						filename: d.filename,
						status: d.status,
					})),
				);
			}

			// GET /api/documents/:id/file — serve from R2
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

/**
 * UI upload: receive .docx file, store in R2, create pending doc in D1,
 * trigger the ingest service to extract + embed.
 */
async function handleUpload(request: Request, env: Env): Promise<Response> {
	const formData = await request.formData();
	const file = formData.get("file") as File | null;
	if (!file?.name.endsWith(".docx")) {
		return json({ error: "Upload a .docx file" }, 400);
	}

	const d1 = createD1Client(env.DB);
	const r2 = createR2Client(env.DOCS_BUCKET);

	const docId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
	const r2Key = `docs/${docId}-${file.name}`;

	// Store file in R2
	await r2.upload(r2Key, await file.arrayBuffer());

	// Create pending document in D1
	await d1.insertDocument(docId, file.name, r2Key, "processing");

	// Trigger ingest service (fire-and-forget)
	if (env.INGEST_SERVICE_URL) {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (env.AUTH_TOKEN) {
			headers.Authorization = `Bearer ${env.AUTH_TOKEN}`;
		}
		fetch(`${env.INGEST_SERVICE_URL}/ingest`, {
			method: "POST",
			headers,
			body: JSON.stringify({ documentId: docId, filename: file.name }),
		}).catch((err) => console.error("Failed to trigger ingest:", err));
	}

	return json({
		documentId: docId,
		filename: file.name,
		status: "processing",
	});
}

/**
 * CLI ingest: receive file + pre-extracted chunks in one shot.
 */
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

	const d1 = createD1Client(env.DB);
	const r2 = createR2Client(env.DOCS_BUCKET);
	const vectorize = createVectorizeClient(env.VECTORIZE);

	const docId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
	const r2Key = `docs/${docId}-${body.filename}`;

	if (body.file) {
		const fileBuffer = Uint8Array.from(atob(body.file), (c) => c.charCodeAt(0));
		await r2.upload(r2Key, fileBuffer.buffer);
	}

	await d1.insertDocument(docId, body.filename, r2Key, "ready");
	await d1.insertChunks(body.chunks.map((c) => ({ ...c, documentId: docId })));
	await vectorize.insert(
		body.chunks.map((c) => ({
			id: c.id,
			values: c.embedding,
			metadata: { documentId: docId },
		})),
	);

	return json({
		documentId: docId,
		filename: body.filename,
		chunks: body.chunks.length,
	});
}

/**
 * Ingest service callback: receive processed chunks for an existing document.
 */
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

	const d1 = createD1Client(env.DB);
	const vectorize = createVectorizeClient(env.VECTORIZE);

	await d1.insertChunks(
		body.chunks.map((c) => ({ ...c, documentId: body.documentId })),
	);
	await vectorize.insert(
		body.chunks.map((c) => ({
			id: c.id,
			values: c.embedding,
			metadata: { documentId: body.documentId },
		})),
	);

	// Update document status to ready
	await d1.updateDocumentStatus(body.documentId, "ready");

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

	const vectorize = createVectorizeClient(env.VECTORIZE);
	const matches = await vectorize.search(queryVector, { limit: 8 });

	if (matches.length === 0) {
		return json({ answer: "No relevant content found.", citations: [] });
	}

	const d1 = createD1Client(env.DB);
	const chunks = await d1.getChunksByIds(matches.map((m) => m.id));

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

async function handleDocFile(id: number, env: Env): Promise<Response> {
	const d1 = createD1Client(env.DB);
	const doc = await d1.getDocument(id);
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

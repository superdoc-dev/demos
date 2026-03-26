export type Citation = {
	index: number;
	blockId: string;
	targetId: string;
	targetType: "block" | "comment" | "track-change";
	documentId: number;
	filename: string;
	snippet: string;
	contextType: string;
	anchoredText?: string;
};

export type IngestResult = {
	documentId: number;
	filename: string;
	chunks: number;
	blocks: number;
	comments: number;
	trackChanges: number;
};

export type QueryResult = { answer: string; citations: Citation[] };
export type DocumentInfo = {
	id: number;
	filename: string;
	status: string;
};

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function ingestDocument(file: File): Promise<IngestResult> {
	const fd = new FormData();
	fd.append("file", file);
	const res = await fetch(`${API_BASE}/api/upload`, {
		method: "POST",
		body: fd,
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Ingest failed (${res.status})`);
	}
	return res.json();
}

export async function queryDocuments(question: string): Promise<QueryResult> {
	const res = await fetch(`${API_BASE}/api/query`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ question }),
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Query failed (${res.status})`);
	}
	return res.json();
}

export async function deleteDocument(id: number): Promise<void> {
	const res = await fetch(`${API_BASE}/api/documents/${id}`, {
		method: "DELETE",
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Delete failed (${res.status})`);
	}
}

export type DocumentsResponse = {
	documents: DocumentInfo[];
	chunkCount: number;
};

export async function listDocuments(): Promise<DocumentsResponse> {
	const res = await fetch(`${API_BASE}/api/documents`);
	if (!res.ok) return { documents: [], chunkCount: 0 };
	return res.json();
}

export const getDocumentFileUrl = (id: number) =>
	`${API_BASE}/api/documents/${id}/file`;

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
	filePath: string;
};

export async function ingestDocument(file: File): Promise<IngestResult> {
	const fd = new FormData();
	fd.append("file", file);
	const res = await fetch("/api/upload", { method: "POST", body: fd });
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Ingest failed (${res.status})`);
	}
	return res.json();
}

export async function queryDocuments(question: string): Promise<QueryResult> {
	const res = await fetch("/api/query", {
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

export async function listDocuments(): Promise<DocumentInfo[]> {
	const res = await fetch("/api/documents");
	if (!res.ok) return [];
	return res.json();
}

export const getDocumentFileUrl = (id: number) => `/api/documents/${id}/file`;

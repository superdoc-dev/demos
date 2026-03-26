import { neon } from "@neondatabase/serverless";

export type DocumentRow = {
	id: number;
	filename: string;
	r2Key: string;
	fileHash: string | null;
	status: string;
	createdAt: string;
};

export function createNeonClient(databaseUrl: string) {
	const sql = neon(databaseUrl);

	return {
		async insertDocument(
			id: number,
			filename: string,
			r2Key: string,
			status = "ready",
			fileHash: string | null = null,
		): Promise<void> {
			await sql`INSERT INTO documents (id, filename, r2_key, status, file_hash) VALUES (${id}, ${filename}, ${r2Key}, ${status}, ${fileHash})`;
		},

		async findByHash(hash: string): Promise<DocumentRow | null> {
			const rows =
				await sql`SELECT id, filename, r2_key, file_hash, status, created_at FROM documents WHERE file_hash = ${hash} LIMIT 1`;
			if (rows.length === 0) return null;
			const r = rows[0];
			return {
				id: r.id,
				filename: r.filename,
				r2Key: r.r2_key,
				fileHash: r.file_hash,
				status: r.status,
				createdAt: r.created_at,
			};
		},

		async insertChunks(
			chunks: Array<{
				id: string;
				documentId: number;
				blockId: string;
				targetId: string;
				targetType: string;
				nodeType: string;
				content: string;
				contextType: string;
				metadata: string;
				embedding: number[];
			}>,
		): Promise<void> {
			for (const c of chunks) {
				const embeddingStr = `[${c.embedding.join(",")}]`;
				await sql`INSERT INTO chunks (id, document_id, block_id, target_id, target_type, node_type, content, context_type, metadata, embedding) VALUES (${c.id}, ${c.documentId}, ${c.blockId}, ${c.targetId}, ${c.targetType}, ${c.nodeType}, ${c.content}, ${c.contextType}, ${c.metadata}, ${embeddingStr}::vector)`;
			}
		},

		async searchChunks(
			queryEmbedding: number[],
			limit = 8,
		): Promise<
			Array<{
				id: string;
				documentId: number;
				filename: string;
				blockId: string;
				targetId: string;
				targetType: string;
				nodeType: string;
				content: string;
				contextType: string;
				metadata: string;
			}>
		> {
			const embeddingStr = `[${queryEmbedding.join(",")}]`;
			const rows = await sql`
				SELECT c.id, c.document_id, d.filename, c.block_id, c.target_id, c.target_type, c.node_type, c.content, c.context_type, c.metadata
				FROM chunks c
				JOIN documents d ON d.id = c.document_id
				ORDER BY c.embedding <=> ${embeddingStr}::vector
				LIMIT ${limit}
			`;
			return rows.map((r: any) => ({
				id: r.id,
				documentId: r.document_id,
				filename: r.filename,
				blockId: r.block_id,
				targetId: r.target_id,
				targetType: r.target_type,
				nodeType: r.node_type,
				content: r.content,
				contextType: r.context_type,
				metadata: r.metadata,
			}));
		},

		async listDocuments(): Promise<DocumentRow[]> {
			const rows =
				await sql`SELECT id, filename, r2_key, file_hash, status, created_at FROM documents ORDER BY created_at DESC`;
			return rows.map((r: any) => ({
				id: r.id,
				filename: r.filename,
				r2Key: r.r2_key,
				fileHash: r.file_hash,
				status: r.status,
				createdAt: r.created_at,
			}));
		},

		async getDocument(id: number): Promise<DocumentRow | null> {
			const rows =
				await sql`SELECT id, filename, r2_key, file_hash, status, created_at FROM documents WHERE id = ${id} LIMIT 1`;
			if (rows.length === 0) return null;
			const r = rows[0];
			return {
				id: r.id,
				filename: r.filename,
				r2Key: r.r2_key,
				fileHash: r.file_hash,
				status: r.status,
				createdAt: r.created_at,
			};
		},

		async chunkCount(): Promise<number> {
			const rows = await sql`SELECT COUNT(*) as count FROM chunks`;
			return Number(rows[0].count);
		},

		async getChunkIdsByDocument(documentId: number): Promise<string[]> {
			const rows =
				await sql`SELECT id FROM chunks WHERE document_id = ${documentId}`;
			return rows.map((r: any) => r.id);
		},

		async deleteDocument(id: number): Promise<void> {
			await sql`DELETE FROM documents WHERE id = ${id}`;
		},

		async updateDocumentStatus(id: number, status: string): Promise<void> {
			await sql`UPDATE documents SET status = ${status} WHERE id = ${id}`;
		},
	};
}

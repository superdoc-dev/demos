export type DocumentRow = {
	id: number;
	filename: string;
	r2Key: string;
	status: string;
	createdAt: string;
};

export function createD1Client(db: D1Database) {
	return {
		async insertDocument(
			id: number,
			filename: string,
			r2Key: string,
			status = "ready",
		): Promise<void> {
			await db
				.prepare(
					"INSERT INTO documents (id, filename, r2_key, status) VALUES (?, ?, ?, ?)",
				)
				.bind(id, filename, r2Key, status)
				.run();
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
			}>,
		): Promise<void> {
			const stmt = db.prepare(
				"INSERT INTO chunks (id, document_id, block_id, target_id, target_type, node_type, content, context_type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			);
			const batch = chunks.map((c) =>
				stmt.bind(
					c.id,
					c.documentId,
					c.blockId,
					c.targetId,
					c.targetType,
					c.nodeType,
					c.content,
					c.contextType,
					c.metadata,
				),
			);
			await db.batch(batch);
		},

		async getChunksByIds(ids: string[]): Promise<
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
			const placeholders = ids.map(() => "?").join(",");
			const result = await db
				.prepare(
					`SELECT c.id, c.document_id, d.filename, c.block_id, c.target_id, c.target_type, c.node_type, c.content, c.context_type, c.metadata FROM chunks c JOIN documents d ON d.id = c.document_id WHERE c.id IN (${placeholders})`,
				)
				.bind(...ids)
				.all();

			return result.results.map((r: any) => ({
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
			const result = await db
				.prepare(
					"SELECT id, filename, r2_key, status, created_at FROM documents ORDER BY created_at DESC",
				)
				.all();

			return result.results.map((r: any) => ({
				id: r.id,
				filename: r.filename,
				r2Key: r.r2_key,
				status: r.status,
				createdAt: r.created_at,
			}));
		},

		async getDocument(id: number): Promise<DocumentRow | null> {
			const result = await db
				.prepare(
					"SELECT id, filename, r2_key, status, created_at FROM documents WHERE id = ?",
				)
				.bind(id)
				.first();

			if (!result) return null;
			return {
				id: (result as any).id,
				filename: (result as any).filename,
				r2Key: (result as any).r2_key,
				status: (result as any).status,
				createdAt: (result as any).created_at,
			};
		},

		async updateDocumentStatus(id: number, status: string): Promise<void> {
			await db
				.prepare("UPDATE documents SET status = ? WHERE id = ?")
				.bind(status, id)
				.run();
		},
	};
}

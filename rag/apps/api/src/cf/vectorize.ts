export type VectorizeMatch = {
	id: string;
	score: number;
};

export function createVectorizeClient(index: VectorizeIndex) {
	return {
		async insert(
			vectors: Array<{
				id: string;
				values: number[];
				metadata?: Record<string, string | number>;
			}>,
		): Promise<void> {
			// Vectorize accepts batches of up to 1000 vectors
			const batchSize = 1000;
			for (let i = 0; i < vectors.length; i += batchSize) {
				const batch = vectors.slice(i, i + batchSize);
				await index.upsert(batch);
			}
		},

		async deleteByIds(ids: string[]): Promise<void> {
			const batchSize = 1000;
			for (let i = 0; i < ids.length; i += batchSize) {
				const batch = ids.slice(i, i + batchSize);
				await index.deleteByIds(batch);
			}
		},

		async search(
			queryVector: number[],
			options: {
				limit?: number;
				filter?: Record<string, string | number>;
			} = {},
		): Promise<VectorizeMatch[]> {
			const { limit = 8, filter } = options;

			const result = await index.query(queryVector, {
				topK: limit,
				filter,
				returnValues: false,
				returnMetadata: "none",
			});

			return result.matches.map((m) => ({
				id: m.id,
				score: m.score,
			}));
		},
	};
}

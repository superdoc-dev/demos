export interface EmbeddingClient {
	embed(text: string): Promise<number[]>;
	embedBatch(texts: string[]): Promise<number[][]>;
	readonly dimensions: number;
}

export function createEmbeddingClient(apiKey: string): EmbeddingClient {
	const model = "text-embedding-3-small";

	async function embedTexts(texts: string[]): Promise<number[][]> {
		const res = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({ input: texts, model }),
		});

		if (!res.ok) {
			throw new Error(`OpenAI embedding failed: ${await res.text()}`);
		}

		const data = (await res.json()) as {
			data: Array<{ embedding: number[]; index: number }>;
		};
		return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
	}

	return {
		async embed(text) {
			const [embedding] = await embedTexts([text]);
			return embedding;
		},

		async embedBatch(texts) {
			const results: number[][] = [];
			for (let i = 0; i < texts.length; i += 100) {
				const batch = texts.slice(i, i + 100);
				results.push(...(await embedTexts(batch)));
			}
			return results;
		},

		get dimensions() {
			return 1536;
		},
	};
}

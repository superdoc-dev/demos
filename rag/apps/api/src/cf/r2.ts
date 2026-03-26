export function createR2Client(bucket: R2Bucket) {
	return {
		async upload(
			key: string,
			data: ArrayBuffer | ReadableStream,
		): Promise<void> {
			await bucket.put(key, data);
		},

		async download(key: string): Promise<R2ObjectBody | null> {
			return bucket.get(key);
		},

		async exists(key: string): Promise<boolean> {
			const head = await bucket.head(key);
			return head !== null;
		},
	};
}

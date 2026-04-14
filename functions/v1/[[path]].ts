const BACKEND = "https://esign-demo-proxy-server-191591660773.us-central1.run.app";

export const onRequest: PagesFunction = async ({ request }) => {
	const url = new URL(request.url);
	const target = new URL(url.pathname + url.search, BACKEND);

	const headers = new Headers(request.headers);
	headers.delete("host");

	return fetch(target.toString(), {
		method: request.method,
		headers,
		body: request.body,
		redirect: "follow",
	});
};

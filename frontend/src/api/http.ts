export async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	controller?: AbortController,
	timeoutMs = 600_000_000
): Promise<Response> {
	const timedController = controller ?? new AbortController();
	const id = setTimeout(() => timedController.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

	try {
		return await fetch(url, {
			...options,
			signal: timedController.signal,
		});
	} finally {
		clearTimeout(id);
	}
}

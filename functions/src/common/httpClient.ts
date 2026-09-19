/** Thrown when an upstream HTTP call fails or times out. */
export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamHttpError";
  }
}

export interface FetchJsonOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Fetches a URL and parses the response as JSON, with a timeout and
 * consistent error handling. Uses the platform `fetch` (Node 18+).
 */
export async function fetchJson<T>(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: FetchJsonOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new UpstreamHttpError(
        `Request to ${new URL(url).origin} failed with status ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof UpstreamHttpError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamHttpError(`Request to ${new URL(url).origin} timed out after ${timeoutMs}ms`);
    }
    throw new UpstreamHttpError(
      `Request to ${new URL(url).origin} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

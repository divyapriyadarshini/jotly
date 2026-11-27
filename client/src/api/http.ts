// The one place the browser talks to the REST API. In production this comes from an
// environment variable (Phase 13).
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// Thrown for any failed request. `status` is the HTTP number (0 means we never reached
// the server) and `code` is the short word the server sends, like "forbidden".
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = { method?: string; token?: string; body?: unknown };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network', "Can't reach the server. Is it running?");
  }

  if (!response.ok) {
    let code = 'error';
    let message = `Request failed (${response.status})`;
    try {
      // The server always answers errors as { error: { code, message } }.
      const data = (await response.json()) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? code;
      message = data.error?.message ?? message;
    } catch {
      // The body was not JSON: keep the generic message.
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

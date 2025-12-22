/**
 * API Client for frontend components
 *
 * Provides typed API client functions using plain fetch.
 * Uses Eden-style API structure.
 */

type ApiResponse<T> = {
  data: T;
  error?: { message: string };
};

/**
 * Extract data from API response, throwing on error
 */
export function extractData<T>(response: ApiResponse<T>): T {
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data;
}

function buildQueryString(
  query?: Record<string, string | number | boolean | undefined>
): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Get the access token from window if available (set by auth hook)
 */
async function getAccessToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const win = window as Window & { __oauth3AccessToken?: string | null };
    return win.__oauth3AccessToken ?? null;
  }
  return null;
}

/**
 * Fetch wrapper with authentication support
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Typed API call helper
 */
export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  const json: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      (json as { error?: string })?.error ?? `Request failed: ${response.status}`
    );
  }

  return json as T;
}

/**
 * GET request helper
 */
export async function apiGet<T>(
  url: string,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const fullUrl = `${url}${buildQueryString(query)}`;
  return apiCall<T>(fullUrl);
}

/**
 * POST request helper
 */
export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiCall<T>(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return apiCall<T>(url, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(url: string): Promise<T> {
  return apiCall<T>(url, {
    method: 'DELETE',
  });
}

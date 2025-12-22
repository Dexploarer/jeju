import { treaty } from '@elysiajs/eden';

// Type for the API - will be generated from the server
// For now, using a basic type that will be replaced with actual server types
type ApiRoutes = Record<string, unknown>;

/**
 * Eden treaty client for API calls.
 * Configure with your API base URL.
 */
export const api = treaty<ApiRoutes>(
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
);

/**
 * Get the current access token from window.
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { __oauth3AccessToken?: string | null }).__oauth3AccessToken ?? null;
}

/**
 * Create headers with authorization token.
 */
export function createAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return token
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    : { 'Content-Type': 'application/json' };
}

/**
 * Fetch wrapper with authentication.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

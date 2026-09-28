/**
 * Central API Client configuration for LIFORA AI
 * Supports:
 * 1. Single service deployment on Render (relative /api routes)
 * 2. Separate frontend + backend deployment on Render (via VITE_API_URL)
 * 3. Safe response parsing to prevent unexpected HTML/DOCTYPE JSON parsing errors
 */

export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL || '';
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Fetch helper that validates JSON responses and provides clear errors
 * if an endpoint returns HTML (such as when hitting a static file fallback or bad route).
 */
export async function safeFetchJson<T = any>(
  path: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  const url = buildApiUrl(path);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        return {
          ok: res.ok,
          status: res.status,
          data,
          error: !res.ok ? (data?.error || `HTTP error ${res.status}`) : undefined,
        };
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: res.status,
          error: `Malformed JSON response from server: ${jsonErr.message}`,
        };
      }
    }

    // Response was not JSON (typically HTML <!DOCTYPE ...> from SPA fallback or web server 404/502 page)
    const text = await res.text();
    const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');

    if (isHtml) {
      return {
        ok: false,
        status: res.status,
        error: `Server returned HTML instead of JSON (${res.status} ${res.statusText}). Verify that backend API is running and API URL is correct.`,
      };
    }

    return {
      ok: false,
      status: res.status,
      error: text.trim().slice(0, 150) || `Server returned non-JSON response (${res.status})`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: `Network error connecting to API: ${err.message}`,
    };
  }
}

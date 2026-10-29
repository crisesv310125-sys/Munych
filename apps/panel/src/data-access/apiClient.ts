import type { Paginated, ProblemJson } from './apiTypes';
import { ApiError } from './errors';
import { authService } from './authService';

const getAccessToken = authService.getAccessToken;
const refreshAccessToken = authService.refreshAccessToken;

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/** A dónde mandar al usuario cuando el refresh de token falla (401 persistente). */
let onAuthExpired: (() => void) | null = null;
export function setOnAuthExpired(handler: () => void) {
  onAuthExpired = handler;
}

/**
 * Solo expira la sesión si el token rechazado sigue siendo el actual: una petición lanzada con la sesión
 * anterior (p. ej. justo antes de un login) no debe cerrar la nueva.
 */
async function notifyAuthExpired(failedToken: string | null) {
  const current = await getAccessToken();
  if (!current || current === failedToken) onAuthExpired?.();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** multipart/form-data ya construido (subida de logo, por ejemplo). */
  formData?: FormData;
  signal?: AbortSignal;
}

async function parseProblem(response: Response): Promise<ProblemJson> {
  try {
    const data = await response.json();
    return {
      type: data.type ?? 'about:blank',
      title: data.title ?? response.statusText,
      status: data.status ?? response.status,
      code: data.code ?? 'UNKNOWN',
      detail: data.detail ?? data.title ?? response.statusText,
      errors: data.errors,
    };
  } catch {
    return {
      type: 'about:blank',
      title: response.statusText,
      status: response.status,
      code: 'UNKNOWN',
      detail: response.statusText || 'No se pudo completar la solicitud.',
    };
  }
}

async function doFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!options.formData) headers['Content-Type'] = 'application/json';

  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    signal: options.signal,
  });
}

/**
 * Cliente HTTP a mano siguiendo routes.md. Verificado contra /api/v1/openapi.json del backend
 * (48 operaciones, mismos schemas). TODO: sustituir por un cliente generado con Orval.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let token = await getAccessToken();
  let response = await doFetch(path, options, token);

  if (response.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      response = await doFetch(path, options, token);
    }
    if (response.status === 401) {
      await notifyAuthExpired(token);
      const problem = await parseProblem(response);
      throw new ApiError(problem);
    }
  }

  if (!response.ok) {
    const problem = await parseProblem(response);
    throw new ApiError(problem);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Máximo que acepta `?limit=` en las rutas paginadas (routes.md, sección 1). */
const MAX_PAGE_SIZE = 200;

/** Recorre todas las páginas de una ruta `Page<T>` (`?limit=&offset=`) y devuelve los items juntos. */
export async function apiFetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes('?') ? '&' : '?';
  for (;;) {
    const page = await apiFetch<Paginated<T>>(`${path}${separator}limit=${MAX_PAGE_SIZE}&offset=${items.length}`);
    items.push(...page.items);
    if (page.items.length === 0 || items.length >= page.total) return items;
  }
}

export async function apiFetchBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  let token = await getAccessToken();
  let response = await doFetch(path, options, token);
  if (response.status === 401) {
    token = await refreshAccessToken();
    if (token) response = await doFetch(path, options, token);
    if (response.status === 401) {
      await notifyAuthExpired(token);
      throw new ApiError(await parseProblem(response));
    }
  }
  if (!response.ok) throw new ApiError(await parseProblem(response));
  return response.blob();
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

import { apiFetch } from '../apiClient';
import type { ApiSession } from '../apiTypes';

export function listSessions(committeeId: string): Promise<ApiSession[]> {
  return apiFetch<ApiSession[]>(`/committees/${committeeId}/sessions`);
}

/** Idempotente: abrir una sesión ya abierta no falla. */
export function openSession(committeeId: string, number: number): Promise<ApiSession> {
  return apiFetch<ApiSession>(`/committees/${committeeId}/sessions/${number}/open`, { method: 'POST' });
}

/** Idempotente: cerrar una sesión ya cerrada no falla. */
export function closeSession(committeeId: string, number: number): Promise<ApiSession> {
  return apiFetch<ApiSession>(`/committees/${committeeId}/sessions/${number}/close`, { method: 'POST' });
}

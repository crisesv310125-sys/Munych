import { apiFetch, apiFetchAll, apiFetchBlob } from '../apiClient';
import type { ApiEvent, CloseEventResponse, EventDraft, EventUpdate } from '../apiTypes';

export function listEvents(): Promise<ApiEvent[]> {
  return apiFetchAll<ApiEvent>('/events');
}

export function getEvent(eventId: string): Promise<ApiEvent> {
  return apiFetch<ApiEvent>(`/events/${eventId}`);
}

export function createEvent(draft: EventDraft): Promise<ApiEvent> {
  return apiFetch<ApiEvent>('/events', { method: 'POST', body: draft });
}

export function updateEvent(eventId: string, patch: EventUpdate): Promise<ApiEvent> {
  return apiFetch<ApiEvent>(`/events/${eventId}`, { method: 'PATCH', body: patch });
}

/** Solo con el evento en `draft`. */
export function deleteEvent(eventId: string): Promise<void> {
  return apiFetch<void>(`/events/${eventId}`, { method: 'DELETE' });
}

/** PNG, SVG o WebP; máx. 2 MB. */
export function uploadEventLogo(eventId: string, file: File): Promise<ApiEvent> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<ApiEvent>(`/events/${eventId}/logo`, { method: 'POST', formData });
}

/** Exige todas las sesiones cerradas (SESSIONS_STILL_OPEN) y guarda una instantánea inmutable. */
export function closeEvent(eventId: string): Promise<CloseEventResponse> {
  return apiFetch<CloseEventResponse>(`/events/${eventId}/close`, { method: 'POST' });
}

export async function exportEventFile(eventId: string, slug?: string): Promise<{ blob: Blob; filename: string }> {
  const blob = await apiFetchBlob(`/events/${eventId}/export.xlsx`);
  return { blob, filename: `resultados-${slug ?? eventId}.xlsx` };
}

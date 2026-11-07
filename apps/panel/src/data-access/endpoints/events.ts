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

/** Qué incluir en la exportación (pantalla Exportar). Por defecto el backend incluye todo. */
export interface ExportOptions {
  /** Comités a exportar; vacío o sin definir = todos los del evento. */
  committeeIds?: string[];
  includeScores?: boolean;
  /** Solo XLSX: hoja Detalle (cada calificación por sesión, juez y criterio). */
  includeDetails?: boolean;
  includeComments?: boolean;
  /** Sin nombres, el detalle muestra «Juez 1», «Juez 2»… por comité. */
  includeJudgeNames?: boolean;
}

export async function exportEventFile(
  eventId: string,
  slug?: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  options: ExportOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  options.committeeIds?.forEach((id) => params.append('committee_id', id));
  const flags: Array<[string, boolean | undefined]> = [
    ['include_scores', options.includeScores],
    ['include_details', options.includeDetails],
    ['include_comments', options.includeComments],
    ['include_judge_names', options.includeJudgeNames],
  ];
  flags.forEach(([key, value]) => value !== undefined && params.set(key, String(value)));
  const query = params.toString();
  const blob = await apiFetchBlob(`/events/${eventId}/export.${format}${query ? `?${query}` : ''}`);
  return { blob, filename: `resultados-${slug ?? eventId}.${format}` };
}

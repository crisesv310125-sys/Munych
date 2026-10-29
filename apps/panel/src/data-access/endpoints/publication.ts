import { apiFetch } from '../apiClient';
import type { PublicationSettings, PublicResultsDocument, PublishResponse, UnpublishResponse } from '../apiTypes';

export function getPublicationSettings(eventId: string): Promise<PublicationSettings> {
  return apiFetch<PublicationSettings>(`/events/${eventId}/publication-settings`);
}

export function updatePublicationSettings(
  eventId: string,
  settings: PublicationSettings,
): Promise<PublicationSettings> {
  return apiFetch<PublicationSettings>(`/events/${eventId}/publication-settings`, { method: 'PUT', body: settings });
}

export function getPublicationPreview(eventId: string): Promise<PublicResultsDocument> {
  return apiFetch<PublicResultsDocument>(`/events/${eventId}/publication/preview`);
}

export function publishEvent(eventId: string): Promise<PublishResponse> {
  return apiFetch<PublishResponse>(`/events/${eventId}/publish`, { method: 'POST' });
}

export function unpublishEvent(eventId: string): Promise<UnpublishResponse> {
  return apiFetch<UnpublishResponse>(`/events/${eventId}/unpublish`, { method: 'POST' });
}

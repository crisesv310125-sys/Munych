import { apiFetch } from '../apiClient';
import { ApiError } from '../errors';
import type { Ballot, BallotVote, GeneratedVoterToken, GenerateVoterTokensIn, ProblemJson, VoterAccess } from '../apiTypes';

// ---- Accesos de delegados (admin) ----

export function listVoterTokens(eventId: string): Promise<VoterAccess[]> {
  return apiFetch<VoterAccess[]>(`/events/${eventId}/voter-tokens`);
}

/** Los tokens solo llegan en esta respuesta: hay que descargarlos en el momento. */
export function generateVoterTokens(eventId: string, body: GenerateVoterTokensIn): Promise<GeneratedVoterToken[]> {
  return apiFetch<GeneratedVoterToken[]>(`/events/${eventId}/voter-tokens`, { method: 'POST', body });
}

export function revokeVoterTokens(eventId: string, delegateIds: string[]): Promise<{ revoked: number }> {
  return apiFetch<{ revoked: number }>(`/events/${eventId}/voter-tokens/revoke`, {
    method: 'POST',
    body: { delegate_ids: delegateIds },
  });
}

// ---- Boleta del delegado ----
// No usa apiFetch: el delegado no tiene sesión de Supabase; se autentica con su token.

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

async function ballotFetch(token: string, init: RequestInit = {}): Promise<Ballot> {
  const response = await fetch(`${BASE_URL}/vote/ballot`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    let data: Partial<ProblemJson> = {};
    try {
      data = await response.json();
    } catch {
      // cuerpo vacío o no JSON
    }
    throw new ApiError({
      type: data.type ?? 'about:blank',
      title: data.title ?? response.statusText,
      status: response.status,
      code: data.code ?? 'UNKNOWN',
      detail: data.detail ?? 'No se pudo completar la solicitud.',
    });
  }
  return (await response.json()) as Ballot;
}

export function getBallot(token: string): Promise<Ballot> {
  return ballotFetch(token);
}

/** El servidor decide en qué sesión cae el voto (la abierta); el celular no la manda. */
export function submitVotes(token: string, items: BallotVote[]): Promise<Ballot> {
  return ballotFetch(token, { method: 'PUT', body: JSON.stringify({ items }) });
}

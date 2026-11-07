import { apiFetch } from '../apiClient';
import { ApiError } from '../errors';
import type {
  Ballot,
  BallotPick,
  CommitteePeerVote,
  GeneratedVoterToken,
  GenerateVoterTokensIn,
  PeerVoteWindow,
  PeerVoteWindowIn,
  ProblemJson,
  VoterAccess,
} from '../apiTypes';

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

// ---- Voto entre pares: apertura y cierre por comité (admin) ----

export function listPeerVoteWindows(eventId: string): Promise<CommitteePeerVote[]> {
  return apiFetch<CommitteePeerVote[]>(`/events/${eventId}/peer-vote`);
}

/** Abre (o programa) el voto entre pares del comité. Sin `opens_at`: ahora mismo. */
export function openPeerVote(committeeId: string, body: PeerVoteWindowIn = {}): Promise<PeerVoteWindow> {
  return apiFetch<PeerVoteWindow>(`/committees/${committeeId}/peer-vote`, { method: 'PUT', body });
}

export function closePeerVote(committeeId: string): Promise<PeerVoteWindow> {
  return apiFetch<PeerVoteWindow>(`/committees/${committeeId}/peer-vote/close`, { method: 'POST' });
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

/** Envía el voto entre pares completo (una delegación por premio). No se puede cambiar. */
export function submitPeerVote(token: string, picks: BallotPick[]): Promise<Ballot> {
  return ballotFetch(token, { method: 'POST', body: JSON.stringify({ picks }) });
}

import { apiFetch } from '../apiClient';
import type { Award, AwardsResponse, RankingResponse } from '../apiTypes';

export function getRanking(committeeId: string): Promise<RankingResponse> {
  return apiFetch<RankingResponse>(`/committees/${committeeId}/ranking`);
}

/**
 * Desempate manual: orden de las delegaciones que siguen empatadas. Un empate se resuelve
 * solo si el orden incluye a todas sus delegaciones; lista vacía = quitar los desempates.
 */
export function setTiebreak(committeeId: string, delegationIds: string[]): Promise<RankingResponse> {
  return apiFetch<RankingResponse>(`/committees/${committeeId}/tiebreak`, {
    method: 'PUT',
    body: { delegation_ids: delegationIds },
  });
}

export function getAwards(committeeId: string): Promise<AwardsResponse> {
  return apiFetch<AwardsResponse>(`/committees/${committeeId}/awards`);
}

/** Reemplaza todos los premios del comité; superar un cupo solo añade avisos a `quota_warnings`. */
export function setAwards(committeeId: string, awards: Award[]): Promise<AwardsResponse> {
  return apiFetch<AwardsResponse>(`/committees/${committeeId}/awards`, { method: 'PUT', body: awards });
}

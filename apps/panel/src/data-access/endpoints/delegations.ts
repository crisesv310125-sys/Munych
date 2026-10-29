import { apiFetch, apiFetchAll } from '../apiClient';
import type {
  ApiDelegate,
  ApiDelegation,
  DelegateIn,
  DelegateUpdate,
  DelegationDraft,
  DelegationImportResult,
  DelegationUpdate,
} from '../apiTypes';

export function listDelegations(committeeId: string): Promise<ApiDelegation[]> {
  return apiFetchAll<ApiDelegation>(`/committees/${committeeId}/delegations`);
}

/** Puede traer los delegados en el mismo cuerpo (máx. 1 si el comité es single, 2 si es double). */
export function createDelegation(committeeId: string, draft: DelegationDraft): Promise<ApiDelegation> {
  return apiFetch<ApiDelegation>(`/committees/${committeeId}/delegations`, { method: 'POST', body: draft });
}

/** CSV UTF-8 con cabecera `country_code,character_name,institution,delegate_1,delegate_2`. */
export function importDelegationsCsv(committeeId: string, file: File): Promise<DelegationImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch<DelegationImportResult>(`/committees/${committeeId}/delegations/import`, {
    method: 'POST',
    formData,
  });
}

export function updateDelegation(delegationId: string, patch: DelegationUpdate): Promise<ApiDelegation> {
  return apiFetch<ApiDelegation>(`/delegations/${delegationId}`, { method: 'PATCH', body: patch });
}

export function deleteDelegation(delegationId: string): Promise<void> {
  return apiFetch<void>(`/delegations/${delegationId}`, { method: 'DELETE' });
}

export function addDelegate(delegationId: string, delegate: DelegateIn): Promise<ApiDelegate> {
  return apiFetch<ApiDelegate>(`/delegations/${delegationId}/delegates`, { method: 'POST', body: delegate });
}

export function updateDelegate(delegateId: string, patch: DelegateUpdate): Promise<ApiDelegate> {
  return apiFetch<ApiDelegate>(`/delegates/${delegateId}`, { method: 'PATCH', body: patch });
}

export function deleteDelegate(delegateId: string): Promise<void> {
  return apiFetch<void>(`/delegates/${delegateId}`, { method: 'DELETE' });
}

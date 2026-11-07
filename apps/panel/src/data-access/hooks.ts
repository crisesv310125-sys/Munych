import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './endpoints';
import { queryKeys } from './queryClient';
import type {
  Award,
  CommitteeDraft,
  CommitteeJudgeAssignment,
  CommitteeUpdate,
  DelegateIn,
  DelegationDraft,
  DelegationUpdate,
  EventDraft,
  EventUpdate,
  GenerateVoterTokensIn,
  PeerVoteWindowIn,
  JudgeInvite,
  JudgeUpdate,
  PublicationSettings,
  RubricIn,
} from './apiTypes';

// ---- Eventos ----

export function useEvents() {
  return useQuery<ApiEventList>({ queryKey: queryKeys.events, queryFn: () => api.listEvents() });
}
type ApiEventList = Awaited<ReturnType<typeof api.listEvents>>;

export function useEvent(eventId: string | undefined) {
  return useQuery({ queryKey: queryKeys.event(eventId ?? ''), queryFn: () => api.getEvent(eventId!), enabled: !!eventId });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: EventDraft) => api.createEvent(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.events }),
  });
}

export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: EventUpdate) => api.updateEvent(eventId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events });
      qc.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

export function useCloseEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.closeEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events });
      qc.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

export function useUploadEventLogo(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadEventLogo(eventId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.event(eventId) }),
  });
}

// ---- Comités ----

export function useCommittees(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.committees(eventId ?? ''),
    queryFn: () => api.listCommittees(eventId!),
    enabled: !!eventId,
  });
}

export function useCommittee(committeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.committee(committeeId ?? ''),
    queryFn: () => api.getCommittee(committeeId!),
    enabled: !!committeeId,
  });
}

export function useCreateCommittee(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: CommitteeDraft) => api.createCommittee(eventId, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.committees(eventId) }),
  });
}

export function useUpdateCommittee(eventId: string, committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: CommitteeUpdate) => api.updateCommittee(committeeId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.committees(eventId) });
      qc.invalidateQueries({ queryKey: queryKeys.committee(committeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.sessions(committeeId) });
    },
  });
}

export function useDeleteCommittee(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (committeeId: string) => api.deleteCommittee(committeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.committees(eventId) }),
  });
}

export function useCommitteeProgress(committeeId: string | undefined, options?: { pollMs?: number }) {
  return useQuery({
    queryKey: queryKeys.committeeProgress(committeeId ?? ''),
    queryFn: () => api.getCommitteeProgress(committeeId!),
    enabled: !!committeeId,
    refetchInterval: options?.pollMs,
  });
}

// ---- Delegaciones ----

export function useDelegations(committeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.delegations(committeeId ?? ''),
    queryFn: () => api.listDelegations(committeeId!),
    enabled: !!committeeId,
  });
}

export function useCreateDelegation(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: DelegationDraft) => api.createDelegation(committeeId, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

export function useImportDelegations(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.importDelegationsCsv(committeeId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

export function useUpdateDelegation(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ delegationId, patch }: { delegationId: string; patch: DelegationUpdate }) =>
      api.updateDelegation(delegationId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

export function useDeleteDelegation(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delegationId: string) => api.deleteDelegation(delegationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

export function useAddDelegate(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ delegationId, delegate }: { delegationId: string; delegate: DelegateIn }) => api.addDelegate(delegationId, delegate),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

export function useDeleteDelegate(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delegateId: string) => api.deleteDelegate(delegateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.delegations(committeeId) }),
  });
}

// ---- Jueces ----

/** Con `eventId`, solo los jueces vinculados a ese evento. */
export function useJudges(eventId?: string) {
  return useQuery({ queryKey: queryKeys.eventJudges(eventId), queryFn: () => api.listJudges(eventId) });
}

export function useJudgeInvitations(eventId?: string) {
  return useQuery({ queryKey: queryKeys.judgeInvitations(eventId), queryFn: () => api.listJudgeInvitations(eventId) });
}

export function useResendJudgeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (judgeId: string) => api.resendJudgeInvitation(judgeId),
    // Un 409 significa que ya la aceptó: refrescar mueve al juez a la lista principal.
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.judges }),
  });
}

export function useInviteJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invite: JudgeInvite) => api.inviteJudge(invite),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.judges }),
  });
}

export function useUpdateJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ judgeId, patch }: { judgeId: string; patch: JudgeUpdate }) =>
      api.updateJudge(judgeId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.judges }),
  });
}

export function useCommitteeJudges(committeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.committeeJudges(committeeId ?? ''),
    queryFn: () => api.getCommitteeJudges(committeeId!),
    enabled: !!committeeId,
  });
}

export function useSetCommitteeJudges(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignments: CommitteeJudgeAssignment[]) => api.setCommitteeJudges(committeeId, assignments),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.committeeJudges(committeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.committeeProgress(committeeId) });
    },
  });
}

// ---- Rúbricas ----

export function useEventRubrics(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rubrics(eventId ?? ''),
    queryFn: () => api.listEventRubrics(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateRubric(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rubric: RubricIn) => api.createRubric(eventId, rubric),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rubrics(eventId) }),
  });
}

export function useUpdateRubric(eventId: string, rubricId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rubric: RubricIn) => api.replaceRubric(rubricId, rubric),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rubrics(eventId) });
      qc.invalidateQueries({ queryKey: queryKeys.rubric(rubricId) });
    },
  });
}

// ---- Sesiones ----

export function useSessions(committeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions(committeeId ?? ''),
    queryFn: () => api.listSessions(committeeId!),
    enabled: !!committeeId,
  });
}

export function useOpenSession(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => api.openSession(committeeId, number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions(committeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.committeeProgress(committeeId) });
    },
  });
}

export function useCloseSession(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => api.closeSession(committeeId, number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions(committeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.committeeProgress(committeeId) });
    },
  });
}

// ---- Ranking y premios ----

export function useRanking(committeeId: string | undefined) {
  return useQuery({ queryKey: queryKeys.ranking(committeeId ?? ''), queryFn: () => api.getRanking(committeeId!), enabled: !!committeeId });
}

export function useAwards(committeeId: string | undefined) {
  return useQuery({ queryKey: queryKeys.awards(committeeId ?? ''), queryFn: () => api.getAwards(committeeId!), enabled: !!committeeId });
}

export function useSetAwards(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (awards: Award[]) => api.setAwards(committeeId, awards),
    onSuccess: (data) => qc.setQueryData(queryKeys.awards(committeeId), data),
  });
}

// ---- Publicación ----

export function usePublicationSettings(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicationSettings(eventId ?? ''),
    queryFn: () => api.getPublicationSettings(eventId!),
    enabled: !!eventId,
  });
}

export function useUpdatePublicationSettings(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: PublicationSettings) => api.updatePublicationSettings(eventId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.publicationSettings(eventId) });
      qc.invalidateQueries({ queryKey: queryKeys.publicationPreview(eventId) });
    },
  });
}

export function usePublicationPreview(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicationPreview(eventId ?? ''),
    queryFn: () => api.getPublicationPreview(eventId!),
    enabled: !!eventId,
  });
}

export function usePublishEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.publishEvent(eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.publicationPreview(eventId) }),
  });
}

export function useUnpublishEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.unpublishEvent(eventId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.publicationPreview(eventId) }),
  });
}

// ---- Votación de delegados (ADR-005) ----

export function useVoterTokens(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.voterTokens(eventId ?? ''),
    queryFn: () => api.listVoterTokens(eventId!),
    enabled: !!eventId,
  });
}

export function useGenerateVoterTokens(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateVoterTokensIn) => api.generateVoterTokens(eventId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.voterTokens(eventId) }),
  });
}

export function useRevokeVoterTokens(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delegateIds: string[]) => api.revokeVoterTokens(eventId, delegateIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.voterTokens(eventId) }),
  });
}

/** Estado del voto entre pares por comité; se refresca para ver quién ya votó. */
export function usePeerVoteWindows(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.peerVoteWindows(eventId ?? ''),
    queryFn: () => api.listPeerVoteWindows(eventId!),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });
}

export function useOpenPeerVote(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ committeeId, body }: { committeeId: string; body?: PeerVoteWindowIn }) => api.openPeerVote(committeeId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.peerVoteWindows(eventId) }),
  });
}

export function useClosePeerVote(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (committeeId: string) => api.closePeerVote(committeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.peerVoteWindows(eventId) }),
  });
}

// ---- Jueces (superficie /judge) ----

export function useJudgeCommittees() {
  return useQuery({ queryKey: queryKeys.judgeCommittees, queryFn: api.judgeApi.getJudgeCommittees });
}

export function useJudgeCommittee(committeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.judgeCommittee(committeeId ?? ''),
    queryFn: () => api.judgeApi.getJudgeCommittee(committeeId!),
    enabled: !!committeeId,
  });
}

export function useSessionScores(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessionScores(sessionId ?? ''),
    queryFn: () => api.judgeApi.getSessionScores(sessionId!),
    enabled: !!sessionId,
  });
}

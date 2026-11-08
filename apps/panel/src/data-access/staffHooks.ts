import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './endpoints';
import type {
  StaffAssignAwardIn,
  StaffAwardIn,
  StaffAwardPatch,
  StaffInviteIn,
  StaffMemberIn,
  StaffMemberPatch,
  StaffPersonIn,
  StaffRubricIn,
  StaffTypeDetail,
  StaffTypeIn,
  StaffTypePatch,
} from './staffTypes';

/**
 * El staff es de la organización. `eventId` es el evento de contexto (candidatos, avance y
 * premios); vacío = el que elija el backend (el activo más reciente).
 */
export const staffKeys = {
  all: ['staff'] as const,
  overview: (eventId: string) => ['staff', 'overview', eventId] as const,
  type: (typeId: string, eventId: string) => ['staff', 'type', typeId, eventId] as const,
  ranking: (typeId: string, eventId: string, committeeId: string) => ['staff', 'ranking', typeId, eventId, committeeId] as const,
  people: ['staff', 'people'] as const,
  eventStaff: (eventId: string) => ['staff', 'event-staff', eventId] as const,
};

export function useStaffOverview(eventId: string) {
  return useQuery({ queryKey: staffKeys.overview(eventId), queryFn: () => api.getStaffOverview(eventId) });
}

export function useStaffType(typeId: string | undefined, eventId: string) {
  return useQuery({
    queryKey: staffKeys.type(typeId ?? '', eventId),
    queryFn: () => api.getStaffType(typeId!, eventId),
    enabled: !!typeId,
  });
}

export function useStaffRanking(typeId: string | undefined, eventId: string, committeeId: string) {
  return useQuery({
    queryKey: staffKeys.ranking(typeId ?? '', eventId, committeeId),
    queryFn: () => api.getStaffRanking(typeId!, eventId, committeeId || undefined),
    enabled: !!typeId,
  });
}

export function useStaffPeople(enabled = true) {
  return useQuery({ queryKey: staffKeys.people, queryFn: () => api.listStaffPeople(), enabled });
}

/** Las mutaciones devuelven el detalle del tipo: se guarda y se refresca el resto del staff. */
function useDetailMutation<T>(eventId: string, fn: (input: T) => Promise<StaffTypeDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(staffKeys.type(detail.id, eventId), detail);
      void qc.invalidateQueries({ queryKey: staffKeys.all });
    },
  });
}

export function useCreateStaffType(eventId: string) {
  return useDetailMutation(eventId, (body: StaffTypeIn) => api.createStaffType(body, eventId));
}

export function useUpdateStaffType(typeId: string, eventId: string) {
  return useDetailMutation(eventId, (body: StaffTypePatch) => api.updateStaffType(typeId, body, eventId));
}

export function usePutStaffRubric(typeId: string, eventId: string) {
  return useDetailMutation(eventId, (body: StaffRubricIn) => api.putStaffRubric(typeId, body, eventId));
}

export function useAddStaffMember(typeId: string, eventId: string) {
  return useDetailMutation(eventId, (body: StaffMemberIn) => api.addStaffMember(typeId, body, eventId));
}

export function useUpdateStaffMember(eventId: string) {
  return useDetailMutation(eventId, ({ memberId, body }: { memberId: string; body: StaffMemberPatch }) =>
    api.updateStaffMember(memberId, body, eventId),
  );
}

export function useRemoveStaffMember(eventId: string) {
  return useDetailMutation(eventId, (memberId: string) => api.removeStaffMember(memberId, eventId));
}

export function useUpdateStaffPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, body }: { personId: string; body: Partial<StaffPersonIn> }) => api.updateStaffPerson(personId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useIssueStaffLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, linkBase }: { personId: string; linkBase: string }) => api.issueStaffLink(personId, linkBase),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useAddStaffAward(typeId: string, eventId: string) {
  return useDetailMutation(eventId, (body: StaffAwardIn) => api.addStaffAward(typeId, body, eventId));
}

export function useUpdateStaffAward(eventId: string) {
  return useDetailMutation(eventId, ({ awardId, body }: { awardId: string; body: StaffAwardPatch }) =>
    api.updateStaffAward(awardId, body, eventId),
  );
}

export function useAssignStaffAward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ awardId, body }: { awardId: string; body: StaffAssignAwardIn }) => api.assignStaffAward(awardId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

// ---- Personas del evento ----

export function useEventStaff(eventId: string | undefined) {
  return useQuery({ queryKey: staffKeys.eventStaff(eventId ?? ''), queryFn: () => api.listEventStaff(eventId!), enabled: !!eventId });
}

export function useInviteToEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StaffInviteIn) => api.inviteToEvent(eventId, body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: staffKeys.all });
      void qc.invalidateQueries({ queryKey: ['judges'] });
      // La invitación asigna comités (juez o mesa): se refrescan las asignaciones.
      void qc.invalidateQueries({ queryKey: ['committee'] });
    },
  });
}

export function useResendStaffAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => api.resendStaffAccess(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

/** Confirma (o reabre) los premios del tipo en un evento concreto. */
export function useConfirmStaffAwards(typeId: string, eventId: string) {
  return useDetailMutation(eventId, ({ confirmed, eventId: target }: { confirmed: boolean; eventId: string }) =>
    api.confirmStaffAwards(typeId, target, confirmed),
  );
}

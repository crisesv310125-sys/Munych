import type { EventStatus, EventType, JudgeCommitteeRole, SessionStatus, VoterRole } from '../data-access/apiTypes';

/**
 * Traducciones de los enums de estado del contrato (routes.md) a las etiquetas y tonos que
 * espera StatusBadge (@munych/ui). Viven aquí y no en el paquete compartido porque son
 * específicas del dominio MUNYCH, no de la UI genérica.
 */

export type BadgeTone = 'none' | 'progress' | 'done';

export function eventStatusLabel(status: EventStatus): string {
  if (status === 'closed') return 'Cerrado';
  if (status === 'active') return 'Activo';
  return 'Borrador';
}

/** Opciones de `event_type`, en el orden en que se ofrecen al crear un evento. */
export const EVENT_TYPE_OPTIONS: { value: EventType; label: string; description: string }[] = [
  { value: 'judges_only', label: 'Puntuación', description: 'Solo jueces califican' },
  { value: 'mun_regular', label: 'MUN regular', description: 'Mesa 30 % · Delegados 50 % · Staff 20 %' },
  {
    value: 'national_championship',
    label: 'Campeonato Nacional MUNer',
    description: 'Jueces 50 % · Mesa 15 % · Delegados 25 % · Staff 10 %',
  },
];

export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/** Si en este tipo de evento votan los delegados (y hace falta repartir accesos). */
export function delegatesVote(type: EventType | undefined): boolean {
  return type === 'mun_regular' || type === 'national_championship';
}

export const VOTER_ROLE_LABELS: Record<VoterRole, string> = {
  judge: 'Jueces',
  chair: 'Mesa Directiva',
  delegate: 'Delegados',
  staff: 'Staff',
};

/** Roles de cuenta que se pueden asignar en un comité según el tipo de evento. */
export function committeeRoleOptions(type: EventType | undefined): { value: JudgeCommitteeRole; label: string }[] {
  if (type === 'mun_regular') {
    return [
      { value: 'chair', label: 'Mesa Directiva' },
      { value: 'staff', label: 'Staff' },
    ];
  }
  if (type === 'national_championship') {
    return [
      { value: 'judge', label: 'Juez' },
      { value: 'chair', label: 'Mesa Directiva' },
      { value: 'staff', label: 'Staff' },
    ];
  }
  return [{ value: 'judge', label: 'Juez' }];
}

export function committeeRoleLabel(role: JudgeCommitteeRole): string {
  if (role === 'chair' || role === 'moderator') return 'Mesa';
  if (role === 'staff') return 'Staff';
  return 'Juez';
}

export function eventStatusTone(status: EventStatus): BadgeTone {
  if (status === 'closed') return 'done';
  if (status === 'active') return 'progress';
  return 'none';
}

interface SessionLike {
  status: SessionStatus;
  opened_at?: string | null;
  closed_at?: string | null;
}

/**
 * Las sesiones se crean cerradas: una sesión `closed` que nunca se abrió (`opened_at` null)
 * se muestra como "Pendiente", no como "Cerrada".
 */
function neverOpened(session: SessionLike): boolean {
  return session.status === 'closed' && session.opened_at === null;
}

export function sessionStatusLabel(session: SessionLike): string {
  if (session.status === 'open') return 'Abierta';
  if (neverOpened(session)) return 'Pendiente';
  return 'Cerrada';
}

export function sessionStatusTone(session: SessionLike): BadgeTone {
  if (session.status === 'open') return 'progress';
  if (neverOpened(session)) return 'none';
  return 'done';
}

/** Sesión vigente: la abierta; si no, la última que se abrió; si no, la primera. */
export function currentSessionFor<T extends SessionLike & { number: number }>(sessions: T[] | undefined): T | undefined {
  if (!sessions || sessions.length === 0) return undefined;
  const sorted = [...sessions].sort((a, b) => a.number - b.number);
  return sorted.find((s) => s.status === 'open') ?? [...sorted].reverse().find((s) => !neverOpened(s)) ?? sorted[0];
}

export type CommitteeOverallStatus = 'sin-iniciar' | 'en-curso' | 'cerrado';

/** El contrato no expone un status de comité: se deriva del estado de sus sesiones. */
export function committeeStatusFromSessions(sessions: SessionLike[]): CommitteeOverallStatus {
  if (sessions.length === 0 || sessions.every(neverOpened)) return 'sin-iniciar';
  if (sessions.every((s) => s.status === 'closed' && !neverOpened(s))) return 'cerrado';
  return 'en-curso';
}

export function committeeStatusLabel(status: CommitteeOverallStatus): string {
  if (status === 'cerrado') return 'Cerrado';
  if (status === 'en-curso') return 'En curso';
  return 'Sin iniciar';
}

export function committeeStatusTone(status: CommitteeOverallStatus): BadgeTone {
  if (status === 'cerrado') return 'done';
  if (status === 'en-curso') return 'progress';
  return 'none';
}

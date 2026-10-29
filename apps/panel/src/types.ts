export type Role = 'judge' | 'admin';

export type ScoreStatus = 'none' | 'progress' | 'done';

export type EventStatus = 'planificacion' | 'en-curso' | 'finalizado';

export interface MunEvent {
  id: string;
  name: string;
  initialisms: string;
  initDate: string;
  endDate: string;
  location: string;
  status: EventStatus;
  coverColor: string;
  committee: number;
  countries: number;
  judges: number;
}

export interface Criterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  order: number;
}

export interface Committee {
  id: string;
  eventId: string;
  name: string;
  acronym: string;
  room: string;
  language: 'Español' | 'Inglés';
  criteriaSetId: string;
  visible: boolean;
  countryCount: number;
  judgeCount: number;
  status: 'sin-iniciar' | 'en-curso' | 'cerrado';
}

export interface Country {
  id: string;
  committeeId: string;
  name: string;
  delegate: string;
  email: string;
}

export interface Judge {
  id: string;
  name: string;
  initials: string;
  email: string;
  password: string;
  committeeIds: string[];
  avatarColor: string;
  role: Role;
}

export interface ScoreEntry {
  values: Record<string, number>;
  comment: string;
  status: ScoreStatus;
  completedByJudge: boolean;
  updatedAt: number;
}

/** key: `${judgeId}:${countryId}` */
export type ScoreMap = Record<string, ScoreEntry>;

export interface Session {
  role: Role;
  name: string;
  email: string;
  /**
   * Compatibilidad temporal con las pantallas de jueces que todavía indexan datos locales
   * por judgeId (se retira cuando esas pantallas se conecten a /judge/* en el hito 5, que ya
   * no necesita judgeId: el backend escopea por el JWT).
   */
  judgeId: string | null;
}

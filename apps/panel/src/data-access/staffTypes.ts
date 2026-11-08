/**
 * Tipos de la gestión de staff (handoff «Gestión de staff», 2026-11-08). El staff es de la organización.
 * Verificados contra `modules/staff/schemas.py` del backend.
 */
import type { EventStatus, EventType } from './apiTypes';

export type StaffEvaluates = 'delegations' | 'delegates' | 'position_papers' | 'press';
/** none: solo premios · staff: peso Staff del ranking · chair: peso Mesa Directiva. */
export type StaffCountsAs = 'none' | 'staff' | 'chair';
export type StaffMemberRole = 'coordinator' | 'evaluator';
export type StaffAccess = 'not_invited' | 'invited' | 'active' | 'expired';
export type StaffAwardScope = 'event' | 'per_committee';
export type StaffTypeStatus = 'not_configured' | 'invalid_rubric' | 'not_started' | 'in_progress' | 'complete';
export type StaffRubricTemplate = 'press' | 'position_papers' | 'oratory' | 'protocol' | 'blank';

export interface StaffCriterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

export interface StaffCriterionIn {
  id?: string | null;
  name: string;
  description?: string | null;
  weight: number;
}

export interface StaffRubric {
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: StaffCriterion[];
  weight_sum: number;
  valid: boolean;
}

export interface StaffRubricIn {
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: StaffCriterionIn[];
}

export interface StaffAwardSlot {
  committee_id: string | null;
  committee_acronym: string | null;
  position: number;
  candidate_id: string | null;
  candidate_label: string | null;
  candidate_score: number | null;
  suggested_candidate_id: string | null;
  suggested_label: string | null;
  suggested_score: number | null;
  override_reason: string | null;
  assigned_at: string | null;
}

export interface StaffAward {
  id: string;
  name: string;
  winners: number;
  scope: StaffAwardScope;
  tiebreak_criterion_id: string | null;
  slots_total: number;
  slots_assigned: number;
  slots: StaffAwardSlot[];
}

export interface StaffAwardIn {
  name: string;
  winners: number;
  scope: StaffAwardScope;
  tiebreak_criterion_id?: string | null;
}

export interface StaffAwardPatch extends Partial<StaffAwardIn> {
  archived?: boolean;
}

export interface StaffTypeSummary {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string | null;
  evaluates: StaffEvaluates | null;
  all_committees: boolean;
  committee_ids: string[];
  min_evaluators: number;
  counts_as: StaffCountsAs;
  criteria_count: number;
  weight_sum: number;
  rubric_valid: boolean;
  awards: StaffAward[];
  members_count: number;
  members_preview: string[];
  candidates: number;
  evaluations_done: number;
  evaluations_expected: number;
  progress: number | null;
  status: StaffTypeStatus;
  awards_confirmed_at: string | null;
}

export interface StaffEventRef {
  id: string;
  name: string;
  status: EventStatus;
  event_type: EventType;
  starts_on: string;
}

/** Staff de la organización; avance, candidatos y premios son del evento de contexto. */
export interface StaffOverview {
  organization_name: string;
  events: StaffEventRef[];
  event_id: string | null;
  event_name: string | null;
  event_type: EventType | null;
  staff_weight: number | null;
  chair_weight: number | null;
  types: StaffTypeSummary[];
  people: number;
  people_active: number;
  awards_total: number;
  awards_assigned: number;
  progress: number | null;
}

export interface StaffMember {
  id: string;
  person_id: string;
  full_name: string;
  email: string | null;
  title: string | null;
  role: StaffMemberRole;
  committee_ids: string[];
  access: StaffAccess;
  evaluated: number;
  assigned: number;
  removed_at: string | null;
  evaluations_count: boolean;
  other_types: string[];
}

export interface StaffCommitteeRef {
  id: string;
  name: string;
  acronym: string;
}

export interface StaffTypeDetail extends StaffTypeSummary {
  /** Evento de contexto del avance y los premios (null: la organización no tiene eventos). */
  event_id: string | null;
  rubric: StaffRubric;
  members: StaffMember[];
  committees: StaffCommitteeRef[];
  evaluations_exist: boolean;
}

export interface StaffTypeIn {
  name: string;
  code?: string | null;
  color?: string | null;
  description?: string | null;
  evaluates?: StaffEvaluates | null;
  all_committees: boolean;
  committee_ids: string[];
  min_evaluators: number;
  counts_as: StaffCountsAs;
  template: StaffRubricTemplate;
  awards: StaffAwardIn[];
}

export interface StaffTypePatch {
  name?: string;
  code?: string;
  color?: string;
  description?: string | null;
  evaluates?: StaffEvaluates;
  all_committees?: boolean;
  committee_ids?: string[];
  min_evaluators?: number;
  counts_as?: StaffCountsAs;
  archived?: boolean;
}

export interface StaffPerson {
  id: string | null;
  full_name: string;
  email: string | null;
  title: string | null;
  access: StaffAccess;
  types: string[];
  source: 'staff' | 'judge';
}

export interface StaffPersonIn {
  full_name: string;
  email?: string | null;
  title?: string | null;
}

export interface StaffMemberIn {
  person_id?: string | null;
  person?: StaffPersonIn | null;
  role: StaffMemberRole;
  committee_ids: string[];
}

export interface StaffMemberPatch {
  role?: StaffMemberRole;
  committee_ids?: string[];
  evaluations_count?: boolean;
  restore?: boolean;
}

export interface StaffAccessLink {
  person_id: string;
  full_name: string;
  email: string | null;
  token: string;
  url: string;
  expires_at: string;
}

export interface StaffRankingRow {
  candidate_id: string;
  label: string;
  sublabel: string | null;
  committee_id: string;
  committee_acronym: string;
  score: number | null;
  evaluations: number;
  eligible: boolean;
  position: number | null;
  tied: boolean;
  awards: string[];
}

export interface StaffRanking {
  staff_type_id: string;
  event_id: string | null;
  committee_id: string | null;
  min_evaluators: number;
  rows: StaffRankingRow[];
  awards: StaffAward[];
  awards_confirmed_at: string | null;
}

export interface StaffAssignAwardIn {
  event_id: string;
  committee_id: string | null;
  position: number;
  candidate_id: string | null;
  override_reason?: string | null;
}

// ---- Vista del miembro del staff (enlace personal) ----

export interface StaffCandidate {
  candidate_id: string;
  label: string;
  sublabel: string | null;
  committee_acronym: string;
  values: Record<string, number>;
  comment: string | null;
  complete: boolean;
  updated_at: string | null;
}

/** Un tipo de staff de la persona en un evento abierto de la organización. */
export interface StaffAssignment {
  member_id: string;
  event_id: string;
  event_name: string;
  staff_type_id: string;
  name: string;
  code: string;
  color: string;
  role: StaffMemberRole;
  evaluates: StaffEvaluates | null;
  open: boolean;
  closed_reason: string | null;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  criteria: StaffCriterion[];
  candidates: StaffCandidate[];
}

export interface StaffMe {
  full_name: string;
  title: string | null;
  organization_name: string;
  assignments: StaffAssignment[];
}

export interface StaffEvaluationIn {
  member_id: string;
  event_id: string;
  candidate_id: string;
  values: Record<string, number>;
  comment?: string | null;
  client_updated_at?: string | null;
}

export interface StaffEvaluation {
  candidate_id: string;
  values: Record<string, number>;
  comment: string | null;
  complete: boolean;
  updated_at: string | null;
}

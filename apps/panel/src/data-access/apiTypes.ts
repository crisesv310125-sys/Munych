/**
 * Formas del contrato de la API, copiadas de routes.md (sección 4, "Modelos de la API").
 * snake_case porque así viaja el JSON. Los nombres `Api*` se conservan como alias para no
 * renombrar tipos en todas las pantallas; entre paréntesis, el nombre del schema del backend.
 */

// ---- Comunes ----

export type Role = 'admin' | 'judge';

/** (Page<T>) */
export interface Paginated<T> {
  items: T[];
  total: number;
}

/** (MeOut) */
export interface Me {
  user_id: string;
  email: string | null;
  role: Role | null;
  full_name: string | null;
}

// ---- Jueces y asignaciones ----

/** (JudgeOut) */
export interface ApiJudge {
  judge_id: string;
  email: string | null;
  full_name: string;
  active: boolean;
}

/** (JudgeInvitationOut) Juez invitado que aún no abre el enlace; no sale en GET /judges. */
export interface ApiJudgeInvitation {
  judge_id: string;
  email: string | null;
  full_name: string;
  /** ISO 8601 (UTC): fecha del último envío. */
  invited_at: string | null;
}

/** (JudgeInvite) */
export interface JudgeInvite {
  email: string;
  full_name: string;
  event_id?: string | null;
  
}

/** (JudgeUpdate) */
export interface JudgeUpdate {
  full_name?: string | null;
  active?: boolean | null;
}

/** Rol de una cuenta en un comité. `chair` y `moderator` cuentan como Mesa Directiva. */
export type JudgeCommitteeRole = 'chair' | 'moderator' | 'judge' | 'staff';

/** Grupo que vota en el resultado ponderado. `chair` = Mesa Directiva. */
export type VoterRole = 'judge' | 'chair' | 'staff' | 'delegate';

/** (AssignmentIn) */
export interface CommitteeJudgeAssignment {
  judge_id: string;
  role?: JudgeCommitteeRole;
}

/** (AssignmentOut) */
export interface CommitteeJudgeAssignmentOut {
  judge_id: string;
  role: JudgeCommitteeRole;
  full_name: string;
  email: string | null;
  active: boolean;
}

// ---- Eventos ----

export type EventBrand = 'munych' | 'grand_international';
export type EventStatus = 'draft' | 'active' | 'closed';
/**
 * judges_only: solo califican los jueces (flujo original).
 * mun_regular: mesa 30 %, delegados 50 %, staff 20 % (sin jueces).
 * national_championship: jueces 50 %, mesa 15 %, delegados 25 %, staff 10 %.
 * Solo se puede cambiar con el evento en borrador.
 */
export type EventType = 'judges_only' | 'mun_regular' | 'national_championship';

/** (EventCreate) */
export interface EventDraft {
  slug: string;
  name: string;
  brand: EventBrand;
  /** Por defecto `judges_only`. */
  event_type?: EventType;
  venue?: string | null;
  country_code?: string | null;
  timezone: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD, >= starts_on
}

/** (EventUpdate) — para cerrar se usa POST /events/{id}/close, no `status`. */
export type EventUpdate = Partial<EventDraft> & {
  default_rubric_id?: string | null;
  status?: 'draft' | 'active' | null;
};

/** (EventOut) */
export interface ApiEvent {
  id: string;
  slug: string;
  name: string;
  brand: EventBrand;
  event_type: EventType;
  logo_url: string | null;
  venue: string | null;
  country_code: string | null;
  timezone: string;
  starts_on: string;
  ends_on: string;
  status: EventStatus;
  default_rubric_id: string | null;
  created_at: string;
  updated_at: string | null;
}

/** (CloseEventOut) */
export interface CloseEventResponse {
  event_id: string;
  status: 'closed';
  snapshot_id: string;
  closed_at: string;
}

// ---- Comités ----

export type CommitteeType = 'general_assembly' | 'security_council' | 'crisis' | 'specialized';
export type DelegationMode = 'single' | 'double';
export type AwardType = 'best_delegate' | 'outstanding_delegate' | 'honorable_mention' | 'verbal_commendation';
export type AwardQuotas = Partial<Record<AwardType, number>>;

/** (CommitteeCreate) */
export interface CommitteeDraft {
  name: string;
  acronym: string;
  slug: string; // único por evento
  type: CommitteeType;
  delegation_mode: DelegationMode;
  sessions_count: number; // 1–20
  rubric_id?: string | null; // null = usa la rúbrica por defecto del evento
  award_quotas?: AwardQuotas | null; // null = cupos por defecto del tipo
}

/** (CommitteeUpdate) */
export type CommitteeUpdate = Partial<CommitteeDraft>;

/** (CommitteeOut) */
export interface ApiCommittee {
  id: string;
  event_id: string;
  name: string;
  acronym: string;
  slug: string;
  type: CommitteeType;
  delegation_mode: DelegationMode;
  sessions_count: number;
  rubric_id: string | null;
  award_quotas: AwardQuotas;
  created_at: string;
}

// ---- Delegaciones y delegados ----

/** (DelegateIn) */
export interface DelegateIn {
  full_name: string;
  institution?: string | null;
}

/** (DelegateUpdate) */
export interface DelegateUpdate {
  full_name?: string | null;
  institution?: string | null;
}

/** (DelegateOut) */
export interface ApiDelegate {
  id: string;
  delegation_id: string;
  full_name: string;
  institution: string | null;
}

/** (DelegationCreate) — exactamente uno de country_code o character_name. */
export interface DelegationDraft {
  country_code?: string | null;
  character_name?: string | null;
  institution?: string | null;
  delegates?: DelegateIn[];
}

/** (DelegationUpdate) — para pasar de país a personaje, se envían ambos campos, uno en null. */
export interface DelegationUpdate {
  country_code?: string | null;
  character_name?: string | null;
  institution?: string | null;
}

/** (DelegationOut) */
export interface ApiDelegation {
  id: string;
  committee_id: string;
  country_code: string | null;
  character_name: string | null;
  institution: string | null;
  delegates: ApiDelegate[];
}

/** (ImportResult) — `row` es la línea del archivo (la cabecera es la línea 1). */
export interface DelegationImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

// ---- Rúbricas ----

/** (CriterionIn) */
export interface CriterionIn {
  id?: string | null; // id existente para conservarlo; vacío = nuevo
  name: string;
  description?: string | null;
  weight: number;
  level_descriptors?: Record<string, string>;
}

/** (RubricIn) — el orden de `criteria` define `position`. */
export interface RubricIn {
  name: string;
  scale_min: number;
  scale_max: number;
  criteria: CriterionIn[];
}

/** (CriterionOut) */
export interface ApiCriterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  position: number;
  /** Clave = nivel como texto ("1", "2", …). */
  level_descriptors: Record<string, string>;
}

/** (RubricOut) */
export interface ApiRubric {
  id: string;
  event_id: string;
  name: string;
  scale_min: number;
  scale_max: number;
  criteria: ApiCriterion[];
}

// ---- Sesiones, calificaciones y progreso ----

export type SessionStatus = 'open' | 'closed';

/** (SessionOut) — las sesiones se crean cerradas; `opened_at` null = nunca se abrió. */
export interface ApiSession {
  id: string;
  committee_id: string;
  number: number;
  status: SessionStatus;
  opened_at: string | null;
  closed_at: string | null;
}

export interface CommitteeProgressJudge {
  judge_id: string;
  full_name: string;
  scored: number;
  expected: number;
}

export interface CommitteeProgressSession {
  number: number;
  status: SessionStatus;
  judges: CommitteeProgressJudge[];
}

/** (ProgressOut) */
export interface CommitteeProgress {
  sessions: CommitteeProgressSession[];
}

/** (ScoreItemIn) */
export interface ScoreBatchItem {
  client_id: string;
  delegate_id: string;
  session_id: string;
  criterion_id: string;
  value: number;
  comment?: string | null;
  client_updated_at: string;
}

export type ScoreRejectionCode =
  | 'SESSION_CLOSED'
  | 'EVENT_CLOSED'
  | 'JUDGE_NOT_ASSIGNED'
  | 'VALUE_OUT_OF_RANGE'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT';

export interface ScoreRejection {
  client_id: string;
  code: ScoreRejectionCode | (string & {});
  detail: string;
}

/** (ScoresBatchOut) */
export interface ScoreBatchResponse {
  accepted: string[];
  rejected: ScoreRejection[];
}

/** (ScoreOut) */
export interface JudgeScore {
  client_id: string;
  delegate_id: string;
  session_id: string;
  criterion_id: string;
  value: number;
  comment: string | null;
  client_updated_at: string;
  updated_at: string | null;
}

// ---- Panel del juez ----

/** (JudgeEventOut) */
export interface JudgeEventInfo {
  name: string;
  logo_url: string | null;
  timezone: string;
}

/** (JudgeCommitteeOut) */
export interface JudgeCommitteeSummary {
  committee_id: string;
  name: string;
  acronym: string;
  event: JudgeEventInfo;
  role: JudgeCommitteeRole;
}

export interface JudgeDelegate {
  delegate_id: string;
  full_name: string;
}

export interface JudgeDelegation {
  delegation_id: string;
  country_code: string | null;
  character_name: string | null;
  institution: string | null;
  delegates: JudgeDelegate[];
}

export interface JudgeRubric {
  id: string;
  name: string;
  scale_min: number;
  scale_max: number;
  criteria: ApiCriterion[];
}

export interface JudgeSession {
  session_id: string;
  number: number;
  status: SessionStatus;
  opened_at: string | null;
  closed_at: string | null;
}

/** (JudgeCommitteeDetailOut) */
export interface JudgeCommitteeDetail {
  committee_id: string;
  name: string;
  acronym: string;
  type: CommitteeType;
  delegation_mode: DelegationMode;
  role: JudgeCommitteeRole;
  event: JudgeEventInfo;
  event_closed: boolean;
  delegations: JudgeDelegation[];
  rubric: JudgeRubric | null;
  sessions: JudgeSession[];
}

// ---- Ranking y premios ----

export interface RankingDelegate {
  delegate_id: string;
  full_name: string;
  final_score: number | null;
}

export type IncompleteFlagKind = 'incomplete' | 'session_without_scores' | 'delegate_without_scores';

export interface IncompleteFlag {
  kind: IncompleteFlagKind;
  delegate_id: string;
  session_number: number | null;
  judge_id: string | null;
}

/** (RankingEntry) */
export interface RankingEntry {
  position: number;
  tied: boolean;
  delegation_id: string;
  country_code: string | null;
  character_name: string | null;
  institution: string | null;
  delegates: RankingDelegate[];
  score: number | null; // 0–100, null = sin notas (va al final)
  criteria_averages: Record<string, number | null>; // clave = criterion_id
  incomplete_flags: IncompleteFlag[];
  /** Nota 0–100 por rol que vota; null = nadie de ese rol calificó (su peso se reparte). */
  role_scores: Partial<Record<VoterRole, number | null>>;
}

/** (RankingOut) */
export interface RankingResponse {
  items: RankingEntry[];
  quota_warnings: string[];
  event_type: EventType;
  /** Peso (%) de cada rol según el tipo de evento. */
  role_weights: Partial<Record<VoterRole, number>>;
}

// ---- Votación de delegados (ADR-005) ----

export type VoterTokenStatus = 'none' | 'active' | 'revoked' | 'expired';

/** (VoterAccessOut) — nunca incluye el token. */
export interface VoterAccess {
  delegate_id: string;
  full_name: string;
  delegation_id: string;
  country_code: string | null;
  character_name: string | null;
  committee_id: string;
  committee_name: string;
  committee_acronym: string;
  status: VoterTokenStatus;
  issued_at: string | null;
  last_used_at: string | null;
  /** Premios que ha votado (0 si aún no envía su boleta). */
  votes_count: number;
}

/** (GenerateTokensIn) */
export interface GenerateVoterTokensIn {
  /** Prefijo del enlace; el token se añade al final. */
  link_base: string;
  /** Sin lista: todos los que no tienen acceso vigente. Con lista: regenera esos. */
  delegate_ids?: string[] | null;
}

/** (GeneratedTokenOut) — el token solo llega aquí, una vez. */
export interface GeneratedVoterToken {
  delegate_id: string;
  full_name: string;
  country_code: string | null;
  character_name: string | null;
  committee_name: string;
  committee_acronym: string;
  token: string;
  url: string;
  qr_svg: string;
  expires_at: string;
}

export interface BallotDelegation {
  delegation_id: string;
  country_code: string | null;
  character_name: string | null;
}

/** Premios que votan los delegados entre pares (2026-11-06): no usan la rúbrica. */
export type PeerAwardType = 'best_delegate' | 'outstanding_delegate' | 'honorable_mention';

/** Estado del voto entre pares de un comité (derivado de sus fechas y del evento). */
export type PeerVoteStatus = 'not_scheduled' | 'scheduled' | 'open' | 'closed';

/** (PeerVoteWindowOut) */
export interface PeerVoteWindow {
  status: PeerVoteStatus;
  opens_at: string | null;
  /** null: abierto hasta que el admin lo cierre. */
  closes_at: string | null;
}

/** (PeerVoteWindowIn) — opens_at null = ahora (hora del servidor). */
export interface PeerVoteWindowIn {
  opens_at?: string | null;
  closes_at?: string | null;
}

/** (CommitteePeerVoteOut) */
export interface CommitteePeerVote extends PeerVoteWindow {
  committee_id: string;
  committee_name: string;
  committee_acronym: string;
  voters: number;
  submitted: number;
}

/** (BallotAwardOut) */
export interface BallotAward {
  award_type: PeerAwardType;
  label: string;
  points: number;
}

/** (BallotPickOut) */
export interface BallotPick {
  award_type: PeerAwardType;
  delegation_id: string;
}

/** (BallotOut) — boleta entre pares: una delegación por premio, una sola vez. */
export interface Ballot {
  voter_name: string;
  own_delegation: BallotDelegation;
  event_name: string;
  event_status: EventStatus;
  committee_name: string;
  committee_acronym: string;
  sessions_total: number;
  sessions_closed: number;
  peer_vote: PeerVoteWindow;
  /** Peso (%) del voto de los delegados en el puntaje final. */
  weight: number;
  /** Premios a votar, en orden (menos de 3 si el comité tiene pocas delegaciones). */
  awards: BallotAward[];
  /** Todas las delegaciones del comité menos la propia. */
  delegations: BallotDelegation[];
  /** Voto enviado; vacío si aún no vota. */
  picks: BallotPick[];
  submitted_at: string | null;
  receipt: string | null;
}

/** (AwardIn / AwardOut) */
export interface Award {
  award_type: AwardType;
  delegation_id: string;
  position: number;
}

/** (AwardsOut) — superar un cupo no bloquea, solo añade avisos. */
export interface AwardsResponse {
  items: Award[];
  quota_warnings: string[];
}

// ---- Publicación / documento público ----

export type PublicNameFormat = 'full' | 'first_name_initial' | 'hidden';

/** (PublicationSettings) — el backend devuelve siempre todos los campos con su valor por defecto. */
export interface PublicationSettings {
  name_format: PublicNameFormat;
  show_institution: boolean;
  show_ranking: boolean;
  show_scores: boolean;
  indexable: boolean;
}

export interface PublicEventInfo {
  slug: string;
  name: string;
  brand: string;
  logo_url: string | null;
  venue: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string;
}

/** (PublicDelegation) */
export interface PublicAwardDelegation {
  country_code: string | null;
  character_name: string | null;
  institution: string | null;
}

export interface PublicAward {
  award_type: AwardType;
  position: number;
  delegation: PublicAwardDelegation;
  delegates: string[];
}

export interface PublicRankingItem {
  position: number;
  delegation: PublicAwardDelegation;
  delegates: string[];
  score: number | null;
}

export interface PublicCommittee {
  slug: string;
  name: string;
  acronym: string;
  type: CommitteeType;
  awards: PublicAward[];
  ranking: PublicRankingItem[] | null;
}

/** (PublicDocument) */
export interface PublicResultsDocument {
  event: PublicEventInfo;
  settings: PublicationSettings;
  committees: PublicCommittee[];
  published_at: string;
  version: number;
}

/** (PublishOut) */
export interface PublishResponse {
  version: number;
  published_at: string;
  revalidated: boolean;
}

/** (UnpublishOut) */
export interface UnpublishResponse {
  revalidated: boolean;
}

// ---- Errores (application/problem+json) ----

export type ApiErrorCode =
  | ScoreRejectionCode
  | 'WEIGHTS_MUST_SUM_100'
  | 'DELEGATES_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'EVENT_NOT_CLOSED'
  | 'SESSIONS_STILL_OPEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | (string & {});

export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  code: ApiErrorCode;
  detail: string;
  errors?: unknown;
}

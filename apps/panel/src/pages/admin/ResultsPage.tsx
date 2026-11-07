import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@munych/ui/components/Button';
import { Medal } from '@munych/ui/components/Medal';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { Select } from '@munych/ui/components/FormControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { Toggle } from '@munych/ui/components/SelectionControls';
import {
  useAwards,
  useCommittees,
  useEvent,
  useEventRubrics,
  usePublicationPreview,
  usePublicationSettings,
  usePublishEvent,
  useRanking,
  useSetAwards,
  useSetTiebreak,
  useUnpublishEvent,
  useUpdatePublicationSettings,
} from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { VOTER_ROLE_LABELS } from '../../lib/statusLabels';
import type { Award, AwardType, IncompleteFlag, PublicationSettings, PublicNameFormat, RankingEntry, VoterRole } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';

const AWARD_TYPES: Array<{ id: AwardType; label: string }> = [
  { id: 'best_delegate', label: 'Mejor delegado' },
  { id: 'outstanding_delegate', label: 'Delegado distinguido' },
  { id: 'honorable_mention', label: 'Mención honorífica' },
  { id: 'verbal_commendation', label: 'Mención verbal' },
];

const NAME_FORMAT_LABEL: Record<PublicNameFormat, string> = {
  full: 'Nombre completo',
  first_name_initial: 'Nombre e inicial',
  hidden: 'Oculto',
};

function delegationLabel(entry: RankingEntry): string {
  return entry.character_name ?? entry.country_code ?? '—';
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? '—' : score.toFixed(1);
}

function incompleteFlagLabel(flag: IncompleteFlag, entry: RankingEntry): string {
  const delegate = entry.delegates.find((d) => d.delegate_id === flag.delegate_id)?.full_name ?? 'Delegado';
  const session = flag.session_number !== null ? ` · sesión ${flag.session_number}` : '';
  if (flag.kind === 'delegate_without_scores') return `${delegate}: sin calificaciones`;
  if (flag.kind === 'session_without_scores') return `${delegate}: sin notas${session}`;
  return `${delegate}: calificación incompleta${session}`;
}

export function ResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const { data: rubrics } = useEventRubrics(eventId);
  const [committeeId, setCommitteeId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const list = committees ?? [];
  useEffect(() => {
    if (!list.some((c) => c.id === committeeId)) setCommitteeId(list[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  const committee = list.find((c) => c.id === committeeId);
  // Sin rubric_id propio, el comité usa la rúbrica por defecto del evento.
  const rubricId = committee?.rubric_id ?? event?.default_rubric_id;
  const rubric = rubrics?.find((r) => r.id === rubricId) ?? rubrics?.[0];
  const criteria = [...(rubric?.criteria ?? [])].sort((a, b) => a.position - b.position);

  const { data: rankingResponse } = useRanking(committeeId);
  const results = rankingResponse?.items ?? [];
  // Con votación por roles, el total es la suma ponderada de cada rol (se desglosa al expandir).
  const roleWeights = Object.entries(rankingResponse?.role_weights ?? {}) as Array<[VoterRole, number]>;

  const scoredResults = results.filter((r) => r.score !== null);
  const overallAvg = scoredResults.length === 0 ? 0 : scoredResults.reduce((s, r) => s + (r.score ?? 0), 0) / scoredResults.length;
  const COLS = `70px 2.2fr repeat(${Math.max(criteria.length, 1)}, 1fr) 110px`;

  // ---- Desempate manual (los empates los decide el admin) ----
  const setTiebreak = useSetTiebreak(committeeId);
  const [tiebreakError, setTiebreakError] = useState('');
  const eventClosed = event?.status === 'closed';
  /** Orden manual vigente: las delegaciones ya desempatadas, en su orden del ranking. */
  const manualOrder = results.filter((x) => x.manual_tiebreak).map((x) => x.delegation_id);
  const tiedWith = (r: RankingEntry) => results.filter((x) => x.tied && x.position === r.position);
  const manualGroupOf = (r: RankingEntry) => results.filter((x) => x.manual_tiebreak && x.score === r.score);

  async function saveTiebreak(order: string[]) {
    setTiebreakError('');
    try {
      await setTiebreak.mutateAsync(order);
    } catch (err) {
      setTiebreakError(errorMessage(err));
    }
  }

  /** Resuelve el empate poniendo a `r` primero; el resto del grupo queda en su orden actual. */
  function putFirst(r: RankingEntry) {
    const rest = tiedWith(r).filter((x) => x.delegation_id !== r.delegation_id);
    void saveTiebreak([...manualOrder, r.delegation_id, ...rest.map((x) => x.delegation_id)]);
  }

  /** Mueve a `r` un lugar arriba (-1) o abajo (+1) dentro de su empate ya resuelto. */
  function move(r: RankingEntry, step: -1 | 1) {
    const group = manualGroupOf(r).map((x) => x.delegation_id);
    const i = group.indexOf(r.delegation_id);
    const j = i + step;
    if (j < 0 || j >= group.length) return;
    [group[i], group[j]] = [group[j], group[i]];
    void saveTiebreak([...manualOrder.filter((id) => !group.includes(id)), ...group]);
  }

  /** Vuelve a dejar empatado el grupo de `r`. */
  function undoTiebreak(r: RankingEntry) {
    const group = manualGroupOf(r).map((x) => x.delegation_id);
    void saveTiebreak(manualOrder.filter((id) => !group.includes(id)));
  }

  // ---- Premios ----
  const { data: awards } = useAwards(committeeId);
  const setAwards = useSetAwards(committeeId);
  const [awardsDraft, setAwardsDraft] = useState<Award[] | null>(null);
  const [awardsError, setAwardsError] = useState('');
  const currentAwards = awardsDraft ?? awards?.items ?? [];
  const quotaWarnings = [...new Set([...(rankingResponse?.quota_warnings ?? []), ...(awards?.quota_warnings ?? [])])];

  useEffect(() => {
    setAwardsDraft(null);
  }, [committeeId]);

  /** Un selector por plaza del cupo del comité (y más si ya hay premios guardados por encima del cupo). */
  function awardSlots(type: AwardType): number {
    const quota = committee?.award_quotas[type] ?? 1;
    const assigned = Math.max(0, ...currentAwards.filter((a) => a.award_type === type).map((a) => a.position));
    return Math.max(quota, assigned, 1);
  }

  function awardFor(type: AwardType, position: number): string {
    return currentAwards.find((a) => a.award_type === type && a.position === position)?.delegation_id ?? '';
  }

  function setAward(type: AwardType, position: number, delegationId: string) {
    const base = currentAwards.filter((a) => !(a.award_type === type && a.position === position));
    setAwardsDraft(delegationId ? [...base, { award_type: type, delegation_id: delegationId, position }] : base);
  }

  async function saveAwards() {
    setAwardsError('');
    try {
      await setAwards.mutateAsync(currentAwards);
      setAwardsDraft(null);
    } catch (err) {
      setAwardsError(errorMessage(err));
    }
  }

  // ---- Publicación ----
  const { data: settings } = usePublicationSettings(eventId);
  const updateSettings = useUpdatePublicationSettings(eventId ?? '');
  const publishEvent = usePublishEvent(eventId ?? '');
  const unpublishEvent = useUnpublishEvent(eventId ?? '');
  const { data: preview, refetch: refetchPreview } = usePublicationPreview(eventId);
  const [showPreview, setShowPreview] = useState(false);
  const [pubError, setPubError] = useState('');
  const [pubNotice, setPubNotice] = useState('');

  async function patchSettings(patch: Partial<PublicationSettings>) {
    if (!settings) return;
    setPubError('');
    setPubNotice('');
    try {
      await updateSettings.mutateAsync({ ...settings, ...patch });
    } catch (err) {
      setPubError(errorMessage(err));
    }
  }

  // La página pública es estática: el backend agrupa los cambios y pide un build a Cloudflare
  // Pages ~45 s después de la última publicación, y el build tarda 1–2 min.
  function siteUpdateMessage(done: string, revalidated: boolean) {
    if (revalidated) setPubNotice(`${done} La página pública se actualizará en unos 2–3 minutos.`);
    else setPubError(`${done} La página pública no se actualizará sola: falta configurar el deploy hook en el backend.`);
  }

  async function handlePublish() {
    setPubError('');
    setPubNotice('');
    try {
      const res = await publishEvent.mutateAsync();
      siteUpdateMessage('Resultados publicados.', res.revalidated);
    } catch (err) {
      setPubError(errorMessage(err));
    }
  }

  async function handleUnpublish() {
    setPubError('');
    setPubNotice('');
    try {
      const res = await unpublishEvent.mutateAsync();
      siteUpdateMessage('Resultados despublicados.', res.revalidated);
    } catch (err) {
      setPubError(errorMessage(err));
    }
  }

  return (
    <div className={styles.page}>
      <div style={{ background: 'var(--navy)', padding: '24px 26px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: '.16em', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>RESULTADOS FINALES</span>
          <Select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)}>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
            {results.length} delegaciones · promedio ponderado del comité {overallAvg.toFixed(1)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="onNavy" onClick={() => setShowPreview((s) => !s)}>
            {showPreview ? 'Ocultar vista previa' : 'Vista previa pública'}
          </Button>
          <Button variant="gold" onClick={() => navigate(`/admin/eventos/${eventId}/exportar`)}>
            Exportar
          </Button>
        </div>
      </div>

      {quotaWarnings.length > 0 && (
        <div style={{ background: 'var(--callout-bg)', borderBottom: '1px solid var(--callout-border)', padding: '10px 26px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {quotaWarnings.map((w, i) => (
            <span key={i} style={{ fontSize: 12, color: 'var(--callout-fg)' }}>
              {w}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 14, padding: '11px 26px', borderBottom: '1px solid var(--border-soft)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
        <span>Pos.</span>
        <span>Delegación</span>
        {criteria.length > 0
          ? criteria.map((k) => <span key={k.id}>{k.name.slice(0, 10)}</span>)
          : <span>Criterios</span>}
        <span style={{ textAlign: 'right' }}>Total</span>
      </div>
      {results.map((r) => {
        const expanded = expandedId === r.delegation_id;
        return (
          <div key={r.delegation_id}>
            <div
              onClick={() => setExpandedId(expanded ? null : r.delegation_id)}
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                gap: 14,
                padding: '16px 26px',
                borderBottom: '1px solid var(--border-soft)',
                alignItems: 'center',
                background: r.position === 1 ? '#FDFBF3' : undefined,
                cursor: 'pointer',
              }}
            >
              <Medal position={r.position} size={32} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-serif)', fontSize: r.position <= 3 ? 19 : 18, fontWeight: 600, color: 'var(--navy)' }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {delegationLabel(r)}
                {r.tied && <StatusBadge tone="progress" label="EMPATE" />}
                {r.manual_tiebreak && <StatusBadge tone="none" label="DESEMPATE MANUAL" />}
              </span>
              {criteria.map((k) => (
                <span key={k.id} style={{ fontSize: 14, color: 'var(--ink)' }}>
                  {formatScore(r.criteria_averages[k.id])}
                </span>
              ))}
              <span style={{ justifySelf: 'end', fontFamily: 'var(--font-serif)', fontSize: r.position <= 3 ? 24 : 22, fontWeight: 600, color: 'var(--navy)' }}>
                {formatScore(r.score)}
              </span>
            </div>
            {expanded && (
              <div style={{ background: 'var(--row-hover)', borderBottom: '1px solid var(--border-soft)', padding: '20px 26px 22px 96px', display: 'flex', gap: 34, flexWrap: 'wrap' }}>
                <div style={{ flex: '1.4 1 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600 }}>
                    DESGLOSE POR CRITERIO · {delegationLabel(r).toUpperCase()}
                  </span>
                  {criteria.map((k) => {
                    const value = r.criteria_averages[k.id] ?? 0;
                    const scaleMax = rubric?.scale_max ?? 4;
                    return (
                      <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 46px 1.6fr 52px', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{k.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{k.weight}%</span>
                        <ProgressBar percent={(value / scaleMax) * 100} color="var(--un-blue)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', textAlign: 'right' }}>{value.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
                {roleWeights.length > 1 && (
                  <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600 }}>DESGLOSE POR ROL</span>
                    {roleWeights.map(([role, weight]) => {
                      const value = r.role_scores?.[role] ?? null;
                      return (
                        <div key={role} style={{ display: 'grid', gridTemplateColumns: '1.4fr 46px 1.4fr 52px', gap: 14, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{VOTER_ROLE_LABELS[role]}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{weight}%</span>
                          <ProgressBar percent={value ?? 0} color="var(--gold)" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: value === null ? 'var(--state-none-dot)' : 'var(--navy)', textAlign: 'right' }}>
                            {formatScore(value)}
                          </span>
                        </div>
                      );
                    })}
                    {roleWeights.some(([role]) => (r.role_scores?.[role] ?? null) === null) && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                        Un rol sin votos («—») no cuenta como 0: su peso se reparte entre los demás roles.
                      </span>
                    )}
                  </div>
                )}
                {(r.tied || r.manual_tiebreak) && (
                  <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600 }}>DESEMPATE</span>
                    {r.tied ? (
                      <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                        Empata con{' '}
                        {tiedWith(r)
                          .filter((x) => x.delegation_id !== r.delegation_id)
                          .map(delegationLabel)
                          .join(', ')}{' '}
                        incluso por el criterio de mayor peso. El empate lo decides tú.
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>
                        Lugar decidido por ti en un empate. Cambia el orden o deshazlo.
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                      {r.tied && (
                        <Button variant="secondary" onClick={() => putFirst(r)} disabled={eventClosed || setTiebreak.isPending}>
                          Gana el desempate
                        </Button>
                      )}
                      {r.manual_tiebreak && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => move(r, -1)}
                            disabled={eventClosed || setTiebreak.isPending || manualGroupOf(r)[0]?.delegation_id === r.delegation_id}
                          >
                            Subir
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => move(r, 1)}
                            disabled={eventClosed || setTiebreak.isPending || manualGroupOf(r).at(-1)?.delegation_id === r.delegation_id}
                          >
                            Bajar
                          </Button>
                          <Button variant="danger" onClick={() => undoTiebreak(r)} disabled={eventClosed || setTiebreak.isPending}>
                            Deshacer desempate
                          </Button>
                        </>
                      )}
                    </div>
                    {eventClosed && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>El evento está cerrado: el ranking ya no cambia.</span>
                    )}
                    {tiebreakError && <span style={{ color: '#C0392B', fontSize: 12 }}>{tiebreakError}</span>}
                  </div>
                )}
                {r.incomplete_flags.length > 0 && (
                  <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 600 }}>AVISOS</span>
                    {r.incomplete_flags.map((f, i) => (
                      <StatusBadge key={i} tone="progress" label={incompleteFlagLabel(f, r)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {results.length === 0 && (
        <div style={{ padding: 26, fontSize: 13, color: 'var(--muted)' }}>Todavía no hay calificaciones para este comité.</div>
      )}

      <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>PREMIOS</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {AWARD_TYPES.flatMap(({ id, label }) => {
            const slots = awardSlots(id);
            return Array.from({ length: slots }, (_, i) => i + 1).map((position) => (
              <div key={`${id}-${position}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Select
                  label={slots > 1 ? `${label} ${position}` : label}
                  value={awardFor(id, position)}
                  onChange={(e) => setAward(id, position, e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {results.map((r) => (
                    <option key={r.delegation_id} value={r.delegation_id}>
                      {delegationLabel(r)}
                    </option>
                  ))}
                </Select>
              </div>
            ));
          })}
        </div>
        {awardsError && <span style={{ color: '#C0392B', fontSize: 12 }}>{awardsError}</span>}
        <Button style={{ alignSelf: 'flex-start' }} onClick={saveAwards} disabled={!awardsDraft || setAwards.isPending}>
          {setAwards.isPending ? 'Guardando…' : 'Guardar premios'}
        </Button>
      </div>

      {settings && (
        <div style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>PUBLICACIÓN</span>
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              <Select
                label="Formato de nombre"
                value={settings.name_format}
                onChange={(e) => patchSettings({ name_format: e.target.value as PublicNameFormat })}
              >
                {Object.entries(NAME_FORMAT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {(
                [
                  ['show_institution', 'Mostrar institución'],
                  ['show_ranking', 'Mostrar ranking'],
                  ['show_scores', 'Mostrar puntajes'],
                  ['indexable', 'Permitir indexado (SEO)'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
                  <Toggle checked={settings[key]} onClick={() => patchSettings({ [key]: !settings[key] })} />
                </div>
              ))}
            </div>
            {pubError && <span style={{ color: '#C0392B', fontSize: 12 }}>{pubError}</span>}
            {pubNotice && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{pubNotice}</span>}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => { setShowPreview(true); refetchPreview(); }}>
                Actualizar vista previa
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishEvent.isPending || event?.status !== 'closed'}
                title={event?.status !== 'closed' ? 'Solo se puede publicar un evento cerrado.' : undefined}
              >
                {publishEvent.isPending ? 'Publicando…' : 'Publicar resultados'}
              </Button>
              <Button variant="danger" onClick={handleUnpublish} disabled={unpublishEvent.isPending}>
                Despublicar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPreview && preview && (
        <div style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>
            VISTA PREVIA DEL DOCUMENTO PÚBLICO · v{preview.version}
          </span>
          {preview.committees.map((c) => (
            <div key={c.slug} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 600, color: 'var(--navy)' }}>{c.name}</span>
              {c.awards.map((a, i) => (
                <span key={i} style={{ fontSize: 12, color: 'var(--ink)' }}>
                  {AWARD_TYPES.find((t) => t.id === a.award_type)?.label ?? a.award_type}:{' '}
                  {a.delegation.character_name ?? a.delegation.country_code} — {a.delegates.join(', ') || 'Sin delegados visibles'}
                </span>
              ))}
              {c.awards.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin premios asignados.</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

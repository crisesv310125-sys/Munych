import { useEffect, useMemo, useState } from 'react';
import { Button } from '@munych/ui/components/Button';
import { Checkbox } from '@munych/ui/components/SelectionControls';
import { Medal } from '@munych/ui/components/Medal';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import {
  useAddStaffAward,
  useAssignStaffAward,
  useConfirmStaffAwards,
  useStaffRanking,
  useUpdateStaffAward,
} from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import { downloadBlob } from '../../../lib/voterSheets';
import type { StaffAward, StaffAwardScope, StaffAwardSlot, StaffRankingRow, StaffTypeDetail } from '../../../data-access/staffTypes';
import type { TopActions } from './StaffTypePage';
import { AwardChip, ErrorBadge } from './staffUi';
import { EVALUATES, awardScopeLabel, formatNumber, selectionLabel } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '50px 2.2fr 1fr 80px 1.5fr';

interface SlotRef {
  award: StaffAward;
  slot: StaffAwardSlot;
}

const slotKey = (awardId: string, slot: Pick<StaffAwardSlot, 'committee_id' | 'position'>) => `${awardId}:${slot.committee_id ?? ''}:${slot.position}`;

export function AwardsTab({
  type,
  eventId,
  eventName,
  setActions,
}: {
  type: StaffTypeDetail;
  eventId: string;
  eventName: string | null;
  setActions: TopActions;
}) {
  const [committeeId, setCommitteeId] = useState('');
  const { data: ranking, isLoading } = useStaffRanking(type.id, eventId, committeeId);
  const assign = useAssignStaffAward();
  const confirm = useConfirmStaffAwards(type.id, eventId);
  const [selected, setSelected] = useState<string | null>(null);
  const [override, setOverride] = useState<{ ref: SlotRef; row: StaffRankingRow } | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const awards = ranking?.awards ?? type.awards;
  const confirmed = !!(ranking?.awards_confirmed_at ?? type.awards_confirmed_at);
  const hasPerCommittee = awards.some((a) => a.scope === 'per_committee');
  const scopeCommittees = type.all_committees ? type.committees : type.committees.filter((c) => type.committee_ids.includes(c.id));

  // Lugares visibles en el panel: los del comité filtrado (o todos).
  const slots: SlotRef[] = useMemo(
    () =>
      awards.flatMap((award) =>
        award.slots
          .filter((s) => !committeeId || s.committee_id === null || s.committee_id === committeeId)
          .map((slot) => ({ award, slot })),
      ),
    [awards, committeeId],
  );
  const missing = awards.reduce((n, a) => n + a.slots_total - a.slots_assigned, 0);
  const selectedRef = slots.find((r) => slotKey(r.award.id, r.slot) === selected) ?? slots.find((r) => !r.slot.candidate_id) ?? null;

  useEffect(() => {
    setActions(
      <Button variant="secondary" disabled={!ranking?.rows.length} onClick={() => ranking && exportRanking(type, ranking.rows)}>
        Exportar ranking
      </Button>,
    );
  }, [ranking, setActions, type]);

  async function doAssign(ref: SlotRef, candidateId: string | null, overrideReason?: string) {
    setError('');
    try {
      await assign.mutateAsync({
        awardId: ref.award.id,
        body: { event_id: eventId, committee_id: ref.slot.committee_id, position: ref.slot.position, candidate_id: candidateId, override_reason: overrideReason ?? null },
      });
      setSelected(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  /** Asigna un candidato del ranking al lugar elegido; si no es el sugerido, pide motivo. */
  function assignRow(row: StaffRankingRow, ref: SlotRef | null = selectedRef) {
    if (!ref || confirmed) return;
    if (ref.award.scope === 'per_committee' && ref.slot.committee_id !== row.committee_id) {
      setError(`Ese lugar es de ${ref.slot.committee_acronym}; elige un candidato de ese comité.`);
      return;
    }
    if (ref.slot.suggested_candidate_id === row.candidate_id && row.eligible) {
      void doAssign(ref, row.candidate_id);
      return;
    }
    setOverride({ ref, row });
  }

  async function handleConfirm(value: boolean) {
    setError('');
    try {
      await confirm.mutateAsync({ confirmed: value, eventId });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const candidatesLabel = type.evaluates ? EVALUATES[type.evaluates].candidates : 'candidatos';

  return (
    <div className={shared.layoutSplit}>
      <div className={shared.content} style={{ flex: 1 }}>
        <div className={styles.awardCards}>
          {awards.map((a, i) => (
            <AwardCard key={a.id} award={a} index={i} awards={awards} type={type} eventId={eventId} confirmed={confirmed} onError={setError} />
          ))}
          {awards.length === 0 && <span className={styles.small}>Este staff todavía no entrega premios.</span>}
        </div>
        {!confirmed &&
          (adding ? (
            <NewAwardForm type={type} eventId={eventId} onDone={() => setAdding(false)} />
          ) : (
            <button className={styles.linkBtn} style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
              + Añadir premio
            </button>
          ))}

        <div className={shared.panelCard}>
          <div className={shared.panelHeader} style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className={shared.panelTitle}>Ranking de candidatos · {candidatesLabel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={styles.small}>Promedio de evaluadores, normalizado a 0–100</span>
              {(hasPerCommittee || scopeCommittees.length > 1) && (
                <select className={styles.input} style={{ width: 'auto' }} value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} aria-label="Filtrar por comité">
                  <option value="">Todos los comités</option>
                  {scopeCommittees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.acronym}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className={tableStyles.scrollWrap}>
            <div style={{ minWidth: 620 }}>
              <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
                <span>Pos.</span>
                <span>Candidato · comité</span>
                <span>Evaluaciones</span>
                <span style={{ textAlign: 'right' }}>Nota</span>
                <span style={{ textAlign: 'right' }}>Premio</span>
              </div>
              {isLoading && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>Cargando…</span>
                </div>
              )}
              {!isLoading && (ranking?.rows.length ?? 0) === 0 && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>
                    {type.evaluates ? 'No hay candidatos en el alcance de este staff.' : 'Configura a quién evalúa este staff.'}
                  </span>
                </div>
              )}
              {ranking?.rows.map((r) => (
                <RankingRow
                  key={r.candidate_id}
                  row={r}
                  min={ranking.min_evaluators}
                  canAssign={!confirmed && !!selectedRef}
                  suggestedFor={slots.find((s) => !s.slot.candidate_id && s.slot.suggested_candidate_id === r.candidate_id)}
                  onAssign={(ref) => assignRow(r, ref)}
                />
              ))}
            </div>
          </div>
        </div>
        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}
      </div>

      <aside className={styles.side}>
        <span className={styles.sideTitle}>Premios de {type.name}</span>
        {eventName && <span className={styles.small}>En {eventName}. Cada evento asigna y confirma los suyos.</span>}
        {slots.length === 0 && <span className={styles.small}>Añade un premio para empezar.</span>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '48vh', overflowY: 'auto' }}>
          {slots.map((ref) => {
            const { award, slot } = ref;
            const key = slotKey(award.id, slot);
            const label = `${award.name}${award.winners > 1 ? ` · ${slot.position}` : ''}${slot.committee_acronym ? ` · ${slot.committee_acronym}` : ''}`;
            const isSelected = selectedRef && slotKey(selectedRef.award.id, selectedRef.slot) === key;
            return (
              <div
                key={key}
                className={`${styles.slotRow} ${slot.candidate_id ? '' : styles.slotRowPending}`}
                style={isSelected && !slot.candidate_id ? { borderColor: 'var(--un-blue)', borderStyle: 'solid' } : undefined}
                onClick={() => setSelected(key)}
              >
                <Checkbox checked={!!slot.candidate_id} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: slot.candidate_id ? 'var(--ink)' : 'var(--muted)' }}>{label}</span>
                  <span className={styles.small}>
                    {slot.candidate_id
                      ? `${slot.candidate_label}${slot.candidate_score != null ? ` · ${slot.candidate_score.toFixed(2)}` : ''}${slot.override_reason ? ' · elegido por el admin' : ''}`
                      : slot.suggested_label
                        ? `Sugerido: ${slot.suggested_label}${slot.suggested_score != null ? ` · ${slot.suggested_score.toFixed(2)}` : ''}`
                        : 'Sin sugerencia (faltan evaluaciones)'}
                  </span>
                </div>
                {!confirmed && !slot.candidate_id && slot.suggested_candidate_id && (
                  <button
                    className={styles.linkBtn}
                    disabled={assign.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      void doAssign(ref, slot.suggested_candidate_id);
                    }}
                  >
                    Asignar
                  </button>
                )}
                {!confirmed && slot.candidate_id && (
                  <button
                    className={styles.linkBtn}
                    style={{ color: 'var(--muted)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void doAssign(ref, null);
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!confirmed && selectedRef && !selectedRef.slot.candidate_id && (
          <span className={styles.small}>
            Para dar «{selectedRef.award.name}» a otra persona, usa «Asignar» en su fila del ranking.
          </span>
        )}

        <div className={styles.calloutGold}>
          La nota de la rúbrica <strong>solo sugiere</strong>. El admin confirma cada premio; puede elegir a otro candidato si lo justifica.
        </div>
        <div className={styles.calloutInfo}>
          Los premios de staff salen en el acta en una sección <strong>Premios especiales</strong>, después del resumen de premiación.
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {confirmed ? (
            <>
              <StatusBadge tone="done" label="PREMIOS CONFIRMADOS" />
              <Button variant="secondary" fullWidth disabled={confirm.isPending} onClick={() => handleConfirm(false)}>
                Reabrir premios
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth disabled={missing > 0 || awards.length === 0 || confirm.isPending} onClick={() => handleConfirm(true)}>
                Confirmar premios de {type.name}
              </Button>
              {missing > 0 && (
                <span className={styles.small} style={{ textAlign: 'center' }}>
                  Falta asignar {missing} premio{missing === 1 ? '' : 's'}
                </span>
              )}
            </>
          )}
        </div>
      </aside>

      {override && (
        <ConfirmDialog
          title="Asignar a otro candidato"
          message={
            override.row.eligible
              ? `La rúbrica sugiere a ${override.ref.slot.suggested_label ?? 'otra persona'} para «${override.ref.award.name}». ¿Asignarlo a ${override.row.label}? Se guardará quién lo asignó y el sugerido.`
              : `${override.row.label} tiene ${override.row.evaluations} de ${ranking?.min_evaluators ?? 1} evaluaciones mínimas. ¿Asignarle «${override.ref.award.name}» de todos modos?`
          }
          onClose={() => setOverride(null)}
          actions={[
            { label: 'Cancelar', onClick: () => setOverride(null) },
            {
              label: 'Asignar',
              onClick: () => {
                const { ref, row } = override;
                setOverride(null);
                void doAssign(ref, row.candidate_id, row.eligible ? 'Elegido por el admin' : 'Elegido por el admin con evaluaciones insuficientes');
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function RankingRow({
  row: r,
  min,
  canAssign,
  suggestedFor,
  onAssign,
}: {
  row: StaffRankingRow;
  min: number;
  canAssign: boolean;
  suggestedFor?: SlotRef;
  onAssign: (ref?: SlotRef) => void;
}) {
  const insufficient = r.evaluations < min;
  return (
    <div className={`${tableStyles.row} ${r.position === 1 ? styles.firstRow : ''}`} style={{ gridTemplateColumns: COLS }}>
      <span>{r.position ? <Medal position={r.position} size={30} /> : <span className={styles.faint}>—</span>}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className={styles.serifName}>{r.label}</span>
        <span className={styles.small}>
          {[r.sublabel, r.committee_acronym].filter(Boolean).join(' · ')}
        </span>
      </div>
      <span style={{ fontSize: 12.5, fontWeight: insufficient ? 600 : 400 }} className={insufficient ? styles.errorText : ''}>
        {r.evaluations} de {min} mín.
      </span>
      <span
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 20,
          fontWeight: 600,
          textAlign: 'right',
          color: r.eligible ? 'var(--navy)' : 'var(--state-none-dot)',
        }}
      >
        {r.score != null ? r.score.toFixed(2) : '—'}
      </span>
      <span style={{ justifySelf: 'end', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {r.awards.map((name, i) => (
          <AwardChip key={name + i} tone={i === 0 && r.position === 1 ? 'gold' : 'green'}>
            ✓ {name}
          </AwardChip>
        ))}
        {r.awards.length === 0 && r.evaluations === 0 && <StatusBadge tone="none" label="SIN EVALUAR" />}
        {r.awards.length === 0 && r.evaluations > 0 && insufficient && <ErrorBadge label="FALTAN EVALUACIONES" />}
        {r.awards.length === 0 && canAssign && r.evaluations > 0 && (
          <button className={styles.linkBtn} onClick={() => onAssign(suggestedFor)}>
            {suggestedFor ? `Asignar ${suggestedFor.award.name.toLowerCase()} ›` : 'Asignar ›'}
          </button>
        )}
        {r.awards.length === 0 && !canAssign && r.evaluations > 0 && !insufficient && <span className={styles.faint}>—</span>}
      </span>
    </div>
  );
}

function AwardCard({
  award: a,
  index,
  awards,
  type,
  eventId,
  confirmed,
  onError,
}: {
  award: StaffAward;
  index: number;
  awards: StaffAward[];
  type: StaffTypeDetail;
  eventId: string;
  confirmed: boolean;
  onError: (msg: string) => void;
}) {
  const update = useUpdateStaffAward(eventId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const tiebreak = type.rubric.criteria.find((c) => c.id === a.tiebreak_criterion_id);
  const done = a.slots_assigned >= a.slots_total;

  async function patch(body: Parameters<typeof update.mutateAsync>[0]['body']) {
    try {
      await update.mutateAsync({ awardId: a.id, body });
    } catch (err) {
      onError(errorMessage(err));
    }
  }

  return (
    <div className={styles.awardCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 600 }}>PREMIO</span>
        {done ? <StatusBadge tone="done" label="ASIGNADO" /> : <StatusBadge tone={a.slots_assigned ? 'progress' : 'none'} label={`${a.slots_assigned} DE ${a.slots_total}`} />}
      </div>
      <span className={styles.awardName}>{a.name}</span>
      <div className={styles.kv}>
        <span>Ganadores</span>
        <span>
          {a.winners}
          {a.scope === 'per_committee' ? ' por comité' : ''}
        </span>
        <span>Ámbito</span>
        <span>{awardScopeLabel(a)}</span>
        <span>Selección</span>
        <span>{selectionLabel(awards, index)}</span>
        <span>Desempate</span>
        {confirmed ? (
          <span>{tiebreak?.name ?? 'Decide el admin'}</span>
        ) : (
          <select
            className={styles.input}
            style={{ padding: '3px 6px', fontSize: 12 }}
            value={a.tiebreak_criterion_id ?? ''}
            onChange={(e) => patch({ tiebreak_criterion_id: e.target.value || null })}
            aria-label="Criterio de desempate"
          >
            <option value="">Decide el admin</option>
            {type.rubric.criteria.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {!confirmed && (
        <button className={styles.linkBtn} style={{ color: 'var(--muted)', alignSelf: 'flex-start', fontWeight: 500 }} onClick={() => setConfirmArchive(true)}>
          Quitar premio
        </button>
      )}
      {confirmArchive && (
        <ConfirmDialog
          title="Quitar premio"
          message={`«${a.name}» dejará de aparecer en este staff y en el acta. Sus asignaciones se conservan en el historial.`}
          onClose={() => setConfirmArchive(false)}
          actions={[
            { label: 'Cancelar', onClick: () => setConfirmArchive(false) },
            {
              label: 'Quitar',
              variant: 'danger',
              onClick: () => {
                setConfirmArchive(false);
                void patch({ archived: true });
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function NewAwardForm({ type, eventId, onDone }: { type: StaffTypeDetail; eventId: string; onDone: () => void }) {
  const add = useAddStaffAward(type.id, eventId);
  const [name, setName] = useState('');
  const [winners, setWinners] = useState(1);
  const [scope, setScope] = useState<StaffAwardScope>('event');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    try {
      await add.mutateAsync({ name: name.trim(), winners, scope });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className={styles.awardCard} style={{ gap: 10 }}>
      <div className={styles.awardEditRow} style={{ gridTemplateColumns: '1fr 70px 150px' }}>
        <input className={styles.input} placeholder="Nombre del premio" value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
        <input
          className={styles.input}
          type="number"
          min={1}
          max={20}
          value={winners}
          aria-label="Ganadores"
          onChange={(e) => setWinners(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          style={{ textAlign: 'center' }}
        />
        <select className={styles.input} value={scope} onChange={(e) => setScope(e.target.value as StaffAwardScope)}>
          <option value="event">Todo el evento</option>
          <option value="per_committee">Por comité</option>
        </select>
      </div>
      {error && <span style={{ color: '#C0392B', fontSize: 12 }}>{error}</span>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button disabled={!name.trim() || add.isPending} onClick={submit}>
          Añadir premio
        </Button>
      </div>
    </div>
  );
}

function exportRanking(type: StaffTypeDetail, rows: StaffRankingRow[]) {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const data = [
    ['Posición', 'Candidato', 'Detalle', 'Comité', 'Evaluaciones', 'Nota (0-100)', 'Premios'],
    ...rows.map((r) => [
      r.position ? String(r.position) : '',
      r.label,
      r.sublabel ?? '',
      r.committee_acronym,
      String(r.evaluations),
      r.score != null ? formatNumber(Math.round(r.score * 100) / 100) : '',
      r.awards.join(' / '),
    ]),
  ];
  const csv = '﻿' + data.map((r) => r.map(esc).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `staff-${type.code.toLowerCase()}-ranking.csv`);
}

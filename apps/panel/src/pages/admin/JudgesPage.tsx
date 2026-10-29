import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { Input } from '@munych/ui/components/FormControls';
import { useCommittees, useInviteJudge, useJudges } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { getCommitteeJudges, getCommitteeProgress, setCommitteeJudges } from '../../data-access/endpoints';
import { queryKeys } from '../../data-access/queryClient';
import type { ApiCommittee, ApiJudge } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import { PendingInvitations } from './PendingInvitations';
import tableStyles from '@munych/ui/components/Table.module.css';

const COLS = '2fr 1.8fr 1.6fr 1fr 80px';
const AVATAR_COLORS = ['var(--navy)', 'var(--navy-light)', 'var(--un-blue)', 'var(--muted)'];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

const EMPTY_INVITE = { name: '', email: '' };

/** Cruza las asignaciones y el avance por comité (uno y otro escopeados por comité en el contrato)
 * para poder mostrar, por juez, a qué comités está asignado y su avance combinado. */
function useJudgeAssignments(committees: ApiCommittee[]) {
  const assignmentQueries = useQueries({
    queries: committees.map((c) => ({ queryKey: queryKeys.committeeJudges(c.id), queryFn: () => getCommitteeJudges(c.id) })),
  });
  const progressQueries = useQueries({
    queries: committees.map((c) => ({ queryKey: queryKeys.committeeProgress(c.id), queryFn: () => getCommitteeProgress(c.id) })),
  });

  const committeesByJudge = new Map<string, ApiCommittee[]>();
  const progressByJudge = new Map<string, { scored: number; expected: number }>();
  committees.forEach((committee, i) => {
    const assignments = assignmentQueries[i]?.data ?? [];
    const progress = progressQueries[i]?.data;
    assignments.forEach((a) => {
      committeesByJudge.set(a.judge_id, [...(committeesByJudge.get(a.judge_id) ?? []), committee]);
      const agg = progressByJudge.get(a.judge_id) ?? { scored: 0, expected: 0 };
      progress?.sessions.forEach((s) => {
        const judgeStat = s.judges.find((j) => j.judge_id === a.judge_id);
        if (judgeStat) {
          agg.scored += judgeStat.scored;
          agg.expected += judgeStat.expected;
        }
      });
      progressByJudge.set(a.judge_id, agg);
    });
  });

  return { committeesByJudge, progressByJudge, assignmentQueries };
}

export function JudgesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const { data: judges } = useJudges(eventId);
  const { data: committees } = useCommittees(eventId);
  const inviteJudge = useInviteJudge();
  const list = committees ?? [];
  const { committeesByJudge, progressByJudge } = useJudgeAssignments(list);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftCommittees, setDraftCommittees] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [saveError, setSaveError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const judgeList = judges ?? [];
  const selected = judgeList.find((j) => j.judge_id === selectedId);
  const activeCount = judgeList.filter((j) => j.active).length;

  useEffect(() => {
    if (!selectedId && judgeList.length > 0) selectJudge(judgeList[0].judge_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgeList.length]);

  function judgeProgressLabel(judgeId: string): string {
    const agg = progressByJudge.get(judgeId);
    if (!agg || agg.expected === 0) return '—';
    return `${Math.round((agg.scored / agg.expected) * 100)}%`;
  }

  function selectJudge(id: string) {
    setIsInviting(false);
    setSaveError('');
    setSelectedId(id);
    setDraftCommittees((committeesByJudge.get(id) ?? []).map((c) => c.id));
  }

  function toggleCommittee(id: string) {
    setDraftCommittees((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!selected) return;
    setSaveError('');
    setSaving(true);
    const judgeId = selected.judge_id;
    const before = new Set((committeesByJudge.get(judgeId) ?? []).map((c) => c.id));
    const after = new Set(draftCommittees);
    const changed = list.filter((c) => before.has(c.id) !== after.has(c.id));
    try {
      for (const committee of changed) {
        // PUT reemplaza todas las asignaciones del comité: se parte de las actuales para no perder a otros jueces.
        const current = await getCommitteeJudges(committee.id);
        const next = after.has(committee.id)
          ? [...current.filter((a) => a.judge_id !== judgeId), { judge_id: judgeId, role: 'judge' as const }]
          : current.filter((a) => a.judge_id !== judgeId);
        await setCommitteeJudges(committee.id, next);
        qc.invalidateQueries({ queryKey: queryKeys.committeeJudges(committee.id) });
        qc.invalidateQueries({ queryKey: queryKeys.committeeProgress(committee.id) });
      }
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openInvite() {
    setInvite(EMPTY_INVITE);
    setSaveError('');
    setInviteNotice('');
    setIsInviting(true);
  }

  function closeInvite() {
    setIsInviting(false);
    setInvite(EMPTY_INVITE);
  }

  async function handleInviteSave() {
    const full_name = invite.name.trim();
    const email = invite.email.trim();
    if (!full_name || !email) return;
    setSaveError('');
    try {
      await inviteJudge.mutateAsync({ email, full_name, event_id: eventId });
      closeInvite();
      // La API solo lista jueces que ya aceptaron la invitación: aún no se puede seleccionar.
      setInviteNotice(`Invitación enviada a ${email}. ${full_name} aparecerá en la lista cuando la acepte; mientras, la verás en «Invitaciones pendientes».`);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  const overAssigned = draftCommittees.length > 3;
  const canInvite = invite.name.trim().length > 0 && invite.email.trim().length > 0;

  function avatarColorFor(judge: ApiJudge) {
    return AVATAR_COLORS[judgeList.indexOf(judge) % AVATAR_COLORS.length];
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar} style={{ background: 'var(--navy)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle} style={{ color: '#FFFFFF' }}>
            Jueces
          </span>
          <span className={styles.topbarSub} style={{ color: '#FFFFFF' }}>
            {judgeList.length} registrados · {activeCount} activos
          </span>
        </div>
        <Button variant="gold" onClick={openInvite}>
          + Invitar juez
        </Button>
      </div>
      <div className={styles.layoutSplit}>
        <div className={styles.tableFlex}>
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <span>Juez</span>
            <span>Correo</span>
            <span>Comités</span>
            <span>Avance</span>
            <span />
          </div>
          {inviteNotice && (
            <div role="status" style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ink)', background: 'var(--surface-2, #F3F5F9)' }}>
              {inviteNotice}
            </div>
          )}
          {judgeList.map((j) => {
            const committeeAcronyms = (committeesByJudge.get(j.judge_id) ?? []).map((c) => c.acronym);
            return (
              <div key={j.judge_id} className={`${tableStyles.row} ${j.judge_id === selectedId ? tableStyles.rowSelected : ''}`} style={{ gridTemplateColumns: COLS }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initials={initialsFor(j.full_name)} size={30} color={avatarColorFor(j)} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{j.full_name}</span>
                </div>
                <span className={tableStyles.mutedCell}>{j.email ?? '—'}</span>
                <span className={tableStyles.mutedCell} style={committeeAcronyms.length === 0 ? { color: 'var(--state-none-dot)' } : undefined}>
                  {committeeAcronyms.length > 0 ? committeeAcronyms.join(' · ') : 'Sin asignar'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: committeeAcronyms.length === 0 ? 'var(--state-none-dot)' : 'var(--ink)' }}>
                  {judgeProgressLabel(j.judge_id)}
                </span>
                <button className={tableStyles.linkAction} onClick={() => selectJudge(j.judge_id)}>
                  Asignar
                </button>
              </div>
            );
          })}
          <PendingInvitations eventId={eventId} />
        </div>
        {isInviting ? (
          <div className={`${styles.sidePanel} ${styles.sidePanelNarrow}`}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Invitar juez</span>
                <button
                  onClick={closeInvite}
                  style={{ background: 'none', border: 'none', color: 'var(--state-none-dot)', fontSize: 16, cursor: 'pointer' }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <Input label="Nombre completo" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
                <Input
                  label="Correo"
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Se le enviará una invitación de Supabase con enlace mágico; no se define contraseña aquí.
                </span>
                {saveError && <span style={{ color: '#C0392B', fontSize: 13 }}>{saveError}</span>}
              </div>
              <div className={styles.modalFooter}>
                <Button variant="danger" onClick={closeInvite}>
                  Cancelar
                </Button>
                <Button onClick={handleInviteSave} disabled={!canInvite || inviteJudge.isPending}>
                  Enviar invitación
                </Button>
              </div>
            </div>
          </div>
        ) : selected && (
          <div className={`${styles.sidePanel} ${styles.sidePanelNarrow}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials={initialsFor(selected.full_name)} size={40} color={avatarColorFor(selected)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>{selected.full_name}</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>ASIGNAR A COMITÉS</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((c) => {
                const checked = draftCommittees.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleCommittee(c.id)}
                    style={{
                      background: 'var(--white)',
                      border: `1px solid ${checked ? 'var(--navy)' : 'var(--border)'}`,
                      borderRadius: 9,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? 'var(--ink)' : 'var(--muted)' }}>{c.name}</span>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        background: checked ? 'var(--navy)' : 'transparent',
                        border: checked ? 'none' : '1px solid var(--border-input)',
                        color: '#FFFFFF',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked && '✓'}
                    </span>
                  </div>
                );
              })}
            </div>
            {overAssigned && (
              <div style={{ background: 'var(--callout-bg)', border: '1px solid var(--callout-border)', borderRadius: 9, padding: '12px 14px', fontSize: 12, color: 'var(--callout-fg)', lineHeight: 1.5 }}>
                Un juez asignado a más de 3 comités difícilmente completa sus calificaciones a tiempo.
              </div>
            )}
            {saveError && <span style={{ color: '#C0392B', fontSize: 12 }}>{saveError}</span>}
            <Button style={{ marginTop: 'auto' }} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar asignación'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

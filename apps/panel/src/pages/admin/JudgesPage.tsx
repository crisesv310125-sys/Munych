import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { Input, Select } from '@munych/ui/components/FormControls';
import { useCommittees, useEvent, useJudges } from '../../data-access/hooks';
import { useInviteToEvent, useStaffOverview } from '../../data-access/staffHooks';
import { EventStaffList } from './staff/EventStaffList';
import { committeeRoleLabel, committeeRoleOptions, delegatesVote } from '../../lib/statusLabels';
import { errorMessage } from '../../data-access/errors';
import { getCommitteeJudges, getCommitteeProgress, setCommitteeJudges } from '../../data-access/endpoints';
import { queryKeys } from '../../data-access/queryClient';
import type { ApiCommittee, ApiJudge, JudgeCommitteeRole } from '../../data-access/apiTypes';
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

const EMPTY_INVITE = { name: '', email: '', title: '' };

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
  /** Rol de cada juez en cada comité, con clave `${judge_id}:${committee_id}`. */
  const roleByAssignment = new Map<string, JudgeCommitteeRole>();
  committees.forEach((committee, i) => {
    const assignments = assignmentQueries[i]?.data ?? [];
    const progress = progressQueries[i]?.data;
    assignments.forEach((a) => {
      roleByAssignment.set(`${a.judge_id}:${committee.id}`, a.role);
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

  return { committeesByJudge, progressByJudge, roleByAssignment, assignmentQueries };
}

export function JudgesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const { data: judges } = useJudges(eventId);
  const { data: committees } = useCommittees(eventId);
  const { data: event } = useEvent(eventId);
  const inviteToEvent = useInviteToEvent(eventId ?? '');
  const { data: staffOverview } = useStaffOverview(eventId ?? '');
  const staffTypes = staffOverview?.types ?? [];
  // «Juez» solo en los tipos de evento que tienen jueces (no en un MUN regular).
  const eventHasJudges = event?.event_type !== 'mun_regular';
  const [inviteRole, setInviteRole] = useState<string>('');
  const [inviteCommittees, setInviteCommittees] = useState<string[]>([]);
  const list = committees ?? [];
  const { committeesByJudge, progressByJudge, roleByAssignment } = useJudgeAssignments(list);
  // Con votación por roles, la cuenta se asigna como juez, mesa o staff (ver statusLabels).
  const roleOptions = committeeRoleOptions(event?.event_type);
  const showRoles = delegatesVote(event?.event_type);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftCommittees, setDraftCommittees] = useState<string[]>([]);
  const [draftRole, setDraftRole] = useState<JudgeCommitteeRole>('judge');
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
    const assigned = committeesByJudge.get(id) ?? [];
    setDraftCommittees(assigned.map((c) => c.id));
    const current = assigned.length > 0 ? roleByAssignment.get(`${id}:${assigned[0].id}`) : undefined;
    const normalized = current === 'moderator' ? 'chair' : current;
    setDraftRole(roleOptions.find((o) => o.value === normalized)?.value ?? roleOptions[0].value);
  }

  function judgeRoleLabel(judgeId: string): string {
    const first = committeesByJudge.get(judgeId)?.[0];
    const role = first && roleByAssignment.get(`${judgeId}:${first.id}`);
    return role ? committeeRoleLabel(role) : '';
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
    const roleChanged = (committeeId: string) => {
      const current = roleByAssignment.get(`${judgeId}:${committeeId}`);
      // `moderator` también es mesa: no se reescribe si se eligió «Mesa Directiva».
      return (current === 'moderator' ? 'chair' : current) !== draftRole;
    };
    // En «solo jueces» el rol no cuenta: no se reescriben las asignaciones existentes.
    const changed = list.filter((c) => before.has(c.id) !== after.has(c.id) || (showRoles && after.has(c.id) && roleChanged(c.id)));
    try {
      for (const committee of changed) {
        // PUT reemplaza todas las asignaciones del comité: se parte de las actuales para no perder a otros jueces.
        const current = await getCommitteeJudges(committee.id);
        const next = after.has(committee.id)
          ? [...current.filter((a) => a.judge_id !== judgeId), { judge_id: judgeId, role: draftRole }]
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
    setInviteRole(eventHasJudges ? 'judge' : '');
    setInviteCommittees([]);
    setSaveError('');
    setInviteNotice('');
    setIsInviting(true);
  }

  function closeInvite() {
    setIsInviting(false);
    setInvite(EMPTY_INVITE);
  }

  function toggleInviteCommittee(id: string) {
    setInviteCommittees((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleInviteSave() {
    const full_name = invite.name.trim();
    const email = invite.email.trim();
    if (!full_name || !email || !inviteRole) return;
    setSaveError('');
    try {
      const out = await inviteToEvent.mutateAsync({
        full_name,
        email,
        role: inviteRole === 'judge' ? 'judge' : 'staff',
        staff_type_id: inviteRole === 'judge' ? null : inviteRole,
        committee_ids: inviteCommittees,
        title: invite.title.trim() || null,
      });
      closeInvite();
      // Juez y mesa: la API solo los lista cuando aceptan la invitación (crean su contraseña).
      setInviteNotice(
        out.kind === 'link'
          ? `Se envió a ${out.email} su QR de acceso de ${out.staff_type}. ${full_name} aparece en «Staff con QR».`
          : `Invitación enviada a ${out.email} para crear su contraseña${out.staff_type ? ` (${out.staff_type})` : ''}. ${full_name} aparecerá en la lista cuando la acepte; mientras, la verás en «Invitaciones pendientes».`,
      );
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  const overAssigned = draftCommittees.length > 3;
  const selectedType = staffTypes.find((t) => t.id === inviteRole);
  const needsCommittee = selectedType?.access === 'account';
  const canInvite =
    invite.name.trim().length > 0 &&
    invite.email.trim().length > 0 &&
    !!inviteRole &&
    (!needsCommittee || inviteCommittees.length > 0);
  const inviteHint =
    inviteRole === 'judge'
      ? 'Recibirá un correo para crear su contraseña y entrar al panel del juez.'
      : !selectedType
        ? 'Elige el rol de la persona.'
        : selectedType.access === 'account'
          ? `Recibirá un correo para crear su contraseña y calificará con rol de mesa en el comité elegido.`
          : `Recibirá un correo con su QR de acceso personal para evaluar como ${selectedType.name} (sin cuenta).`;

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
          + Invitar
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
                  {showRoles && committeeAcronyms.length > 0 && ` (${judgeRoleLabel(j.judge_id)})`}
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
          {/* Decisión de diseño (hito 15): staff que entra con QR (sin cuenta). */}
          <EventStaffList eventId={eventId ?? ''} />
        </div>
        {isInviting ? (
          <div className={`${styles.sidePanel} ${styles.sidePanelNarrow}`}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Invitar al evento</span>
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
                <Select label="Rol" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="" disabled>
                    Elige el rol…
                  </option>
                  {eventHasJudges && <option value="judge">Juez</option>}
                  {staffTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.access === 'account' ? ' (con contraseña)' : ' (QR por correo)'}
                    </option>
                  ))}
                </Select>
                {!eventHasJudges && staffTypes.length === 0 && (
                  <span style={{ fontSize: 11, color: '#C0392B' }}>
                    Este evento no tiene jueces y todavía no hay tipos de staff: créalos en Staff de la organización.
                  </span>
                )}
                {inviteRole && inviteRole !== 'judge' && (
                  <Input
                    label="Puesto (opcional)"
                    placeholder="p. ej. Presidenta de Comité"
                    value={invite.title}
                    onChange={(e) => setInvite({ ...invite, title: e.target.value })}
                  />
                )}
                {inviteRole && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>
                      {needsCommittee ? 'COMITÉ (OBLIGATORIO)' : 'COMITÉS (OPCIONAL)'}
                    </span>
                    {list.map((c) => {
                      const checked = inviteCommittees.includes(c.id);
                      return (
                        <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleInviteCommittee(c.id)} />
                          {c.name}
                        </label>
                      );
                    })}
                    {!needsCommittee && inviteRole !== 'judge' && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sin comités: evalúa en todos los del alcance de su staff.</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{inviteHint}</span>
                {saveError && <span style={{ color: '#C0392B', fontSize: 13 }}>{saveError}</span>}
              </div>
              <div className={styles.modalFooter}>
                <Button variant="danger" onClick={closeInvite}>
                  Cancelar
                </Button>
                <Button onClick={handleInviteSave} disabled={!canInvite || inviteToEvent.isPending}>
                  {inviteToEvent.isPending ? 'Enviando…' : 'Enviar invitación'}
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
            {showRoles && (
              <Select label="Rol en sus comités" value={draftRole} onChange={(e) => setDraftRole(e.target.value as JudgeCommitteeRole)}>
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
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

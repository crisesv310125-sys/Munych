import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { Checkbox, Toggle } from '@munych/ui/components/SelectionControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import {
  useAddStaffMember,
  useIssueStaffLink,
  useRemoveStaffMember,
  useStaffPeople,
  useUpdateStaffMember,
  useUpdateStaffPerson,
} from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import { initialsFor } from '../../../lib/initials';
import { downloadBlob } from '../../../lib/voterSheets';
import type { StaffAccessLink, StaffMember, StaffMemberRole, StaffPerson, StaffTypeDetail } from '../../../data-access/staffTypes';
import type { TopActions } from './StaffTypePage';
import { RoleChip, Segmented } from './staffUi';
import { ACCESS, committeesLabel, staffLinkBase } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '2.6fr 1.2fr 1.1fr 1fr 48px';

type Panel = { mode: 'edit'; memberId: string } | { mode: 'add' } | null;

export function MembersTab({ type, eventId, setActions }: { type: StaffTypeDetail; eventId: string; setActions: TopActions }) {
  const [panel, setPanel] = useState<Panel>(null);
  const active = type.members.filter((m) => !m.removed_at);
  const former = type.members.filter((m) => m.removed_at);
  const scopeCommittees = type.all_committees ? type.committees : type.committees.filter((c) => type.committee_ids.includes(c.id));

  useEffect(() => {
    setActions(
      <>
        <Button variant="secondary" onClick={() => exportMembers(type, scopeCommittees)} disabled={type.members.length === 0}>
          Exportar lista
        </Button>
        <Button onClick={() => setPanel({ mode: 'add' })}>+ Añadir miembro</Button>
      </>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, setActions]);

  const editing = panel?.mode === 'edit' ? type.members.find((m) => m.id === panel.memberId) : undefined;

  return (
    <div className={shared.layoutSplit}>
      <div className={shared.content} style={{ flex: 1 }}>
        {active.length === 0 ? (
          <div className={styles.dashedNote} style={{ textAlign: 'center', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Este staff todavía no tiene miembros</strong>
            <span>Añade al menos un coordinador para poder enviar invitaciones.</span>
            <Button onClick={() => setPanel({ mode: 'add' })} style={{ marginTop: 8 }}>
              + Añadir miembro
            </Button>
          </div>
        ) : (
          <div className={shared.panelCard}>
            <div className={tableStyles.scrollWrap}>
              <div style={{ minWidth: 640 }}>
                <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
                  <span>Miembro · rol</span>
                  <span>Asignado a</span>
                  <span>Evaluados</span>
                  <span>Acceso</span>
                  <span />
                </div>
                {active.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    type={type}
                    selected={editing?.id === m.id}
                    onEdit={() => setPanel({ mode: 'edit', memberId: m.id })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <button className={styles.addCard} onClick={() => setPanel({ mode: 'add' })}>
            <span className={styles.addCardTitle}>+ Añadir otra persona</span>
            <span className={styles.small}>Busca entre el staff y los jueces de la organización, o agrega a alguien nuevo</span>
          </button>
        )}

        {former.length > 0 && <FormerMembers members={former} eventId={eventId} />}
      </div>

      {panel?.mode === 'add' && <AddPanel type={type} eventId={eventId} onClose={() => setPanel(null)} onAdded={(id) => setPanel({ mode: 'edit', memberId: id })} />}
      {editing && <EditPanel key={editing.id} type={type} eventId={eventId} member={editing} scopeCommittees={scopeCommittees} onClose={() => setPanel(null)} />}
    </div>
  );
}

function MemberRow({ member: m, type, selected, onEdit }: { member: StaffMember; type: StaffTypeDetail; selected: boolean; onEdit: () => void }) {
  const percent = m.assigned ? (m.evaluated / m.assigned) * 100 : 0;
  return (
    <div className={`${tableStyles.row} ${selected ? tableStyles.rowSelected : ''}`} style={{ gridTemplateColumns: COLS }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
        <Avatar initials={initialsFor(m.full_name)} size={32} color={m.role === 'coordinator' ? 'var(--navy)' : 'var(--muted)'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{m.full_name}</span>
            <RoleChip role={m.role} title={m.title} />
          </span>
          <span className={styles.small}>{m.email ?? m.title ?? 'Sin correo'}</span>
        </div>
      </div>
      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{committeesLabel(m.committee_ids, type.committees)}</span>
      {m.assigned > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 70 }}>
            <ProgressBar percent={percent} color={percent >= 100 ? 'var(--state-done-dot)' : 'var(--gold)'} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
            {m.evaluated}/{m.assigned}
          </span>
        </div>
      ) : (
        <span className={styles.faint}>—</span>
      )}
      <span>
        <StatusBadge tone={ACCESS[m.access].tone} label={ACCESS[m.access].label} />
      </span>
      <button className={tableStyles.linkAction} onClick={onEdit}>
        Editar
      </button>
    </div>
  );
}

function FormerMembers({ members, eventId }: { members: StaffMember[]; eventId: string }) {
  const update = useUpdateStaffMember(eventId);
  const [error, setError] = useState('');
  async function run(memberId: string, body: { evaluations_count?: boolean; restore?: boolean }) {
    setError('');
    try {
      await update.mutateAsync({ memberId, body });
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className={shared.panelCard}>
      <div className={shared.panelHeader}>
        <span className={shared.panelTitle}>Exmiembros</span>
        <span className={styles.small}>Sus evaluaciones no se borran: decide si cuentan.</span>
      </div>
      {error && <span style={{ color: '#C0392B', fontSize: 12, padding: '8px 20px' }}>{error}</span>}
      {members.map((m) => (
        <div key={m.id} className={tableStyles.row} style={{ gridTemplateColumns: '2fr 1.4fr auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)' }}>{m.full_name}</span>
            <span className={styles.small}>{m.evaluated} evaluaciones completas</span>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--ink)' }}>
            <Toggle checked={m.evaluations_count} onClick={() => run(m.id, { evaluations_count: !m.evaluations_count })} />
            {m.evaluations_count ? 'Sus evaluaciones cuentan' : 'No cuentan'}
          </label>
          <button className={tableStyles.linkAction} onClick={() => run(m.id, { restore: true })}>
            Reactivar
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- añadir

function AddPanel({ type, eventId, onClose, onAdded }: { type: StaffTypeDetail; eventId: string; onClose: () => void; onAdded: (memberId: string) => void }) {
  const { data: people } = useStaffPeople();
  const add = useAddStaffMember(type.id, eventId);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', title: '' });
  const [error, setError] = useState('');
  const memberPeople = new Set(type.members.filter((m) => !m.removed_at).map((m) => m.person_id));

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return (people ?? [])
      .filter((p) => !p.id || !memberPeople.has(p.id))
      .filter((p) => !q || p.full_name.toLocaleLowerCase('es').includes(q) || (p.email ?? '').toLowerCase().includes(q))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, query, type.members]);

  async function addPerson(person: StaffPerson | null) {
    setError('');
    try {
      const body =
        person && person.id
          ? { person_id: person.id, role: 'evaluator' as StaffMemberRole, committee_ids: [] }
          : {
              person: person
                ? { full_name: person.full_name, email: person.email, title: person.title }
                : { full_name: form.full_name.trim(), email: form.email.trim() || null, title: form.title.trim() || null },
              role: 'evaluator' as StaffMemberRole,
              committee_ids: [],
            };
      const detail = await add.mutateAsync(body);
      const name = person?.full_name ?? form.full_name.trim();
      const added = detail.members.find((m) => !m.removed_at && m.full_name === name);
      if (added) onAdded(added.id);
      else onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <aside className={styles.side}>
      <div className={styles.sideHead}>
        <span className={styles.sideTitle}>Añadir persona</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <input className={styles.input} placeholder="Buscar en el staff y jueces de la organización…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {matches.length === 0 && <span className={styles.small}>Nadie coincide. Agrégala abajo como persona nueva.</span>}
        {matches.map((p) => (
          <button key={(p.id ?? 'j') + p.full_name} className={styles.selectRow} onClick={() => addPerson(p)} disabled={add.isPending}>
            <Avatar initials={initialsFor(p.full_name)} size={26} color={p.source === 'judge' ? 'var(--un-blue)' : 'var(--navy)'} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{p.full_name}</span>
              <span className={styles.small}>{p.source === 'judge' ? 'Juez del evento' : p.types.length ? `En ${p.types.join(', ')}` : (p.title ?? 'Staff')}</span>
            </span>
            <small>Añadir</small>
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className={styles.fieldLabel}>Persona nueva</span>
        <input className={styles.input} placeholder="Nombre completo" value={form.full_name} maxLength={120} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input className={styles.input} placeholder="Correo (opcional)" type="email" value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={styles.input} placeholder="Puesto (p. ej. Vicepresidente de Comité)" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        {error && <span style={{ color: '#C0392B', fontSize: 12 }}>{error}</span>}
        <Button disabled={!form.full_name.trim() || add.isPending} onClick={() => addPerson(null)}>
          {add.isPending ? 'Añadiendo…' : 'Añadir al staff'}
        </Button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- editar

function EditPanel({
  type,
  eventId,
  member,
  scopeCommittees,
  onClose,
}: {
  type: StaffTypeDetail;
  eventId: string;
  member: StaffMember;
  scopeCommittees: StaffTypeDetail['committees'];
  onClose: () => void;
}) {
  const update = useUpdateStaffMember(eventId);
  const remove = useRemoveStaffMember(eventId);
  const updatePerson = useUpdateStaffPerson();
  const issue = useIssueStaffLink();
  const [role, setRole] = useState<StaffMemberRole>(member.role);
  const [committeeIds, setCommitteeIds] = useState<string[]>(member.committee_ids);
  const [email, setEmail] = useState(member.email ?? '');
  const [link, setLink] = useState<StaffAccessLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');

  const all = committeeIds.length === 0;
  const toggle = (id: string) => setCommitteeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // Cobertura: cuántos miembros activos evalúan cada comité elegido (contando este cambio).
  const coverage = useMemo(() => {
    const ids = all ? scopeCommittees.map((c) => c.id) : committeeIds;
    const counts = ids.map((cid) =>
      type.members.filter((m) => !m.removed_at && (m.id === member.id ? all || committeeIds.includes(cid) : m.committee_ids.length === 0 || m.committee_ids.includes(cid))).length,
    );
    return { ids, min: counts.length ? Math.min(...counts) : 0 };
  }, [all, committeeIds, scopeCommittees, type.members, member.id]);
  const acronyms = scopeCommittees.filter((c) => coverage.ids.includes(c.id)).map((c) => c.acronym);

  async function save(withLink: boolean) {
    setError('');
    try {
      await update.mutateAsync({ memberId: member.id, body: { role, committee_ids: committeeIds } });
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== (member.email ?? '')) {
        await updatePerson.mutateAsync({ personId: member.person_id, body: { email: cleanEmail || null } });
      }
      if (withLink) {
        setLink(await issue.mutateAsync({ personId: member.person_id, linkBase: staffLinkBase() }));
      } else {
        onClose();
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRemove() {
    setConfirmRemove(false);
    try {
      await remove.mutateAsync(member.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const busy = update.isPending || issue.isPending || updatePerson.isPending;
  const mailto = link && link.email
    ? `mailto:${link.email}?subject=${encodeURIComponent(`Tu enlace de evaluación · ${type.name}`)}&body=${encodeURIComponent(
        `Hola ${link.full_name}:\n\nEste es tu enlace personal para evaluar como parte de ${type.name}:\n${link.url}\n\nNo lo compartas: quien lo tenga puede evaluar a tu nombre.`,
      )}`
    : null;

  return (
    <aside className={styles.side}>
      <div className={styles.sideHead}>
        <span className={styles.sideTitle}>Editar miembro</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <Avatar initials={initialsFor(member.full_name)} size={38} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className={styles.serifName} style={{ fontSize: 17 }}>
            {member.full_name}
          </span>
          <span className={styles.small}>
            {member.title ?? 'Sin puesto'}
            {member.other_types.length > 0 && ` · también en ${member.other_types.join(', ')}`}
          </span>
        </div>
      </div>
      <input className={styles.input} type="email" placeholder="Correo (para enviarle su enlace)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className={styles.fieldLabel}>Rol en el staff</span>
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: 'coordinator', label: 'Coordinación' },
            { value: 'evaluator', label: 'Evaluación' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className={styles.fieldLabel}>Asignar a comités</span>
        <button className={`${styles.selectRow} ${all ? styles.selectRowActive : ''}`} onClick={() => setCommitteeIds([])}>
          <Checkbox checked={all} />
          Todos los comités
        </button>
        {scopeCommittees.map((c) => {
          const on = committeeIds.includes(c.id);
          return (
            <button key={c.id} className={`${styles.selectRow} ${on ? styles.selectRowActive : ''}`} onClick={() => toggle(c.id)}>
              <Checkbox checked={on} />
              {c.name}
              <small>{c.acronym}</small>
            </button>
          );
        })}
      </div>

      <div className={styles.calloutGold}>
        {type.name} recomienda <strong>mínimo {type.min_evaluators} evaluador{type.min_evaluators === 1 ? '' : 'es'} por candidato</strong>.{' '}
        {acronyms.length > 0 &&
          `Con esta asignación, ${acronyms.length > 4 ? 'sus comités' : acronyms.join(' y ')} ${acronyms.length === 1 ? 'queda cubierto' : 'quedan cubiertos'} por al menos ${coverage.min} evaluador${coverage.min === 1 ? '' : 'es'}.`}
      </div>

      {link && (
        <div className={styles.calloutInfo} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>
            Enlace generado. Por seguridad <strong>solo se muestra ahora</strong>; si se pierde, genera otro (el anterior deja de servir).
          </span>
          <input className={styles.input} readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Enlace personal" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link.url).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar enlace'}
            </Button>
            {mailto && (
              <a href={mailto} style={{ textDecoration: 'none' }}>
                <Button>Enviar por correo</Button>
              </a>
            )}
          </div>
        </div>
      )}

      {error && <span style={{ color: '#C0392B', fontSize: 12 }}>{error}</span>}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button fullWidth disabled={busy} onClick={() => save(true)}>
          {busy ? 'Guardando…' : member.access === 'not_invited' ? 'Guardar y enviar invitación' : 'Guardar y generar enlace nuevo'}
        </Button>
        <Button fullWidth variant="secondary" disabled={busy} onClick={() => save(false)}>
          Solo guardar
        </Button>
        <span className={styles.small} style={{ textAlign: 'center' }}>
          Recibirá un enlace personal para evaluar solo a los candidatos de {type.name}.
        </span>
        <button className={styles.linkBtn} style={{ color: '#C0392B', alignSelf: 'center' }} onClick={() => setConfirmRemove(true)}>
          Quitar del staff
        </button>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title="Quitar del staff"
          message={`${member.full_name} dejará de ver a los candidatos de ${type.name}. Sus evaluaciones no se borran: quedan como de un exmiembro y tú decides si cuentan.`}
          onClose={() => setConfirmRemove(false)}
          actions={[
            { label: 'Cancelar', onClick: () => setConfirmRemove(false) },
            { label: 'Quitar', variant: 'danger', onClick: handleRemove },
          ]}
        />
      )}
    </aside>
  );
}

function exportMembers(type: StaffTypeDetail, committees: StaffTypeDetail['committees']) {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [
    ['Nombre', 'Correo', 'Puesto', 'Rol', 'Comités', 'Evaluados', 'Asignados', 'Acceso', 'Estado'],
    ...type.members.map((m) => [
      m.full_name,
      m.email ?? '',
      m.title ?? '',
      m.role === 'coordinator' ? 'Coordinación' : 'Evaluación',
      committeesLabel(m.committee_ids, committees),
      String(m.evaluated),
      String(m.assigned),
      ACCESS[m.access].label,
      m.removed_at ? 'Exmiembro' : 'Activo',
    ]),
  ];
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `staff-${type.code.toLowerCase()}-miembros.csv`);
}

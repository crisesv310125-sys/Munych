import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Input, Select } from '@munych/ui/components/FormControls';
import { Toggle } from '@munych/ui/components/SelectionControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import {
  useCloseSession,
  useCommittees,
  useCommitteeJudges,
  useCreateCommittee,
  useDelegations,
  useDeleteCommittee,
  useEvent,
  useEventRubrics,
  useOpenSession,
  useSessions,
  useUpdateCommittee,
} from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { useIsAdminWide } from '../../lib/useMediaQuery';
import { slugify } from '../../lib/slugify';
import { committeeStatusFromSessions, committeeStatusLabel, committeeStatusTone, sessionStatusLabel, sessionStatusTone } from '../../lib/statusLabels';
import type { ApiCommittee, CommitteeDraft, CommitteeType } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const COLS = '2fr 1.1fr .8fr .8fr 1fr 70px';

const COMMITTEE_TYPE_LABEL: Record<CommitteeType, string> = {
  general_assembly: 'Asamblea general',
  security_council: 'Consejo de seguridad',
  crisis: 'Crisis',
  specialized: 'Especializado',
};

/** El slug es único por evento: el sufijo evita choques al crear varios "Nuevo comité" seguidos. */
function newCommitteeDraft(): CommitteeDraft {
  return {
    name: 'Nuevo comité',
    acronym: 'NC',
    slug: `nuevo-comite-${Date.now().toString(36)}`,
    type: 'general_assembly',
    delegation_mode: 'single',
    sessions_count: 3,
    rubric_id: null,
  };
}

function CommitteeRow({ committee, selected, onEdit }: { committee: ApiCommittee; selected: boolean; onEdit: () => void }) {
  const { data: delegations } = useDelegations(committee.id);
  const { data: judgeAssignments } = useCommitteeJudges(committee.id);
  const { data: sessions } = useSessions(committee.id);
  const status = committeeStatusFromSessions(sessions ?? []);
  return (
    <div className={`${tableStyles.row} ${selected ? tableStyles.rowSelected : ''}`} style={{ gridTemplateColumns: COLS }}>
      <span className={tableStyles.nameCell}>{committee.name}</span>
      <span className={tableStyles.mutedCell}>{committee.sessions_count} sesiones</span>
      <span className={tableStyles.mutedCell}>{delegations?.length ?? '—'}</span>
      <span className={tableStyles.mutedCell}>{judgeAssignments?.length ?? '—'}</span>
      <span style={{ justifySelf: 'start' }}>
        <StatusBadge tone={committeeStatusTone(status)} label={committeeStatusLabel(status).toUpperCase()} />
      </span>
      <button className={tableStyles.linkAction} onClick={onEdit}>
        Editar
      </button>
    </div>
  );
}

function SessionsPanel({ committeeId, eventClosed }: { committeeId: string; eventClosed: boolean }) {
  const { data: sessions } = useSessions(committeeId);
  const openSession = useOpenSession(committeeId);
  const closeSession = useCloseSession(committeeId);
  const [error, setError] = useState('');
  const sorted = [...(sessions ?? [])].sort((a, b) => a.number - b.number);

  async function toggle(number: number, isOpen: boolean) {
    setError('');
    try {
      if (isOpen) {
        if (!window.confirm(`¿Cerrar la sesión ${number}? Los jueces ya no podrán calificar.`)) return;
        await closeSession.mutateAsync(number);
      } else {
        await openSession.mutateAsync(number);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Sesiones</span>
      {sorted.map((s) => (
        <div
          key={s.number}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>Sesión {s.number}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusBadge tone={sessionStatusTone(s)} label={sessionStatusLabel(s).toUpperCase()} />
            {!eventClosed && (
              <Button
                variant="secondary"
                onClick={() => toggle(s.number, s.status === 'open')}
                disabled={openSession.isPending || closeSession.isPending}
              >
                {s.status === 'open' ? 'Cerrar' : 'Abrir'}
              </Button>
            )}
          </div>
        </div>
      ))}
      {error && <span style={{ color: '#C0392B', fontSize: 12 }}>{error}</span>}
    </div>
  );
}

export function CommitteesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const isWide = useIsAdminWide();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const { data: rubrics } = useEventRubrics(eventId);
  const createCommittee = useCreateCommittee(eventId ?? '');
  const deleteCommittee = useDeleteCommittee(eventId ?? '');

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommitteeDraft | null>(null);
  const [saveError, setSaveError] = useState('');
  const updateCommittee = useUpdateCommittee(eventId ?? '', editingId ?? '');

  const list = committees ?? [];
  const filtered = list.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!editingId && list.length > 0) startEdit(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  function closeEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function startEdit(c: ApiCommittee) {
    setEditingId(c.id);
    setSaveError('');
    setDraft({
      name: c.name,
      acronym: c.acronym,
      slug: c.slug,
      type: c.type,
      delegation_mode: c.delegation_mode,
      sessions_count: c.sessions_count,
      rubric_id: c.rubric_id,
    });
  }

  async function handleSave() {
    if (!draft || !editingId) return;
    setSaveError('');
    try {
      await updateCommittee.mutateAsync(draft);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  async function handleNew() {
    if (!eventId) return;
    setSaveError('');
    try {
      const created = await createCommittee.mutateAsync(newCommitteeDraft());
      startEdit(created);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    try {
      await deleteCommittee.mutateAsync(editingId);
      closeEdit();
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle}>Comités</span>
          <span className={styles.topbarSub}>{list.length} comités registrados</span>
        </div>
        <div className={styles.topbarActions}>
          <input className={styles.searchInput} placeholder="Buscar comité…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button onClick={handleNew} disabled={createCommittee.isPending}>
            + Nuevo comité
          </Button>
        </div>
      </div>
      <div className={styles.layoutSplit}>
        <div className={styles.tableFlex}>
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <span>Nombre</span>
            <span>Sesiones</span>
            <span>Países</span>
            <span>Jueces</span>
            <span>Estado</span>
            <span />
          </div>
          {filtered.map((c) => (
            <CommitteeRow key={c.id} committee={c} selected={c.id === editingId} onEdit={() => startEdit(c)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 26, fontSize: 13, color: 'var(--muted)' }}>
              Este evento aún no tiene comités. Crea el primero con &ldquo;+ Nuevo comité&rdquo;.
            </div>
          )}
        </div>
        {(isWide || editingId) && draft && editingId && (
          <div className={styles.sidePanel}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Editar comité</span>
                <button
                  onClick={() => closeEdit()}
                  style={{ background: 'none', border: 'none', color: 'var(--state-none-dot)', fontSize: 16, cursor: 'pointer' }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <Input label="Nombre del comité" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Input label="Slug (URL pública)" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input label="Sigla" value={draft.acronym} onChange={(e) => setDraft({ ...draft, acronym: e.target.value })} />
                  <Input
                    label="N.º de sesiones"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.sessions_count}
                    onChange={(e) => setDraft({ ...draft, sessions_count: Number(e.target.value) })}
                  />
                </div>
                <Select
                  label="Tipo de comité"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value as CommitteeType })}
                >
                  {Object.entries(COMMITTEE_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Rúbrica"
                  value={draft.rubric_id ?? ''}
                  onChange={(e) => setDraft({ ...draft, rubric_id: e.target.value || null })}
                >
                  <option value="">Usar la rúbrica del evento</option>
                  {(rubrics ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    background: 'var(--bg)',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Delegación doble (2 delegados)</span>
                  <Toggle
                    checked={draft.delegation_mode === 'double'}
                    onClick={() => setDraft({ ...draft, delegation_mode: draft.delegation_mode === 'double' ? 'single' : 'double' })}
                  />
                </div>
                <SessionsPanel committeeId={editingId} eventClosed={event?.status === 'closed'} />
                {saveError && <span style={{ color: '#C0392B', fontSize: 13 }}>{saveError}</span>}
              </div>
              <div className={styles.modalFooter}>
                <Button variant="danger" onClick={handleDelete} disabled={deleteCommittee.isPending}>
                  Eliminar comité
                </Button>
                <Button onClick={handleSave} disabled={updateCommittee.isPending}>
                  {updateCommittee.isPending ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

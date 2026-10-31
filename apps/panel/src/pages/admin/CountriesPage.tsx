import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Input, Select } from '@munych/ui/components/FormControls';
import { Checkbox } from '@munych/ui/components/SelectionControls';
import {
  useCommittees,
  useCreateDelegation,
  useDelegations,
  useDeleteDelegate,
  useDeleteDelegation,
  useUpdateDelegation,
} from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import type { ApiDelegation } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const COLS = '36px 2fr 1.6fr 1.2fr 80px';

type DraftKind = 'country' | 'character';

interface Draft {
  id: string | null;
  kind: DraftKind;
  countryCode: string;
  characterName: string;
  institution: string;
  delegateNames: string[];
}

function emptyDraft(): Draft {
  return { id: null, kind: 'country', countryCode: '', characterName: '', institution: '', delegateNames: [''] };
}

function fromDelegation(d: ApiDelegation): Draft {
  return {
    id: d.id,
    kind: d.character_name ? 'character' : 'country',
    countryCode: d.country_code ?? '',
    characterName: d.character_name ?? '',
    institution: d.institution ?? '',
    delegateNames: d.delegates.length ? d.delegates.map((x) => x.full_name) : [''],
  };
}

export function CountriesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: committees } = useCommittees(eventId);
  const [committeeId, setCommitteeId] = useState('');
  const activeCommitteeId = committeeId || committees?.[0]?.id || '';
  const activeCommittee = committees?.find((c) => c.id === activeCommitteeId);
  const maxDelegates = activeCommittee?.delegation_mode === 'double' ? 2 : 1;

  const { data: delegations, isLoading, isError, error, refetch } = useDelegations(activeCommitteeId);
  const createDelegation = useCreateDelegation(activeCommitteeId);
  const updateDelegation = useUpdateDelegation(activeCommitteeId);
  const deleteDelegation = useDeleteDelegation(activeCommitteeId);
  const deleteDelegate = useDeleteDelegate(activeCommitteeId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState('');

  const list = delegations ?? [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === list.length ? new Set() : new Set(list.map((c) => c.id))));
  }

  function startEdit(delegation: ApiDelegation) {
    setDraftError('');
    setDraft(fromDelegation(delegation));
  }

  function startNew() {
    setDraftError('');
    setDraft(emptyDraft());
  }

  function closeEdit() {
    setDraft(null);
  }

  async function handleSaveDraft() {
    if (!draft) return;
    setDraftError('');
    // Se envían ambos campos (uno en null) para poder pasar de país a personaje o al revés.
    const patch = {
      country_code: draft.kind === 'country' ? draft.countryCode.trim().toUpperCase() || null : null,
      character_name: draft.kind === 'character' ? draft.characterName.trim() || null : null,
      institution: draft.institution.trim() || null,
    };
    try {
      if (draft.id) {
        await updateDelegation.mutateAsync({ delegationId: draft.id, patch });
      } else {
        const delegates = draft.delegateNames
          .map((n) => n.trim())
          .filter(Boolean)
          .slice(0, maxDelegates)
          .map((full_name) => ({ full_name, institution: patch.institution }));
        await createDelegation.mutateAsync({ ...patch, delegates });
      }
      closeEdit();
    } catch (err) {
      setDraftError(errorMessage(err));
    }
  }

  async function handleDeleteDraft() {
    if (!draft?.id) {
      closeEdit();
      return;
    }
    try {
      await deleteDelegation.mutateAsync(draft.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(draft.id!);
        return next;
      });
      closeEdit();
    } catch (err) {
      setDraftError(errorMessage(err));
    }
  }

  async function handleDeleteSelected() {
    for (const id of selected) {
      await deleteDelegation.mutateAsync(id);
    }
    setSelected(new Set());
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle}>Delegaciones · {activeCommittee?.name ?? ''}</span>
          <span className={styles.topbarSub}>{list.length} delegaciones registradas</span>
        </div>
        <div className={styles.topbarActions}>
          <Select
            value={activeCommitteeId}
            onChange={(e) => {
              setCommitteeId(e.target.value);
              setSelected(new Set());
              closeEdit();
            }}
          >
            {(committees ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button onClick={startNew} disabled={!activeCommitteeId}>
            + Añadir delegación
          </Button>
        </div>
      </div>
      <div className={styles.layoutSplit}>
        <div className={styles.tableFlex}>
          {isError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', color: '#C0392B', fontSize: 13 }}>
              <span>{errorMessage(error)}</span>
              <Button variant="secondary" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {selected.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'var(--row-selected)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{selected.size} delegación(es) seleccionadas</span>
              <Button variant="danger" onClick={handleDeleteSelected}>
                Eliminar seleccionadas
              </Button>
            </div>
          )}
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <Checkbox checked={list.length > 0 && selected.size === list.length} onClick={toggleAll} />
            <span>País / Personaje</span>
            <span>Delegado(s)</span>
            <span>Institución</span>
            <span />
          </div>
          {isLoading && <div style={{ padding: 26, fontSize: 13, color: 'var(--muted)' }}>Cargando…</div>}
          {list.map((delegation) => (
            <div
              key={delegation.id}
              className={`${tableStyles.row} ${delegation.id === draft?.id ? tableStyles.rowSelected : ''}`}
              style={{ gridTemplateColumns: COLS }}
            >
              <Checkbox checked={selected.has(delegation.id)} onClick={() => toggle(delegation.id)} />
              <span className={tableStyles.nameCell}>{delegation.character_name ?? delegation.country_code}</span>
              <span className={tableStyles.mutedCell}>{delegation.delegates.map((d) => d.full_name).join(', ') || 'Sin delegados'}</span>
              <span className={tableStyles.mutedCell}>{delegation.institution}</span>
              <button className={tableStyles.linkAction} onClick={() => startEdit(delegation)}>
                Editar
              </button>
            </div>
          ))}
          {!isLoading && list.length === 0 && (
            <div style={{ padding: 26, fontSize: 13, color: 'var(--muted)' }}>Este comité aún no tiene delegaciones registradas.</div>
          )}
        </div>
        {draft && (
          <div className={`${styles.sidePanel} ${styles.sidePanelNarrow}`}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>
                  {draft.id ? 'Editar delegación' : 'Añadir delegación'}
                </span>
                <button
                  onClick={closeEdit}
                  style={{ background: 'none', border: 'none', color: 'var(--state-none-dot)', fontSize: 16, cursor: 'pointer' }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <Select label="Tipo" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DraftKind })}>
                  <option value="country">País</option>
                  <option value="character">Personaje (crisis)</option>
                </Select>
                {draft.kind === 'country' ? (
                  <Input
                    label="País (código ISO)"
                    placeholder="MX"
                    maxLength={2}
                    value={draft.countryCode}
                    onChange={(e) => setDraft({ ...draft, countryCode: e.target.value.toUpperCase() })}
                  />
                ) : (
                  <Input
                    label="Personaje"
                    value={draft.characterName}
                    onChange={(e) => setDraft({ ...draft, characterName: e.target.value })}
                  />
                )}
                <Input label="Institución" value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
                {!draft.id && (
                  <>
                    <Input
                      label="Delegado 1"
                      value={draft.delegateNames[0] ?? ''}
                      onChange={(e) => setDraft({ ...draft, delegateNames: [e.target.value, draft.delegateNames[1] ?? ''] })}
                    />
                    {maxDelegates === 2 && (
                      <Input
                        label="Delegado 2 (opcional, delegación doble)"
                        value={draft.delegateNames[1] ?? ''}
                        onChange={(e) => setDraft({ ...draft, delegateNames: [draft.delegateNames[0] ?? '', e.target.value] })}
                      />
                    )}
                  </>
                )}
                {draft.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Delegados</span>
                    {draft.delegateNames.map((name, i) => {
                      const delegateId = list.find((d) => d.id === draft.id)?.delegates[i]?.id;
                      return (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{name || 'Delegado sin nombre'}</span>
                          {delegateId && (
                            <button
                              className={tableStyles.linkAction}
                              onClick={() => deleteDelegate.mutateAsync(delegateId)}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {draftError && <span style={{ color: '#C0392B', fontSize: 13 }}>{draftError}</span>}
              </div>
              <div className={styles.modalFooter}>
                <Button variant="danger" onClick={handleDeleteDraft}>
                  {draft.id ? 'Eliminar delegación' : 'Cancelar'}
                </Button>
                <Button onClick={handleSaveDraft} disabled={createDelegation.isPending || updateDelegation.isPending}>
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

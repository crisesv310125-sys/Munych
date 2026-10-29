import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GripVertical } from 'lucide-react';
import { Button } from '@munych/ui/components/Button';
import { Input, Textarea } from '@munych/ui/components/FormControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useCommittees, useCreateRubric, useEvent, useEventRubrics, useUpdateRubric } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { sumWeights, weightColor } from '../../lib/scoring';
import type { ApiCriterion, ApiRubric, RubricIn } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const COLS = '32px 2.2fr 2.6fr 130px 70px';

/** Prefijo de ids locales: al guardar se envían sin `id` para que el backend cree el criterio. */
const NEW_CRITERION_PREFIX = 'new-';

function scaleLevels(scaleMin: number, scaleMax: number): number[] {
  return Array.from({ length: Math.max(0, scaleMax - scaleMin + 1) }, (_, i) => scaleMin + i);
}

/** Deja en `level_descriptors` exactamente una entrada por nivel de la escala. */
function withLevels(criterion: ApiCriterion, scaleMin: number, scaleMax: number): ApiCriterion {
  const level_descriptors: Record<string, string> = {};
  for (const level of scaleLevels(scaleMin, scaleMax)) {
    level_descriptors[String(level)] = criterion.level_descriptors[String(level)] ?? '';
  }
  return { ...criterion, level_descriptors };
}

function sortedRubric(rubric: ApiRubric): ApiRubric {
  return { ...rubric, criteria: [...rubric.criteria].sort((a, b) => a.position - b.position) };
}

/** RubricIn: el orden del array define `position`. */
function toRubricIn(rubric: ApiRubric): RubricIn {
  return {
    name: rubric.name,
    scale_min: rubric.scale_min,
    scale_max: rubric.scale_max,
    criteria: rubric.criteria.map((c) => ({
      id: c.id.startsWith(NEW_CRITERION_PREFIX) ? null : c.id,
      name: c.name,
      description: c.description || null,
      weight: c.weight,
      level_descriptors: Object.fromEntries(Object.entries(c.level_descriptors).filter(([, text]) => text.trim())),
    })),
  };
}

export function CriteriaPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event } = useEvent(eventId);
  const { data: committees } = useCommittees(eventId);
  const { data: rubrics } = useEventRubrics(eventId);

  const [activeRubricId, setActiveRubricId] = useState<string>('');
  const fetchedRubric = rubrics?.find((r) => r.id === activeRubricId) ?? rubrics?.find((r) => r.id === event?.default_rubric_id) ?? rubrics?.[0];
  const activeRubric = fetchedRubric ? sortedRubric(fetchedRubric) : undefined;

  const [draft, setDraft] = useState<ApiRubric | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const updateRubric = useUpdateRubric(eventId ?? '', activeRubric?.id ?? '');
  const createRubric = useCreateRubric(eventId ?? '');

  useEffect(() => {
    if (activeRubric && draft?.id !== activeRubric.id) {
      setDraft(activeRubric);
      setEditingId(activeRubric.criteria[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRubric?.id]);

  /** Comités que usan la rúbrica: los que la eligen explícitamente y, si es la del evento, los que no eligen ninguna. */
  function committeesUsing(rubricId: string): number {
    return (committees ?? []).filter((c) => c.rubric_id === rubricId || (c.rubric_id === null && rubricId === event?.default_rubric_id)).length;
  }

  if (!draft) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando rúbrica…</span>
        </div>
      </div>
    );
  }

  const total = sumWeights(draft.criteria);
  const isValid = total === 100 && draft.scale_min < draft.scale_max && draft.criteria.length > 0;
  const editing = draft.criteria.find((c) => c.id === editingId);
  const maxBar = Math.max(...draft.criteria.map((c) => c.weight), 1);
  const committeeCount = committeesUsing(draft.id);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(activeRubric);

  function updateEditing(patch: Partial<ApiCriterion>) {
    if (!editingId || !draft) return;
    setDraft({ ...draft, criteria: draft.criteria.map((c) => (c.id === editingId ? { ...c, ...patch } : c)) });
  }

  function updateLevelDescriptor(level: number, descriptor: string) {
    if (!editing) return;
    updateEditing({ level_descriptors: { ...editing.level_descriptors, [String(level)]: descriptor } });
  }

  function handleDelete() {
    if (!editing || !draft) return;
    setDraft({ ...draft, criteria: draft.criteria.filter((c) => c.id !== editing.id) });
    setEditingId(null);
  }

  function handleAddCriterion() {
    if (!draft) return;
    const criterion = withLevels(
      {
        id: `${NEW_CRITERION_PREFIX}${Date.now()}`,
        name: 'Nuevo criterio',
        description: '',
        weight: 0,
        position: draft.criteria.length,
        level_descriptors: {},
      },
      draft.scale_min,
      draft.scale_max,
    );
    setDraft({ ...draft, criteria: [...draft.criteria, criterion] });
    setEditingId(criterion.id);
  }

  function updateScale(patch: Partial<Pick<ApiRubric, 'scale_min' | 'scale_max'>>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft({ ...next, criteria: next.criteria.map((c) => withLevels(c, next.scale_min, next.scale_max)) });
  }

  async function handleSaveAll() {
    if (!draft) return;
    setSaveError('');
    try {
      const saved = sortedRubric(await updateRubric.mutateAsync(toRubricIn(draft)));
      // Los criterios nuevos ya tienen id real: se sustituye el borrador para no arrastrar ids locales.
      setDraft(saved);
      if (editingId?.startsWith(NEW_CRITERION_PREFIX)) setEditingId(saved.criteria[0]?.id ?? null);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  function handleDiscard() {
    if (activeRubric) setDraft(activeRubric);
  }

  async function handleNewRubric() {
    setSaveError('');
    try {
      const created = await createRubric.mutateAsync({
        name: `Rúbrica ${(rubrics?.length ?? 0) + 1}`,
        scale_min: 1,
        scale_max: 4,
        criteria: [{ name: 'Criterio 1', weight: 100 }],
      });
      setActiveRubricId(created.id);
    } catch (err) {
      setSaveError(errorMessage(err));
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle}>Criterios de evaluación</span>
          <span className={styles.topbarSub}>
            {draft.name} · aplicado a {committeeCount} {committeeCount === 1 ? 'comité' : 'comités'}
            {isDirty && ' · cambios sin guardar'}
          </span>
        </div>
        <div className={styles.topbarActions}>
          <Button variant="secondary" onClick={handleNewRubric} disabled={createRubric.isPending}>
            + Nueva rúbrica
          </Button>
          <Button variant="secondary" onClick={handleAddCriterion}>
            + Añadir criterio
          </Button>
          {isDirty && (
            <Button variant="secondary" onClick={handleDiscard}>
              Descartar
            </Button>
          )}
          <Button onClick={handleSaveAll} disabled={!isDirty || !isValid || updateRubric.isPending}>
            {updateRubric.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      <div className={styles.setTabsBar}>
        {(rubrics ?? []).map((r) => {
          const valid = sumWeights(r.criteria) === 100;
          const count = committeesUsing(r.id);
          return (
            <button
              key={r.id}
              className={`${styles.setTab} ${r.id === draft.id ? styles.setTabActive : ''}`}
              onClick={() => setActiveRubricId(r.id)}
            >
              <span className={styles.setTabName}>{r.name}</span>
              <span className={styles.setTabMeta}>
                {r.criteria.length} criterios · {count} {count === 1 ? 'comité' : 'comités'}
              </span>
              <StatusBadge tone={valid ? 'done' : 'progress'} label={`${sumWeights(r.criteria)}%`} />
            </button>
          );
        })}
      </div>

      <div className={styles.layoutSplit}>
        <div className={styles.tableFlex}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 26px 0' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Escala de calificación</span>
            <div style={{ width: 60 }}>
              <Input type="number" value={draft.scale_min} onChange={(e) => updateScale({ scale_min: Number(e.target.value) })} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>a</span>
            <div style={{ width: 60 }}>
              <Input type="number" value={draft.scale_max} onChange={(e) => updateScale({ scale_max: Number(e.target.value) })} />
            </div>
          </div>
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>Criterio</span>
            <span>Descripción</span>
            <span style={{ textAlign: 'right' }}>Peso</span>
            <span />
          </div>
          {draft.criteria.map((k) => (
            <div key={k.id} className={`${tableStyles.row} ${k.id === editingId ? tableStyles.rowSelected : ''}`} style={{ gridTemplateColumns: COLS }}>
              <GripVertical size={14} color="var(--border-input)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{k.name}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{k.description}</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <div style={{ width: 52, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${(k.weight / maxBar) * 100}%`, height: '100%', background: 'var(--un-blue)' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: 'var(--navy)', minWidth: 44, textAlign: 'right' }}>
                  {k.weight}%
                </span>
              </div>
              <button className={tableStyles.linkAction} onClick={() => setEditingId(k.id)}>
                Editar
              </button>
            </div>
          ))}
          {draft.criteria.length === 0 && (
            <div style={{ padding: '26px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              Este set todavía no tiene criterios. Usa "+ Añadir criterio" para empezar.
            </div>
          )}
          <div style={{ padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--row-selected)' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Suma total de pesos</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge tone={isValid ? 'done' : 'progress'} label={isValid ? 'VÁLIDO' : 'AJUSTAR PESOS'} />
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600, color: 'var(--navy)' }}>{total}%</span>
            </div>
          </div>
          {saveError && <div style={{ padding: '0 26px 16px', color: '#C0392B', fontSize: 13 }}>{saveError}</div>}
        </div>
        {editing && (
          <div className={`${styles.sidePanel} ${styles.sidePanelNarrow}`}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 600, color: 'var(--navy)' }}>Editar criterio</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Nombre</label>
              <input
                value={editing.name}
                onChange={(e) => updateEditing({ name: e.target.value })}
                style={{ border: '1px solid var(--border-input)', borderRadius: 8, padding: '11px 12px', fontSize: 14, outline: 'none', background: 'var(--white)' }}
              />
            </div>
            <Textarea
              label="Descripción para el juez"
              rows={3}
              value={editing.description ?? ''}
              onChange={(e) => updateEditing({ description: e.target.value })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Peso</label>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--navy)' }}>{editing.weight}%</span>
              </div>
              <input
                type="range"
                className="sl"
                min={0}
                max={100}
                value={editing.weight}
                onChange={(e) => updateEditing({ weight: Number(e.target.value) })}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Descriptores por nivel</span>
              {scaleLevels(draft.scale_min, draft.scale_max).map((level) => (
                <Textarea
                  key={level}
                  label={`Nivel ${level}`}
                  rows={2}
                  value={editing.level_descriptors[String(level)] ?? ''}
                  onChange={(e) => updateLevelDescriptor(level, e.target.value)}
                />
              ))}
            </div>
            <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Reparto actual</span>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--border)' }}>
                {draft.criteria.map((k, i) => (
                  <div key={k.id} style={{ width: `${k.weight}%`, background: weightColor(i) }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {draft.criteria.length} criterios · suma {total}%
              </span>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <Button variant="danger" style={{ width: '100%' }} onClick={handleDelete}>
                Eliminar criterio
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

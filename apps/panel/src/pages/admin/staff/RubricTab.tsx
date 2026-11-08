import { useEffect, useMemo, useState } from 'react';
import { Button } from '@munych/ui/components/Button';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { usePutStaffRubric } from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import type { StaffTypeDetail } from '../../../data-access/staffTypes';
import type { TopActions } from './StaffTypePage';
import { ErrorBadge } from './staffUi';
import { COUNTS_AS, EVALUATES, committeesLabel, formatNumber } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '24px 1.5fr 2.5fr 112px 44px';
const WEIGHT_COLORS = ['var(--weight-1)', 'var(--weight-2)', 'var(--weight-3)', 'var(--weight-4)', 'var(--weight-5)', 'var(--weight-6)', 'var(--weight-7)'];
const SCALES: { label: string; min: number; max: number }[] = [
  { label: '0 – 10', min: 0, max: 10 },
  { label: '0 – 100', min: 0, max: 100 },
  { label: '1 – 5', min: 1, max: 5 },
  { label: '1 – 4', min: 1, max: 4 },
];

interface DraftCriterion {
  key: string;
  id: string | null;
  name: string;
  description: string;
  weight: number;
}

function toDraft(type: StaffTypeDetail): DraftCriterion[] {
  return type.rubric.criteria.map((c) => ({ key: c.id, id: c.id, name: c.name, description: c.description ?? '', weight: c.weight }));
}

export function RubricTab({
  type,
  eventId,
  setActions,
  onEditScope,
}: {
  type: StaffTypeDetail;
  eventId: string;
  setActions: TopActions;
  onEditScope: () => void;
}) {
  const put = usePutStaffRubric(type.id, eventId);
  const [criteria, setCriteria] = useState<DraftCriterion[]>(() => toDraft(type));
  const [scale, setScale] = useState({ min: type.rubric.scale_min, max: type.rubric.scale_max, step: type.rubric.scale_step });
  const [editing, setEditing] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Si el servidor cambia (otra pestaña, otro admin), se recarga el borrador.
  useEffect(() => {
    setCriteria(toDraft(type));
    setScale({ min: type.rubric.scale_min, max: type.rubric.scale_max, step: type.rubric.scale_step });
  }, [type]);

  const sum = criteria.reduce((n, c) => n + c.weight, 0);
  const valid = criteria.length > 0 && Math.abs(sum - 100) < 0.001 && criteria.every((c) => c.weight >= 0 && c.weight <= 50 && c.name.trim());
  const dirty = useMemo(() => {
    const original = toDraft(type);
    return (
      JSON.stringify(criteria.map(({ key: _k, ...c }) => c)) !== JSON.stringify(original.map(({ key: _k, ...c }) => c)) ||
      scale.min !== type.rubric.scale_min ||
      scale.max !== type.rubric.scale_max ||
      scale.step !== type.rubric.scale_step
    );
  }, [criteria, scale, type]);

  function addCriterion() {
    const key = `new-${Date.now()}`;
    setCriteria((list) => [...list, { key, id: null, name: 'Nuevo criterio', description: '', weight: Math.max(0, Math.min(50, 100 - sum)) }]);
    setEditing(key);
  }

  useEffect(() => {
    setActions(<Button onClick={addCriterion}>+ Añadir criterio</Button>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions, sum]);

  async function save() {
    setError('');
    setSaved(false);
    try {
      await put.mutateAsync({
        scale_min: scale.min,
        scale_max: scale.max,
        scale_step: scale.step,
        criteria: criteria.map((c) => ({ id: c.id, name: c.name.trim(), description: c.description.trim() || null, weight: c.weight })),
      });
      setSaved(true);
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    setCriteria((list) => {
      const from = list.findIndex((c) => c.key === dragKey);
      const to = list.findIndex((c) => c.key === targetKey);
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragKey(null);
  }

  const current = criteria.find((c) => c.key === editing);
  const missing = 100 - sum;

  return (
    <div className={shared.layoutSplit}>
      <div className={shared.content} style={{ flex: 1 }}>
        <div className={styles.scopeCard}>
          <div className={styles.scopeCell}>
            <span>EVALÚA A</span>
            {type.evaluates ? EVALUATES[type.evaluates].candidates : 'Sin configurar'}
          </div>
          <div className={styles.scopeCell}>
            <span>ALCANCE</span>
            {type.all_committees ? 'Todos los comités' : committeesLabel(type.committee_ids, type.committees)}
          </div>
          <div className={styles.scopeCell}>
            <span>EVALUADORES</span>
            Mín. {type.min_evaluators} · escala {formatNumber(scale.min)}–{formatNumber(scale.max)}
          </div>
          <div className={styles.scopeCell}>
            <span>NOTA STAFF</span>
            {type.counts_as === 'none' ? 'No cuenta' : COUNTS_AS[type.counts_as]}
          </div>
          <div className={styles.scopeCell} style={{ borderRight: 'none', justifyContent: 'center' }}>
            <button className={styles.linkBtn} onClick={onEditScope}>
              Editar
            </button>
          </div>
        </div>

        <div className={shared.panelCard}>
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <span />
            <span>Criterio</span>
            <span>Descripción para el evaluador</span>
            <span style={{ textAlign: 'right' }}>Peso</span>
            <span />
          </div>
          {criteria.length === 0 && (
            <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
              <span className={tableStyles.mutedCell}>Sin criterios. Añade el primero con «+ Añadir criterio».</span>
            </div>
          )}
          {criteria.map((c, i) => (
            <div
              key={c.key}
              className={`${tableStyles.row} ${editing === c.key ? tableStyles.rowSelected : ''}`}
              style={{ gridTemplateColumns: COLS, opacity: dragKey === c.key ? 0.5 : 1 }}
              draggable
              onDragStart={() => setDragKey(c.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(c.key)}
              onDragEnd={() => setDragKey(null)}
            >
              <span className={styles.handle} aria-hidden>
                ⠿
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                <span className={styles.legendDot} style={{ background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
                {c.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>{c.description || '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <span className={styles.miniBar}>
                  <span style={{ width: `${Math.min(100, c.weight * 2)}%` }} />
                </span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600, color: 'var(--navy)', minWidth: 42, textAlign: 'right' }}>
                  {formatNumber(c.weight)}%
                </span>
              </span>
              <button className={tableStyles.linkAction} onClick={() => setEditing(c.key)}>
                Editar
              </button>
            </div>
          ))}
          <div className={`${styles.sumRow} ${valid ? '' : styles.sumRowError}`}>
            <span style={{ fontSize: 13, fontWeight: 600, color: valid ? 'var(--ink)' : 'var(--error-fg)' }}>Suma total de pesos</span>
            {valid ? (
              <StatusBadge tone="done" label="VÁLIDO" />
            ) : (
              <ErrorBadge label={missing > 0 ? `FALTAN ${formatNumber(missing)} %` : missing < 0 ? `SOBRAN ${formatNumber(-missing)} %` : 'REVISA LOS PESOS'} />
            )}
            <span className={styles.sumValue} style={{ color: valid ? undefined : 'var(--error-dot)' }}>
              {formatNumber(sum)}%
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className={styles.small} style={{ flex: 1, minWidth: 260 }}>
            {valid
              ? 'Arrastra ⠿ para cambiar el orden en que el evaluador ve los criterios. Cambiar pesos con evaluaciones ya hechas recalcula las notas; no borra lo capturado.'
              : 'No se puede guardar ni abrir la evaluación hasta llegar a 100 %. Cada criterio pesa de 0 a 50 %.'}
          </span>
          {saved && !dirty && <span className={`${styles.small} ${styles.green}`}>✓ Rúbrica guardada</span>}
          {dirty && (
            <Button variant="secondary" onClick={() => { setCriteria(toDraft(type)); setScale({ min: type.rubric.scale_min, max: type.rubric.scale_max, step: type.rubric.scale_step }); setEditing(null); }}>
              Descartar cambios
            </Button>
          )}
          <Button disabled={!valid || !dirty || put.isPending} onClick={save}>
            {put.isPending ? 'Guardando…' : 'Guardar rúbrica'}
          </Button>
        </div>
        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}
      </div>

      {current && (
        <CriterionPanel
          key={current.key}
          criterion={current}
          criteria={criteria}
          scale={scale}
          scaleLocked={type.evaluations_exist}
          onScale={setScale}
          onClose={() => setEditing(null)}
          onApply={(patch) => {
            setCriteria((list) => list.map((c) => (c.key === current.key ? { ...c, ...patch } : c)));
            setEditing(null);
          }}
          onRemove={() => {
            setCriteria((list) => list.filter((c) => c.key !== current.key));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CriterionPanel({
  criterion,
  criteria,
  scale,
  scaleLocked,
  onScale,
  onClose,
  onApply,
  onRemove,
}: {
  criterion: DraftCriterion;
  criteria: DraftCriterion[];
  scale: { min: number; max: number; step: number };
  scaleLocked: boolean;
  onScale: (s: { min: number; max: number; step: number }) => void;
  onClose: () => void;
  onApply: (patch: Partial<DraftCriterion>) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(criterion.name);
  const [description, setDescription] = useState(criterion.description);
  const [weight, setWeight] = useState(criterion.weight);
  const preview = criteria.map((c) => (c.key === criterion.key ? { ...c, name, weight } : c));
  const total = preview.reduce((n, c) => n + c.weight, 0);
  const scaleValue = SCALES.findIndex((s) => s.min === scale.min && s.max === scale.max);

  return (
    <aside className={styles.side}>
      <div className={styles.sideHead}>
        <span className={styles.sideTitle}>Editar criterio</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className={styles.fieldLabel}>Nombre</span>
        <input className={styles.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className={styles.fieldLabel}>Descripción para el evaluador</span>
        <textarea className={styles.input} rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'none' }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={styles.fieldLabel}>Escala</span>
          <select
            className={styles.input}
            disabled={scaleLocked}
            value={scaleValue}
            onChange={(e) => {
              const s = SCALES[Number(e.target.value)];
              onScale({ min: s.min, max: s.max, step: s.max >= 100 ? 1 : scale.step });
            }}
          >
            {scaleValue === -1 && <option value={-1}>{`${formatNumber(scale.min)} – ${formatNumber(scale.max)}`}</option>}
            {SCALES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={styles.fieldLabel}>Paso</span>
          <select className={styles.input} disabled={scaleLocked} value={scale.step} onChange={(e) => onScale({ ...scale, step: Number(e.target.value) })}>
            {[0.5, 1].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {scaleLocked && <span className={styles.small}>La escala ya no se puede cambiar: hay evaluaciones capturadas con la actual.</span>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className={styles.fieldLabel}>Peso</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: 'var(--navy)' }}>{formatNumber(weight)}%</span>
        </div>
        <input className={`sl ${styles.slider}`} type="range" min={0} max={50} step={1} value={weight} onChange={(e) => setWeight(Number(e.target.value))} aria-label="Peso" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }} className={styles.small}>
          <span>0%</span>
          <span>50%</span>
        </div>
      </div>

      <div className={shared.panelCard} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 600 }}>REPARTO ACTUAL</span>
        <div className={styles.stacked}>
          {preview.map((c, i) => (
            <span key={c.key} style={{ width: `${Math.min(100, c.weight)}%`, background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {preview.map((c, i) => (
            <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--ink)' }}>
              <span className={styles.legendDot} style={{ background: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
              {c.name} · {formatNumber(c.weight)}%
            </span>
          ))}
        </div>
        <span className={`${styles.small} ${Math.abs(total - 100) < 0.001 ? styles.green : styles.errorText}`} style={{ fontWeight: 600 }}>
          {preview.length} criterios · suma {formatNumber(total)}% ·{' '}
          {Math.abs(total - 100) < 0.001 ? 'sin sobrantes' : total < 100 ? `faltan ${formatNumber(100 - total)}%` : `sobran ${formatNumber(total - 100)}%`}
        </span>
      </div>

      <div className={styles.calloutInfo}>
        La escala es solo para el evaluador. Para el ranking de premios la nota se normaliza a <strong>0–100</strong>.
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className={styles.linkBtn} style={{ color: '#C0392B', marginRight: 'auto' }} onClick={onRemove}>
          Quitar criterio
        </button>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!name.trim()} onClick={() => onApply({ name: name.trim(), description, weight })}>
          Aplicar
        </Button>
      </div>
    </aside>
  );
}

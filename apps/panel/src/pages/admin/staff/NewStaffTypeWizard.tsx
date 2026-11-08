import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@munych/ui/components/Button';
import { Toggle } from '@munych/ui/components/SelectionControls';
import { useCommittees } from '../../../data-access/hooks';
import { useCreateStaffType } from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import type {
  StaffAccessMode,
  StaffAwardIn,
  StaffAwardScope,
  StaffCountsAs,
  StaffEvaluates,
  StaffRubricTemplate,
} from '../../../data-access/staffTypes';
import { Counter, OptionCard, Segmented } from './staffUi';
import { EVALUATES, formatNumber } from './staffLabels';
import shared from '../AdminShared.module.css';
import styles from './Staff.module.css';

const TEMPLATES: { value: StaffRubricTemplate; label: string }[] = [
  { value: 'press', label: 'Plantilla · Prensa (5 criterios)' },
  { value: 'position_papers', label: 'Plantilla · Escritos de posición (4 criterios)' },
  { value: 'oratory', label: 'Plantilla · Oratoria (4 criterios)' },
  { value: 'protocol', label: 'Plantilla · Protocolo (3 criterios)' },
  { value: 'blank', label: 'En blanco' },
];

const DEFAULT_TEMPLATE: Record<StaffEvaluates, StaffRubricTemplate> = {
  delegations: 'protocol',
  delegates: 'oratory',
  position_papers: 'position_papers',
  press: 'press',
};

const STEPS = ['Datos', 'Evaluación y premios', 'Rúbrica', 'Miembros'];

interface Props {
  eventId: string;
  staffWeight: number | null;
  chairWeight: number | null;
  onClose: () => void;
  onCreated: (typeId: string) => void;
}

/**
 * Decisión de diseño (hito 15): pantalla 05 del handoff, asistente en modal. Los pasos 1-2 se
 * llenan aquí; al continuar se crea el tipo y la rúbrica (paso 3) y los miembros (paso 4) se
 * terminan en las pestañas del tipo, que ya tienen su propio editor.
 */
export function NewStaffTypeWizard({ eventId, staffWeight, chairWeight, onClose, onCreated }: Props) {
  const create = useCreateStaffType(eventId);
  const { data: committees } = useCommittees(eventId);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [evaluates, setEvaluates] = useState<StaffEvaluates>('delegates');
  const [scope, setScope] = useState<'all' | 'some'>('all');
  const [committeeIds, setCommitteeIds] = useState<string[]>([]);
  const [minEvaluators, setMinEvaluators] = useState(2);
  const [awards, setAwards] = useState<StaffAwardIn[]>([{ name: '', winners: 1, scope: 'event' }]);
  const [countsAs, setCountsAs] = useState<StaffCountsAs>('none');
  const [template, setTemplate] = useState<StaffRubricTemplate>('oratory');
  const [templateTouched, setTemplateTouched] = useState(false);
  const [access, setAccess] = useState<StaffAccessMode>('link');
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function chooseEvaluates(value: StaffEvaluates) {
    setEvaluates(value);
    if (!templateTouched) setTemplate(DEFAULT_TEMPLATE[value]);
  }

  const scopeCount = scope === 'all' ? (committees?.length ?? 0) : committeeIds.length;
  const perCommitteeTotal = awards.filter((a) => a.scope === 'per_committee').reduce((n, a) => n + a.winners * scopeCount, 0);

  function updateAward(i: number, patch: Partial<StaffAwardIn>) {
    setAwards((list) => list.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  }

  async function handleCreate() {
    setError('');
    if (scope === 'some' && committeeIds.length === 0) {
      setError('Elige al menos un comité o usa «Todos los comités».');
      return;
    }
    try {
      const detail = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        evaluates,
        all_committees: scope === 'all',
        committee_ids: scope === 'all' ? [] : committeeIds,
        min_evaluators: minEvaluators,
        counts_as: countsAs,
        access,
        template,
        awards: awards.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })),
      });
      onCreated(detail.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return createPortal(
    <div className={`${shared.overlay} ${styles.root}`} style={{ background: 'rgba(26,48,121,.42)' }} onClick={onClose}>
      <div className={`${shared.modalCard} ${styles.wizard}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={shared.modalHeader} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--muted)', fontWeight: 600 }}>NUEVO TIPO DE STAFF</span>
              <span className={styles.typeTitle} style={{ fontSize: 22 }}>
                {name.trim() || 'Sin nombre'}
              </span>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className={styles.stepper}>
            {STEPS.map((label, i) => (
              <span key={label} className={`${styles.step} ${i === step ? styles.stepCurrent : ''} ${i < step ? styles.stepDone : ''}`}>
                <span className={styles.stepDot}>{i < step ? '✓' : i + 1}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.wizardBody}>
          {step === 0 && (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className={styles.fieldLabel}>Nombre del staff</span>
                <input
                  className={styles.input}
                  value={name}
                  maxLength={80}
                  autoFocus
                  placeholder="p. ej. Oratoria, Prensa, Pajes y protocolo"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className={styles.fieldLabel}>Descripción (opcional)</span>
                <textarea
                  className={styles.input}
                  rows={3}
                  maxLength={300}
                  value={description}
                  placeholder="Qué hace este staff y qué observa."
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={styles.fieldLabel}>¿Cómo entra la gente de este staff?</span>
                <div className={styles.optionGrid} role="radiogroup">
                  <OptionCard
                    title="QR por correo"
                    desc="Sin cuenta: recibe su QR personal y evalúa con la rúbrica de este staff."
                    active={access === 'link'}
                    onClick={() => setAccess('link')}
                  />
                  <OptionCard
                    title="Cuenta con contraseña"
                    desc="Como la Mesa Directiva: crea su contraseña y califica en el panel del juez, con rol de mesa en su comité."
                    active={access === 'account'}
                    onClick={() => setAccess('account')}
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={styles.fieldLabel}>¿Qué evalúa este staff?</span>
                <div className={styles.optionGrid} role="radiogroup">
                  {(Object.keys(EVALUATES) as StaffEvaluates[]).map((key) => (
                    <OptionCard
                      key={key}
                      title={EVALUATES[key].label}
                      desc={EVALUATES[key].desc}
                      active={evaluates === key}
                      onClick={() => chooseEvaluates(key)}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className={styles.fieldLabel}>Alcance</span>
                  <Segmented
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: 'all', label: 'Todos los comités' },
                      { value: 'some', label: 'Elegir comités' },
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className={styles.fieldLabel}>Evaluadores mínimos por candidato</span>
                  <Counter value={minEvaluators} onChange={setMinEvaluators} />
                </div>
              </div>
              {scope === 'some' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(committees ?? []).map((c) => {
                    const on = committeeIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`${styles.segment} ${on ? styles.segmentActive : ''}`}
                        style={{ flex: 'none', border: '1px solid var(--border)' }}
                        aria-pressed={on}
                        onClick={() => setCommitteeIds((ids) => (on ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}
                      >
                        {on ? '✓ ' : ''}
                        {c.acronym}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={styles.fieldLabel}>Premios que otorga</span>
                {awards.map((a, i) => (
                  <div key={i} className={styles.awardEditRow}>
                    <input
                      className={styles.input}
                      placeholder="Nombre del premio"
                      value={a.name}
                      maxLength={80}
                      onChange={(e) => updateAward(i, { name: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      max={20}
                      value={a.winners}
                      aria-label="Ganadores"
                      onChange={(e) => updateAward(i, { winners: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                      style={{ textAlign: 'center' }}
                    />
                    <select
                      className={styles.input}
                      value={a.scope}
                      onChange={(e) => updateAward(i, { scope: e.target.value as StaffAwardScope })}
                    >
                      <option value="per_committee">Por comité</option>
                      <option value="event">Todo el evento</option>
                    </select>
                    <button className={styles.closeBtn} onClick={() => setAwards((l) => l.filter((_, j) => j !== i))} aria-label="Quitar premio">
                      ✕
                    </button>
                  </div>
                ))}
                <button className={styles.linkBtn} style={{ alignSelf: 'flex-start' }} onClick={() => setAwards((l) => [...l, { name: '', winners: 1, scope: 'event' }])}>
                  + Añadir premio
                </button>
                {perCommitteeTotal > 0 && (
                  <span className={styles.small}>
                    «Por comité» entrega sus ganadores en cada comité del alcance ({perCommitteeTotal} premios en total).
                  </span>
                )}
              </div>

              <div className={styles.toggleCard}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className={styles.fieldLabel}>Cuenta para la nota staff del ranking</span>
                  <span className={styles.small}>
                    {staffWeight
                      ? `Si se activa, su promedio entra en el peso Staff del tipo de evento (${formatNumber(staffWeight)} %). Si no, solo decide sus premios.`
                      : 'En este tipo de evento no hay peso Staff: este staff solo decidirá sus premios.'}
                  </span>
                </div>
                <Toggle
                  checked={countsAs === 'staff'}
                  onClick={() => staffWeight && setCountsAs(countsAs === 'staff' ? 'none' : 'staff')}
                />
              </div>
              {chairWeight != null && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
                  <input type="checkbox" checked={countsAs === 'chair'} onChange={(e) => setCountsAs(e.target.checked ? 'chair' : 'none')} />
                  Es la Mesa Directiva: su nota cuenta en el peso Mesa ({formatNumber(chairWeight)} %) en lugar de Staff.
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className={styles.fieldLabel}>Empezar la rúbrica desde</span>
                <select
                  className={styles.input}
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value as StaffRubricTemplate);
                    setTemplateTouched(true);
                  }}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}
        </div>

        <div className={shared.modalFooter} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          {step > 0 ? (
            <button className={styles.linkBtn} onClick={() => setStep(step - 1)}>
              ‹ {STEPS[step - 1]}
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {step === 0 ? (
              <Button disabled={!name.trim()} onClick={() => setStep(1)}>
                Siguiente: evaluación ›
              </Button>
            ) : (
              <Button disabled={create.isPending} onClick={handleCreate}>
                {create.isPending ? 'Creando…' : 'Siguiente: rúbrica ›'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

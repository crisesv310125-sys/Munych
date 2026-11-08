import { useState } from 'react';
import { Button } from '@munych/ui/components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useUpdateStaffType } from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import type { StaffAccessMode, StaffCountsAs, StaffEvaluates, StaffTypeDetail } from '../../../data-access/staffTypes';
import { Counter, OptionCard, Segmented, StaffTypeTag } from './staffUi';
import { EVALUATES, formatNumber } from './staffLabels';
import shared from '../AdminShared.module.css';
import styles from './Staff.module.css';

const COLORS = ['#418FDE', '#2F6BA8', '#C9A227', '#123B63', '#1A3079', '#F18701', '#2F8F6E', '#98A6B5'];

export function ConfigTab({
  type,
  eventId,
  staffWeight,
  chairWeight,
  onArchived,
}: {
  type: StaffTypeDetail;
  eventId: string;
  staffWeight: number | null;
  chairWeight: number | null;
  onArchived: () => void;
}) {
  const update = useUpdateStaffType(type.id, eventId);
  const [name, setName] = useState(type.name);
  const [code, setCode] = useState(type.code);
  const [color, setColor] = useState(type.color);
  const [description, setDescription] = useState(type.description ?? '');
  const [evaluates, setEvaluates] = useState<StaffEvaluates | null>(type.evaluates);
  const [scope, setScope] = useState<'all' | 'some'>(type.all_committees ? 'all' : 'some');
  const [committeeIds, setCommitteeIds] = useState<string[]>(type.committee_ids);
  const [minEvaluators, setMinEvaluators] = useState(type.min_evaluators);
  const [countsAs, setCountsAs] = useState<StaffCountsAs>(type.counts_as);
  const [access, setAccess] = useState<StaffAccessMode>(type.access);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const evaluatesLocked = type.evaluations_exist && type.evaluates !== null;

  async function save() {
    setError('');
    setSaved(false);
    try {
      await update.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        color,
        description: description.trim() || null,
        ...(evaluates ? { evaluates } : {}),
        all_committees: scope === 'all',
        committee_ids: scope === 'all' ? [] : committeeIds,
        min_evaluators: minEvaluators,
        counts_as: countsAs,
        access,
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function archive() {
    setConfirmArchive(false);
    try {
      await update.mutateAsync({ archived: true });
      onArchived();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const countsOptions: { value: StaffCountsAs; label: string }[] = [
    { value: 'none', label: 'Solo premios' },
    ...(staffWeight != null ? [{ value: 'staff' as const, label: `Nota staff (${formatNumber(staffWeight)} %)` }] : []),
    ...(chairWeight != null ? [{ value: 'chair' as const, label: `Nota mesa (${formatNumber(chairWeight)} %)` }] : []),
  ];

  return (
    <div className={shared.content} style={{ maxWidth: 820 }}>
      <div className={shared.panelCard} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className={styles.fieldLabel}>Nombre</span>
            <input className={styles.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className={styles.fieldLabel}>Siglas</span>
            <input
              className={styles.input}
              value={code}
              maxLength={3}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
            />
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className={styles.fieldLabel}>Color</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: c,
                  border: color === c ? '2px solid var(--ink)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
            <span style={{ marginLeft: 8 }}>
              <StaffTypeTag code={code || '?'} color={color} />
            </span>
          </div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className={styles.fieldLabel}>Descripción</span>
          <textarea className={styles.input} rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'none' }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className={styles.fieldLabel}>¿Qué evalúa este staff?</span>
          {evaluatesLocked && <span className={styles.small}>Ya hay evaluaciones capturadas: no se puede cambiar a quién evalúa.</span>}
          <div className={styles.optionGrid} role="radiogroup" style={evaluatesLocked ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
            {(Object.keys(EVALUATES) as StaffEvaluates[]).map((key) => (
              <OptionCard key={key} title={EVALUATES[key].label} desc={EVALUATES[key].desc} active={evaluates === key} onClick={() => setEvaluates(key)} />
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
            {type.committees.map((c) => {
              const on = committeeIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.segment} ${on ? styles.segmentActive : ''}`}
                  style={{ flex: 'none', border: '1px solid var(--border)' }}
                  aria-pressed={on}
                  title={c.name}
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
          <span className={styles.fieldLabel}>¿Cómo entra la gente de este staff?</span>
          <Segmented
            value={access}
            onChange={setAccess}
            options={[
              { value: 'link', label: 'QR por correo' },
              { value: 'account', label: 'Cuenta con contraseña' },
            ]}
          />
          <span className={styles.small}>
            {access === 'link'
              ? 'Al invitarlos reciben un correo con su QR personal y evalúan con la rúbrica de este staff, sin cuenta.'
              : 'Al invitarlos reciben un correo para crear su contraseña y califican en el panel del juez, con rol de mesa en su comité (como la Mesa Directiva).'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className={styles.fieldLabel}>Cuenta en el ranking general</span>
          <Segmented value={countsAs} onChange={setCountsAs} options={countsOptions} />
          <span className={styles.small}>
            {countsAs === 'none' && 'Este staff solo decide sus premios propios.'}
            {countsAs === 'staff' && 'Su promedio entra en el peso Staff. Si varios tipos cuentan para Staff, se promedian entre sí.'}
            {countsAs === 'chair' &&
              'Su promedio sustituye a la calificación de la Mesa Directiva en el ranking (cuando su rúbrica es válida). Si varios tipos cuentan como mesa, se promedian.'}
          </span>
        </div>

        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className={styles.linkBtn} style={{ color: '#C0392B', marginRight: 'auto' }} onClick={() => setConfirmArchive(true)}>
            Archivar este staff
          </button>
          {saved && <span className={`${styles.small} ${styles.green}`}>✓ Guardado</span>}
          <Button disabled={!name.trim() || !code.trim() || (scope === 'some' && committeeIds.length === 0) || update.isPending} onClick={save}>
            {update.isPending ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </div>
      </div>

      {confirmArchive && (
        <ConfirmDialog
          title="Archivar staff"
          message={`«${type.name}» dejará de aparecer en la lista y sus miembros ya no podrán evaluar. No se borra nada: miembros, evaluaciones y premios se conservan.`}
          onClose={() => setConfirmArchive(false)}
          actions={[
            { label: 'Cancelar', onClick: () => setConfirmArchive(false) },
            { label: 'Archivar', variant: 'danger', onClick: archive },
          ]}
        />
      )}
    </div>
  );
}

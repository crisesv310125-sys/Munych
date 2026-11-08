import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { useStaffOverview, useStaffType } from '../../../data-access/staffHooks';
import type { StaffTypeDetail } from '../../../data-access/staffTypes';
import { AwardsTab } from './AwardsTab';
import { ConfigTab } from './ConfigTab';
import { MembersTab } from './MembersTab';
import { RubricTab } from './RubricTab';
import { EventPicker, StaffTypeTag, TypeStatusBadge } from './staffUi';
import { useStaffScope } from './useStaffScope';
import { EVALUATES, countsLabel } from './staffLabels';
import shared from '../AdminShared.module.css';
import styles from './Staff.module.css';

type Tab = 'miembros' | 'rubrica' | 'premios' | 'configuracion';
const TABS: Tab[] = ['miembros', 'rubrica', 'premios', 'configuracion'];

/** Acciones de la cabecera que cada pestaña pone en la barra superior. */
export type TopActions = (actions: ReactNode) => void;

/**
 * Decisión de diseño (hito 15): pantallas 02-04 del handoff gestion-staff. Cabecera del tipo
 * compartida y pestañas Miembros · Rúbrica · Premios · Configuración, cada una con su panel
 * lateral derecho.
 */
export function StaffTypePage() {
  const { typeId = '' } = useParams<{ typeId: string }>();
  const scope = useStaffScope();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'miembros';
  const { data: type, isLoading, error } = useStaffType(typeId, scope.eventId);
  const { data: overview } = useStaffOverview(scope.eventId);
  const [actions, setActions] = useState<ReactNode>(null);
  // Evento de contexto: el elegido o el que resolvió el backend (activo más reciente).
  const eventId = type?.event_id ?? scope.eventId;

  const back = () => navigate(scope.link(''));
  const setTab = (next: Tab) => {
    setActions(null);
    const nextParams = new URLSearchParams(params);
    if (next === 'miembros') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  if (error) {
    return (
      <div className={shared.page}>
        <div className={shared.content}>
          <span style={{ color: '#C0392B', fontSize: 13 }}>No se encontró este tipo de staff.</span>
          <button className={styles.linkBtn} onClick={back} style={{ alignSelf: 'flex-start' }}>
            ‹ Volver a Staff
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shared.page} ${styles.root}`}>
      <div className={shared.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.breadcrumb}>
            <button onClick={back}>Staff</button> / {type?.name ?? '…'}
          </span>
          <span className={shared.topbarTitle}>Staff</span>
          <span className={shared.topbarSub}>
            {overview?.organization_name || 'Organización'} · {overview?.types.length ?? 0} tipos de staff · {overview?.people ?? 0} miembros
          </span>
        </div>
        <div className={shared.topbarActions}>
          {!scope.fixed && overview && <EventPicker events={overview.events} value={eventId} onChange={scope.setEvent} />}
          {actions}
        </div>
      </div>

      {isLoading || !type ? (
        <div className={shared.content}>
          <span className={styles.small}>Cargando…</span>
        </div>
      ) : (
        <>
          <TypeHeader type={type} tab={tab} onTab={setTab} staffWeight={overview?.staff_weight ?? null} chairWeight={overview?.chair_weight ?? null} />
          {tab === 'miembros' && <MembersTab type={type} eventId={eventId} setActions={setActions} />}
          {tab === 'rubrica' && (
            <RubricTab type={type} eventId={eventId} setActions={setActions} onEditScope={() => setTab('configuracion')} />
          )}
          {tab === 'premios' && <AwardsTab type={type} eventId={eventId} eventName={overview?.event_name ?? null} setActions={setActions} />}
          {tab === 'configuracion' && (
            <ConfigTab
              type={type}
              eventId={eventId}
              staffWeight={overview?.staff_weight ?? null}
              chairWeight={overview?.chair_weight ?? null}
              onArchived={back}
            />
          )}
        </>
      )}
    </div>
  );
}

function TypeHeader({
  type,
  tab,
  onTab,
  staffWeight,
  chairWeight,
}: {
  type: StaffTypeDetail;
  tab: Tab;
  onTab: (t: Tab) => void;
  staffWeight: number | null;
  chairWeight: number | null;
}) {
  const counts = type.counts_as === 'none' ? 'solo premios, no cuenta en la nota staff' : countsLabel(type.counts_as, staffWeight, chairWeight).toLowerCase();
  const labels: Record<Tab, [string, string]> = {
    miembros: ['Miembros', String(type.members_count)],
    rubrica: ['Rúbrica', `${type.criteria_count} criterios`],
    premios: ['Premios', String(type.awards.length)],
    configuracion: ['Configuración', ''],
  };
  return (
    <div className={styles.typeHeader}>
      <div className={styles.typeHeaderTop}>
        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          <StaffTypeTag code={type.code} color={type.color} large />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={styles.typeTitle}>{type.name}</span>
              <TypeStatusBadge type={type} />
            </div>
            <span className={styles.small} style={{ fontSize: 12 }}>
              {type.evaluates ? (
                <>
                  Evalúa a <strong style={{ color: 'var(--ink)' }}>{EVALUATES[type.evaluates].candidates.toLowerCase()}</strong> · {counts}
                </>
              ) : (
                'Todavía no está configurado a quién evalúa.'
              )}
            </span>
          </div>
        </div>
        <div className={styles.typeStats}>
          <div className={styles.typeStat}>
            <span className={styles.typeStatLabel}>MIEMBROS</span>
            <span className={styles.typeStatValue}>{type.members_count}</span>
          </div>
          <div className={styles.typeStat}>
            <span className={styles.typeStatLabel}>CANDIDATOS</span>
            <span className={styles.typeStatValue}>{type.candidates}</span>
          </div>
          <div className={styles.typeStat} style={{ minWidth: 110 }}>
            <span className={styles.typeStatLabel}>AVANCE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.typeStatValue}>{type.progress != null ? `${Math.round(type.progress)}%` : '—'}</span>
              <div style={{ width: 48 }}>
                <ProgressBar percent={type.progress ?? 0} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => onTab(t)}>
            {labels[t][0]}
            {labels[t][1] && <span className={styles.tabCount}>{labels[t][1]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

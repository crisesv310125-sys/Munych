import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { useStaffOverview, useStaffType } from '../../../data-access/staffHooks';
import type { StaffTypeDetail } from '../../../data-access/staffTypes';
import { AwardsTab } from './AwardsTab';
import { ConfigTab } from './ConfigTab';
import { MembersTab } from './MembersTab';
import { RubricTab } from './RubricTab';
import { StaffTypeTag, TypeStatusBadge } from './staffUi';
import { useStaffScope } from './useStaffScope';
import { EVALUATES, countsLabel } from './staffLabels';
import shared from '../AdminShared.module.css';
import styles from './Staff.module.css';

type Tab = 'miembros' | 'rubrica' | 'premios' | 'configuracion';
/** Admin general: solo el tipo (sirve para cualquier evento). Evento: personas, avance y premios. */
const ORG_TABS: Tab[] = ['rubrica', 'premios', 'configuracion'];
const EVENT_TABS: Tab[] = ['miembros', 'premios'];

/** Acciones de la cabecera que cada pestaña pone en la barra superior. */
export type TopActions = (actions: ReactNode) => void;

/**
 * Decisión de diseño (hito 15): pantallas 02-04 del handoff gestion-staff.
 * - En el admin general (`/admin/staff/:id`) se configura el tipo: rúbrica, premios
 *   (definiciones) y configuración. No se administran personas.
 * - Dentro de un evento (`/admin/eventos/:id/staff/:typeId`) se ven sus personas (se
 *   invitan desde Jueces), el avance y el ranking, y se asignan los premios del evento.
 */
export function StaffTypePage() {
  const { typeId = '' } = useParams<{ typeId: string }>();
  const scope = useStaffScope();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabs = scope.fixed ? EVENT_TABS : ORG_TABS;
  const asked = params.get('tab') as Tab;
  const tab: Tab = tabs.includes(asked) ? asked : tabs[0];
  const { data: type, isLoading, error } = useStaffType(typeId, scope.eventId);
  const { data: overview } = useStaffOverview(scope.eventId);
  const [actions, setActions] = useState<ReactNode>(null);
  const eventId = type?.event_id ?? scope.eventId;

  const back = () => navigate(scope.link(''));
  const setTab = (next: Tab) => {
    setActions(null);
    const nextParams = new URLSearchParams(params);
    if (next === tabs[0]) nextParams.delete('tab');
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
            {scope.fixed
              ? `${overview?.event_name ?? '—'} · personas, avance y premios de este evento`
              : `${overview?.organization_name || 'Organización'} · tipo de staff para cualquier evento`}
          </span>
        </div>
        <div className={shared.topbarActions}>{actions}</div>
      </div>

      {isLoading || !type ? (
        <div className={shared.content}>
          <span className={styles.small}>Cargando…</span>
        </div>
      ) : (
        <>
          <TypeHeader
            type={type}
            tab={tab}
            tabs={tabs}
            inEvent={scope.fixed}
            onTab={setTab}
            staffWeight={overview?.staff_weight ?? null}
            chairWeight={overview?.chair_weight ?? null}
          />
          {tab === 'miembros' && <MembersTab type={type} eventId={eventId} setActions={setActions} />}
          {tab === 'rubrica' && (
            <RubricTab type={type} eventId={eventId} setActions={setActions} onEditScope={() => setTab('configuracion')} />
          )}
          {tab === 'premios' && (
            <AwardsTab
              type={type}
              eventId={eventId}
              eventName={overview?.event_name ?? null}
              setActions={setActions}
              definitionsOnly={!scope.fixed}
            />
          )}
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
  tabs,
  inEvent,
  onTab,
  staffWeight,
  chairWeight,
}: {
  type: StaffTypeDetail;
  tab: Tab;
  tabs: Tab[];
  inEvent: boolean;
  onTab: (t: Tab) => void;
  staffWeight: number | null;
  chairWeight: number | null;
}) {
  const account = type.access === 'account';
  const counts = type.counts_as === 'none' ? 'solo premios, no cuenta en la nota staff' : countsLabel(type.counts_as, staffWeight, chairWeight).toLowerCase();
  const labels: Record<Tab, [string, string]> = {
    miembros: ['Personas', String(type.members_count)],
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
              {inEvent && !account && <TypeStatusBadge type={type} />}
            </div>
            <span className={styles.small} style={{ fontSize: 12 }}>
              {account ? (
                <>
                  Entra con <strong style={{ color: 'var(--ink)' }}>cuenta y contraseña</strong> y califica en el panel del juez, con
                  rol de mesa en su comité.
                </>
              ) : type.evaluates ? (
                <>
                  Evalúa a <strong style={{ color: 'var(--ink)' }}>{EVALUATES[type.evaluates].candidates.toLowerCase()}</strong> · entra
                  con QR · {counts}
                </>
              ) : (
                'Todavía no está configurado a quién evalúa.'
              )}
            </span>
          </div>
        </div>
        {inEvent && !account && (
          <div className={styles.typeStats}>
            <div className={styles.typeStat}>
              <span className={styles.typeStatLabel}>PERSONAS</span>
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
        )}
      </div>
      <div className={styles.tabs} role="tablist">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => onTab(t)}>
            {labels[t][0]}
            {labels[t][1] && <span className={styles.tabCount}>{labels[t][1]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

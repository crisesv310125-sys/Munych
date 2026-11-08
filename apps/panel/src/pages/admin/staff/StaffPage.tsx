import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { useStaffOverview, useStaffPeople } from '../../../data-access/staffHooks';
import { initialsFor } from '../../../lib/initials';
import type { StaffTypeSummary } from '../../../data-access/staffTypes';
import { NewStaffTypeWizard } from './NewStaffTypeWizard';
import { AwardChip, EventPicker, RubricBadge, StaffTypeTag, TypeStatusBadge } from './staffUi';
import { useStaffScope } from './useStaffScope';
import { EVALUATES, countsLabel, formatNumber } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '2.7fr 1.15fr 1.3fr 1fr 1.6fr .95fr 1.35fr 96px';
const AVATAR_COLORS = ['var(--navy)', 'var(--un-blue)', 'var(--weight-3)', 'var(--muted)'];

/**
 * Decisión de diseño (hito 15): pantalla 01 «Tipos de staff» del handoff gestion-staff.
 * El staff es de la organización: se abre desde el admin general (con selector de evento)
 * o desde un evento. El avance y los premios son los del evento elegido.
 */
export function StaffPage() {
  const scope = useStaffScope();
  const navigate = useNavigate();
  const { data, isLoading, error } = useStaffOverview(scope.eventId);
  const { data: people } = useStaffPeople();
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const types = useMemo(() => data?.types ?? [], [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    if (!q) return types;
    const byPerson = new Set(
      (people ?? []).filter((p) => p.full_name.toLocaleLowerCase('es').includes(q)).flatMap((p) => p.types),
    );
    return types.filter((t) => t.name.toLocaleLowerCase('es').includes(q) || byPerson.has(t.name));
  }, [types, people, query]);

  const configured = types.filter((t) => t.status !== 'not_configured').length;
  const open = (typeId: string) => navigate(scope.link(`/${typeId}`));

  return (
    <div className={`${shared.page} ${styles.root}`}>
      <div className={shared.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={shared.topbarTitle}>Staff</span>
          <span className={shared.topbarSub}>
            {data?.organization_name || 'Organización'} · {types.length} tipos de staff · {data?.people ?? 0} miembros
          </span>
        </div>
        <div className={shared.topbarActions}>
          {!scope.fixed && data && (
            <EventPicker events={data.events} value={data.event_id ?? ''} onChange={scope.setEvent} />
          )}
          <input
            className={shared.searchInput}
            placeholder="Buscar staff o persona…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar staff o persona"
          />
          <Button onClick={() => setWizardOpen(true)}>+ Nuevo tipo de staff</Button>
        </div>
      </div>

      <div className={shared.content}>
        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>No se pudo cargar el staff. Recarga la página.</span>}

        <div className={shared.kpiGrid}>
          <div className={shared.kpiCard}>
            <span className={shared.kpiLabel}>TIPOS DE STAFF</span>
            <span className={shared.kpiValue}>{types.length}</span>
            <span className={shared.kpiSub}>
              {configured} configurados · {types.length - configured} pendiente{types.length - configured === 1 ? '' : 's'}
            </span>
          </div>
          <div className={shared.kpiCard}>
            <span className={shared.kpiLabel}>MIEMBROS</span>
            <span className={shared.kpiValue}>{data?.people ?? 0}</span>
            <span className={shared.kpiSub}>{data?.people_active ?? 0} con acceso activo</span>
          </div>
          <div className={shared.kpiCard}>
            <span className={shared.kpiLabel}>PREMIOS PROPIOS</span>
            <span className={shared.kpiValue}>{data?.awards_total ?? 0}</span>
            <span className={shared.kpiSub}>
              {data?.awards_assigned ?? 0} asignados · {(data?.awards_total ?? 0) - (data?.awards_assigned ?? 0)} por decidir
            </span>
          </div>
          <div className={`${shared.kpiCard} ${shared.kpiInverted}`}>
            <span className={shared.kpiLabel}>AVANCE DE EVALUACIÓN{data?.event_name ? ` · ${data.event_name.toUpperCase()}` : ''}</span>
            <span className={shared.kpiValue}>{data?.progress != null ? `${Math.round(data.progress)}%` : '—'}</span>
            <ProgressBar percent={data?.progress ?? 0} trackColor="rgba(255,255,255,.15)" />
          </div>
        </div>

        <div className={shared.panelCard}>
          <div className={tableStyles.scrollWrap}>
            <div style={{ minWidth: 980 }}>
              <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
                <span>Tipo de staff</span>
                <span>Evalúa</span>
                <span>Miembros</span>
                <span>Rúbrica</span>
                <span>Premios propios</span>
                <span>Nota staff</span>
                <span>Avance</span>
                <span style={{ textAlign: 'right' }}>Estado</span>
              </div>
              {isLoading && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>Cargando…</span>
                </div>
              )}
              {!isLoading && visible.length === 0 && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>
                    {types.length === 0 ? 'Este evento todavía no tiene tipos de staff.' : 'Ningún staff coincide con la búsqueda.'}
                  </span>
                </div>
              )}
              {visible.map((t) => (
                <TypeRow
                  key={t.id}
                  type={t}
                  staffWeight={data?.staff_weight ?? null}
                  chairWeight={data?.chair_weight ?? null}
                  onOpen={() => open(t.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.dashedNote}>
          <strong style={{ color: 'var(--ink)' }}>Cómo funciona.</strong> Cada tipo de staff evalúa a su propio grupo de candidatos
          con su rúbrica y entrega sus premios propios (p. ej. Prensa → Mejor periodista). Solo los tipos marcados con{' '}
          <strong style={{ color: 'var(--ink)' }}>«Cuenta en nota staff»</strong> (o en nota mesa) aportan a ese peso del ranking
          general; si hay varios, se promedian entre sí.
        </div>
      </div>

      {wizardOpen && (
        <NewStaffTypeWizard
          eventId={data?.event_id ?? ''}
          staffWeight={data?.staff_weight ?? null}
          chairWeight={data?.chair_weight ?? null}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => navigate(scope.link(`/${id}`, { tab: 'rubrica' }))}
        />
      )}
    </div>
  );
}

function TypeRow({
  type: t,
  staffWeight,
  chairWeight,
  onOpen,
}: {
  type: StaffTypeSummary;
  staffWeight: number | null;
  chairWeight: number | null;
  onOpen: () => void;
}) {
  const unconfigured = t.status === 'not_configured' && t.members_count === 0 && t.criteria_count === 0;
  return (
    <div className={tableStyles.row} style={{ gridTemplateColumns: COLS, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 0 }}>
        <StaffTypeTag code={t.code} color={unconfigured ? 'var(--state-none-dot)' : t.color} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span className={styles.serifName}>{t.name}</span>
          {t.description && <span className={styles.small}>{t.description}</span>}
        </div>
      </div>
      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t.evaluates ? EVALUATES[t.evaluates].candidates : '—'}</span>
      {t.members_count > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.avatarStack}>
            {t.members_preview.map((name, i) => (
              <Avatar key={name + i} initials={initialsFor(name)} size={26} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
            ))}
          </span>
          <span className={styles.small}>
            {t.members_count} miembro{t.members_count === 1 ? '' : 's'}
          </span>
        </div>
      ) : (
        <span className={`${styles.small} ${styles.faint}`}>Sin miembros</span>
      )}
      {t.criteria_count > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t.criteria_count} criterios</span>
          <RubricBadge valid={t.rubric_valid} sum={t.weight_sum} />
        </div>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>Sin rúbrica</span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {t.awards.length === 0 && <span className={styles.faint}>—</span>}
        {t.awards.map((a) => (
          <AwardChip key={a.id}>
            {a.name}
            {a.scope === 'per_committee' ? ' · por comité' : a.winners > 1 ? ` ×${a.winners}` : ''}
          </AwardChip>
        ))}
      </div>
      <span className={`${styles.small} ${t.counts_as !== 'none' ? styles.green : ''}`} style={{ fontWeight: t.counts_as !== 'none' ? 600 : 400 }}>
        {countsLabel(t.counts_as, staffWeight, chairWeight)}
      </span>
      {t.progress != null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <ProgressBar percent={t.progress} color={t.progress >= 100 ? 'var(--state-done-dot)' : 'var(--gold)'} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{formatNumber(Math.round(t.progress))}%</span>
          </div>
          <span className={styles.small}>
            {t.evaluations_done} de {t.evaluations_expected} evaluaciones
          </span>
        </div>
      ) : (
        <span className={styles.faint}>—</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <TypeStatusBadge type={t} />
        <button
          className={styles.linkBtn}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Abrir ›
        </button>
      </div>
    </div>
  );
}

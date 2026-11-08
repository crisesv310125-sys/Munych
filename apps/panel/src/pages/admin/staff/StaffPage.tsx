import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useStaffOverview } from '../../../data-access/staffHooks';
import { initialsFor } from '../../../lib/initials';
import type { StaffTypeSummary } from '../../../data-access/staffTypes';
import { NewStaffTypeWizard } from './NewStaffTypeWizard';
import { AwardChip, RubricBadge, StaffTypeTag, TypeStatusBadge } from './staffUi';
import { useStaffScope } from './useStaffScope';
import { EVALUATES, countsLabel, formatNumber } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

/** Admin general: solo los tipos. Evento: personas y avance de ese evento. */
const ORG_COLS = '2.7fr 1.2fr 1.2fr 1fr 1.7fr 1fr 96px';
const EVENT_COLS = '2.7fr 1.15fr 1.3fr 1.6fr 1.35fr 110px';
const AVATAR_COLORS = ['var(--navy)', 'var(--un-blue)', 'var(--weight-3)', 'var(--muted)'];

/**
 * Decisión de diseño (hito 15): pantalla 01 «Tipos de staff» del handoff gestion-staff.
 * - Admin general (`/admin/staff`): se administran los tipos de staff, que sirven para
 *   cualquier evento. No se administran personas.
 * - Dentro de un evento: los mismos tipos con sus personas (invitadas desde Jueces), el avance
 *   de evaluación y los premios de ese evento.
 */
export function StaffPage() {
  const scope = useStaffScope();
  const navigate = useNavigate();
  const inEvent = scope.fixed;
  const { data, isLoading, error } = useStaffOverview(scope.eventId);
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const types = useMemo(() => data?.types ?? [], [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return q ? types.filter((t) => t.name.toLocaleLowerCase('es').includes(q)) : types;
  }, [types, query]);

  const open = (typeId: string) => navigate(scope.link(`/${typeId}`));
  const withRubric = types.filter((t) => t.access === 'account' || t.rubric_valid).length;
  const awardDefinitions = types.reduce((n, t) => n + t.awards.length, 0);
  const cols = inEvent ? EVENT_COLS : ORG_COLS;

  return (
    <div className={`${shared.page} ${styles.root}`}>
      <div className={shared.topbar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={shared.topbarTitle}>Staff</span>
          <span className={shared.topbarSub}>
            {inEvent
              ? `${data?.event_name ?? '—'} · ${types.length} tipos de staff · ${data?.people ?? 0} personas`
              : `${data?.organization_name || 'Organización'} · ${types.length} tipos de staff · sirven para cualquier evento`}
          </span>
        </div>
        <div className={shared.topbarActions}>
          <input
            className={shared.searchInput}
            placeholder="Buscar tipo de staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar tipo de staff"
          />
          {inEvent ? (
            <Button onClick={() => navigate(`/admin/eventos/${scope.eventId}/jueces`)}>+ Invitar persona</Button>
          ) : (
            <Button onClick={() => setWizardOpen(true)}>+ Nuevo tipo de staff</Button>
          )}
        </div>
      </div>

      <div className={shared.content}>
        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>No se pudo cargar el staff. Recarga la página.</span>}

        <div className={shared.kpiGrid}>
          <div className={shared.kpiCard}>
            <span className={shared.kpiLabel}>TIPOS DE STAFF</span>
            <span className={shared.kpiValue}>{types.length}</span>
            <span className={shared.kpiSub}>
              {withRubric} listos · {types.length - withRubric} por configurar
            </span>
          </div>
          {inEvent ? (
            <>
              <div className={shared.kpiCard}>
                <span className={shared.kpiLabel}>PERSONAS EN EL EVENTO</span>
                <span className={shared.kpiValue}>{data?.people ?? 0}</span>
                <span className={shared.kpiSub}>{data?.people_active ?? 0} ya entraron con su QR</span>
              </div>
              <div className={shared.kpiCard}>
                <span className={shared.kpiLabel}>PREMIOS PROPIOS</span>
                <span className={shared.kpiValue}>{data?.awards_total ?? 0}</span>
                <span className={shared.kpiSub}>
                  {data?.awards_assigned ?? 0} asignados · {(data?.awards_total ?? 0) - (data?.awards_assigned ?? 0)} por decidir
                </span>
              </div>
              <div className={`${shared.kpiCard} ${shared.kpiInverted}`}>
                <span className={shared.kpiLabel}>AVANCE DE EVALUACIÓN</span>
                <span className={shared.kpiValue}>{data?.progress != null ? `${Math.round(data.progress)}%` : '—'}</span>
                <ProgressBar percent={data?.progress ?? 0} trackColor="rgba(255,255,255,.15)" />
              </div>
            </>
          ) : (
            <>
              <div className={shared.kpiCard}>
                <span className={shared.kpiLabel}>CON QR POR CORREO</span>
                <span className={shared.kpiValue}>{types.filter((t) => t.access === 'link').length}</span>
                <span className={shared.kpiSub}>Evalúan con su propia rúbrica</span>
              </div>
              <div className={shared.kpiCard}>
                <span className={shared.kpiLabel}>CON CONTRASEÑA</span>
                <span className={shared.kpiValue}>{types.filter((t) => t.access === 'account').length}</span>
                <span className={shared.kpiSub}>Califican en el panel del juez</span>
              </div>
              <div className={shared.kpiCard}>
                <span className={shared.kpiLabel}>PREMIOS PROPIOS</span>
                <span className={shared.kpiValue}>{awardDefinitions}</span>
                <span className={shared.kpiSub}>Se asignan en cada evento</span>
              </div>
            </>
          )}
        </div>

        <div className={shared.panelCard}>
          <div className={tableStyles.scrollWrap}>
            <div style={{ minWidth: 900 }}>
              <div className={tableStyles.head} style={{ gridTemplateColumns: cols }}>
                <span>Tipo de staff</span>
                <span>Evalúa</span>
                {inEvent ? <span>Personas</span> : <span>Acceso</span>}
                {!inEvent && <span>Rúbrica</span>}
                <span>Premios propios</span>
                {inEvent ? <span>Avance</span> : <span>Nota staff</span>}
                <span style={{ textAlign: 'right' }}>{inEvent ? 'Estado' : ''}</span>
              </div>
              {isLoading && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>Cargando…</span>
                </div>
              )}
              {!isLoading && visible.length === 0 && (
                <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
                  <span className={tableStyles.mutedCell}>
                    {types.length === 0 ? 'Todavía no hay tipos de staff.' : 'Ningún tipo coincide con la búsqueda.'}
                  </span>
                </div>
              )}
              {visible.map((t) =>
                inEvent ? (
                  <EventTypeRow key={t.id} type={t} onOpen={() => open(t.id)} />
                ) : (
                  <OrgTypeRow
                    key={t.id}
                    type={t}
                    staffWeight={data?.staff_weight ?? null}
                    chairWeight={data?.chair_weight ?? null}
                    onOpen={() => open(t.id)}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        <div className={styles.dashedNote}>
          <strong style={{ color: 'var(--ink)' }}>Cómo funciona.</strong>{' '}
          {inEvent ? (
            <>
              Las personas se invitan desde <strong style={{ color: 'var(--ink)' }}>Jueces</strong>, eligiendo su rol. Aquí ves su avance
              y asignas los premios de este evento. Los tipos, rúbricas y premios se configuran en Staff de la organización.
            </>
          ) : (
            <>
              Cada tipo de staff evalúa a su grupo de candidatos con su rúbrica y entrega sus premios propios. Sirve para cualquier
              evento: las personas se invitan dentro de cada evento (Jueces), y ahí se ven su avance y sus premios.
            </>
          )}
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

function TypeName({ type: t }: { type: StaffTypeSummary }) {
  const unconfigured = t.access === 'link' && !t.evaluates && t.criteria_count === 0;
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 0 }}>
      <StaffTypeTag code={t.code} color={unconfigured ? 'var(--state-none-dot)' : t.color} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className={styles.serifName}>{t.name}</span>
        {t.description && <span className={styles.small}>{t.description}</span>}
      </div>
    </div>
  );
}

function Awards({ type: t }: { type: StaffTypeSummary }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {t.awards.length === 0 && <span className={styles.faint}>—</span>}
      {t.awards.map((a) => (
        <AwardChip key={a.id}>
          {a.name}
          {a.scope === 'per_committee' ? ' · por comité' : a.winners > 1 ? ` ×${a.winners}` : ''}
        </AwardChip>
      ))}
    </div>
  );
}

function evaluatesText(t: StaffTypeSummary): string {
  if (t.access === 'account') return 'Panel del juez';
  return t.evaluates ? EVALUATES[t.evaluates].candidates : '—';
}

function OrgTypeRow({
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
  const account = t.access === 'account';
  return (
    <div className={tableStyles.row} style={{ gridTemplateColumns: ORG_COLS, cursor: 'pointer' }} onClick={onOpen}>
      <TypeName type={t} />
      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{evaluatesText(t)}</span>
      <span>
        <StatusBadge tone={account ? 'progress' : 'done'} label={account ? 'CONTRASEÑA' : 'QR POR CORREO'} />
      </span>
      {account ? (
        <span className={styles.small}>Rúbrica del comité</span>
      ) : t.criteria_count > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{t.criteria_count} criterios</span>
          <RubricBadge valid={t.rubric_valid} sum={t.weight_sum} />
        </div>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>Sin rúbrica</span>
      )}
      <Awards type={t} />
      <span className={`${styles.small} ${t.counts_as !== 'none' ? styles.green : ''}`} style={{ fontWeight: t.counts_as !== 'none' ? 600 : 400 }}>
        {account ? 'Nota mesa (panel del juez)' : countsLabel(t.counts_as, staffWeight, chairWeight)}
      </span>
      <button
        className={styles.linkBtn}
        style={{ justifySelf: 'end' }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        Configurar ›
      </button>
    </div>
  );
}

function EventTypeRow({ type: t, onOpen }: { type: StaffTypeSummary; onOpen: () => void }) {
  const account = t.access === 'account';
  return (
    <div className={tableStyles.row} style={{ gridTemplateColumns: EVENT_COLS, cursor: 'pointer' }} onClick={onOpen}>
      <TypeName type={t} />
      <span style={{ fontSize: 13, color: 'var(--ink)' }}>{evaluatesText(t)}</span>
      {t.members_count > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.avatarStack}>
            {t.members_preview.map((name, i) => (
              <Avatar key={name + i} initials={initialsFor(name)} size={26} color={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
            ))}
          </span>
          <span className={styles.small}>
            {t.members_count} persona{t.members_count === 1 ? '' : 's'}
          </span>
        </div>
      ) : (
        <span className={`${styles.small} ${styles.faint}`}>Nadie invitado</span>
      )}
      <Awards type={t} />
      {!account && t.progress != null ? (
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
        <span className={styles.faint}>{account ? 'En el panel del juez' : '—'}</span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {!account && <TypeStatusBadge type={t} />}
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

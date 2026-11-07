import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Select } from '@munych/ui/components/FormControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  useClosePeerVote,
  useEvent,
  useGenerateVoterTokens,
  useOpenPeerVote,
  usePeerVoteWindows,
  useRevokeVoterTokens,
  useVoterTokens,
} from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import { delegatesVote, eventTypeLabel } from '../../lib/statusLabels';
import { downloadVoterCsv, downloadVoterQrSheet } from '../../lib/voterSheets';
import type { BadgeTone } from '../../lib/statusLabels';
import type { GeneratedVoterToken, PeerVoteStatus, VoterAccess, VoterTokenStatus } from '../../data-access/apiTypes';
import styles from './AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';

const COLS = '1.8fr 1.1fr 1fr 1fr 0.7fr 150px';
const WINDOW_COLS = '1.8fr 1fr 0.9fr 1.4fr 150px';

const WINDOW_STATUS: Record<PeerVoteStatus, { label: string; tone: BadgeTone }> = {
  not_scheduled: { label: 'SIN ABRIR', tone: 'none' },
  scheduled: { label: 'PROGRAMADA', tone: 'progress' },
  open: { label: 'ABIERTA', tone: 'done' },
  closed: { label: 'CERRADA', tone: 'none' },
};

const STATUS: Record<VoterTokenStatus, { label: string; tone: BadgeTone }> = {
  none: { label: 'SIN ACCESO', tone: 'none' },
  active: { label: 'ACTIVO', tone: 'done' },
  revoked: { label: 'REVOCADO', tone: 'progress' },
  expired: { label: 'VENCIDO', tone: 'progress' },
};

/** Prefijo del enlace de votación: esta misma app, en la ruta pública #/votar/<token>. */
function linkBase(): string {
  return `${window.location.origin}${window.location.pathname}#/votar/`;
}

function delegationLabel(a: { character_name: string | null; country_code: string | null }): string {
  return a.character_name ?? a.country_code ?? '—';
}

function formatMoment(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Decisión de diseño (hito 12): pantalla nueva «Votación» para repartir los accesos de los
 * delegados. Solo usa componentes y estilos existentes (AdminShared, Table, StatusBadge,
 * Button, Select, ConfirmDialog). Desde el 2026-11-06 también abre y cierra el voto entre
 * pares de cada comité (misma tabla y badges, sin estilos nuevos).
 */
export function VotingAccessPage() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const { data: event } = useEvent(eventId);
  const { data: accesses } = useVoterTokens(eventId);
  const generate = useGenerateVoterTokens(eventId);
  const revoke = useRevokeVoterTokens(eventId);
  const { data: windows } = usePeerVoteWindows(eventId);
  const openWindow = useOpenPeerVote(eventId);
  const closeWindow = useClosePeerVote(eventId);

  const [committeeFilter, setCommitteeFilter] = useState('');
  const [generated, setGenerated] = useState<GeneratedVoterToken[] | null>(null);
  const [error, setError] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState<VoterAccess | null>(null);

  const list = accesses ?? [];
  const committees = [...new Map(list.map((a) => [a.committee_id, a.committee_name])).entries()];
  const visible = committeeFilter ? list.filter((a) => a.committee_id === committeeFilter) : list;
  const withoutAccess = list.filter((a) => a.status !== 'active').length;
  const activeCount = list.filter((a) => a.status === 'active').length;
  const votedCount = list.filter((a) => a.votes_count > 0).length;
  const enabled = delegatesVote(event?.event_type) && event?.status !== 'closed';

  async function handleGenerate(delegateIds?: string[]) {
    setError('');
    try {
      const tokens = await generate.mutateAsync({ link_base: linkBase(), delegate_ids: delegateIds ?? null });
      setGenerated(tokens);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleWindow(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleRevoke(access: VoterAccess) {
    setPendingRevoke(null);
    setError('');
    try {
      await revoke.mutateAsync([access.delegate_id]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (event && !delegatesVote(event.event_type)) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            En un evento de tipo «{eventTypeLabel(event.event_type)}» los delegados no votan, así que no hay accesos que repartir.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar} style={{ background: 'var(--navy)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className={styles.topbarTitle} style={{ color: '#FFFFFF' }}>
            Votación de delegados
          </span>
          <span className={styles.topbarSub} style={{ color: '#FFFFFF' }}>
            {list.length} delegados · {activeCount} con acceso · {votedCount} ya votaron
          </span>
        </div>
        <Button variant="gold" onClick={() => handleGenerate()} disabled={!enabled || withoutAccess === 0 || generate.isPending}>
          {generate.isPending ? 'Generando…' : `Generar accesos faltantes (${withoutAccess})`}
        </Button>
      </div>

      <div className={styles.content}>
        {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}

        {generated && (
          <div className={styles.panelCard}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>{generated.length} accesos generados</span>
              <button className={tableStyles.linkAction} onClick={() => setGenerated(null)}>
                Cerrar
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--callout-bg)', border: '1px solid var(--callout-border)', borderRadius: 9, padding: '12px 14px', fontSize: 12, color: 'var(--callout-fg)', lineHeight: 1.5 }}>
                Descarga los accesos ahora: por seguridad, los enlaces solo se muestran una vez. Si se pierden, regenera el acceso de ese
                delegado (el anterior deja de funcionar). Cada enlace es personal: quien lo tenga puede votar como ese delegado.
              </div>
              {generated.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button onClick={() => downloadVoterQrSheet(event?.name ?? '', event?.slug ?? 'evento', generated)}>
                    Descargar hoja con QR (imprimir)
                  </Button>
                  <Button variant="secondary" onClick={() => downloadVoterCsv(event?.slug ?? 'evento', generated)}>
                    Descargar CSV con enlaces
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Voto entre pares por comité</span>
          </div>
          <div style={{ padding: '12px 20px 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Los delegados eligen Mejor delegado, Delegado distinguido y Mención honorífica (3, 2 y 1 puntos), una sola vez y sin
            votar por su propia delegación. La votación se abre sola al abrir una sesión del comité; también puedes abrirla o
            cerrarla aquí.
          </div>
          <div className={tableStyles.head} style={{ gridTemplateColumns: WINDOW_COLS }}>
            <span>Comité</span>
            <span>Estado</span>
            <span>Ya votaron</span>
            <span>Abrió / cierra</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
          </div>
          {(windows ?? []).length === 0 && (
            <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
              <span className={tableStyles.mutedCell}>No hay comités en este evento.</span>
            </div>
          )}
          {(windows ?? []).map((w) => (
            <div key={w.committee_id} className={tableStyles.row} style={{ gridTemplateColumns: WINDOW_COLS }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{w.committee_name}</span>
                <span className={tableStyles.mutedCell} style={{ fontSize: 11 }}>
                  {w.committee_acronym}
                </span>
              </div>
              <span style={{ justifySelf: 'start' }}>
                <StatusBadge tone={WINDOW_STATUS[w.status].tone} label={WINDOW_STATUS[w.status].label} />
              </span>
              <span className={tableStyles.nameCell}>
                {w.submitted} de {w.voters}
              </span>
              <span className={tableStyles.mutedCell}>
                {formatMoment(w.opens_at)}
                {w.closes_at ? ` – ${formatMoment(w.closes_at)}` : ''}
              </span>
              <span className={tableStyles.right} style={{ display: 'flex', gap: 12 }}>
                {enabled && w.status !== 'open' && (
                  <button
                    className={tableStyles.linkAction}
                    onClick={() => handleWindow(() => openWindow.mutateAsync({ committeeId: w.committee_id }))}
                    disabled={openWindow.isPending}
                  >
                    {w.status === 'closed' ? 'Reabrir' : 'Abrir ahora'}
                  </button>
                )}
                {enabled && w.status === 'open' && (
                  <button
                    className={tableStyles.linkAction}
                    style={{ color: '#C0392B' }}
                    onClick={() => handleWindow(() => closeWindow.mutateAsync(w.committee_id))}
                    disabled={closeWindow.isPending}
                  >
                    Cerrar
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.panelCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Accesos por delegado</span>
            <div style={{ minWidth: 220 }}>
              <Select value={committeeFilter} onChange={(e) => setCommitteeFilter(e.target.value)}>
                <option value="">Todos los comités</option>
                {committees.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
            <span>Delegado</span>
            <span>Delegación</span>
            <span>Estado</span>
            <span>Último uso</span>
            <span>Votó</span>
            <span style={{ textAlign: 'right' }}>Acción</span>
          </div>
          {visible.length === 0 && (
            <div className={tableStyles.row} style={{ gridTemplateColumns: '1fr' }}>
              <span className={tableStyles.mutedCell}>No hay delegados registrados en este evento.</span>
            </div>
          )}
          {visible.map((a) => (
            <div key={a.delegate_id} className={tableStyles.row} style={{ gridTemplateColumns: COLS }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{a.full_name}</span>
                <span className={tableStyles.mutedCell} style={{ fontSize: 11 }}>
                  {a.committee_acronym}
                </span>
              </div>
              <span className={tableStyles.nameCell}>{delegationLabel(a)}</span>
              <span style={{ justifySelf: 'start' }}>
                <StatusBadge tone={STATUS[a.status].tone} label={STATUS[a.status].label} />
              </span>
              <span className={tableStyles.mutedCell}>{formatMoment(a.last_used_at)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: a.votes_count > 0 ? 'var(--ink)' : 'var(--state-none-dot)' }}>
                {a.votes_count > 0 ? 'Sí' : 'No'}
              </span>
              <span className={tableStyles.right} style={{ display: 'flex', gap: 12 }}>
                {enabled && (
                  <button className={tableStyles.linkAction} onClick={() => handleGenerate([a.delegate_id])} disabled={generate.isPending}>
                    {a.status === 'none' ? 'Generar' : 'Regenerar'}
                  </button>
                )}
                {a.status === 'active' && (
                  <button className={tableStyles.linkAction} style={{ color: '#C0392B' }} onClick={() => setPendingRevoke(a)}>
                    Revocar
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pendingRevoke && (
        <ConfirmDialog
          title="Revocar acceso"
          message={`El enlace de ${pendingRevoke.full_name} (${delegationLabel(pendingRevoke)}) dejará de funcionar de inmediato. Su voto ya enviado se conserva.`}
          onClose={() => setPendingRevoke(null)}
          actions={[
            { label: 'Cancelar', onClick: () => setPendingRevoke(null) },
            { label: 'Revocar', variant: 'danger', onClick: () => handleRevoke(pendingRevoke) },
          ]}
        />
      )}
    </div>
  );
}

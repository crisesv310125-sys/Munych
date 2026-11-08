import { useState } from 'react';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useEventStaff, useResendStaffAccess } from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import { ACCESS } from './staffLabels';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '2fr 1.6fr 1.4fr 1fr 110px';

/**
 * Decisión de diseño (hito 15): en la pantalla de jueces del evento, el staff que entra con QR
 * (sin cuenta). Mismas clases de tabla que la lista de jueces; «Reenviar QR» genera uno nuevo.
 */
export function EventStaffList({ eventId }: { eventId: string }) {
  const { data } = useEventStaff(eventId);
  const resend = useResendStaffAccess();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const people = (data ?? []).filter((m) => m.access_mode === 'link');
  if (people.length === 0) return null;

  async function handleResend(memberId: string) {
    setNotice('');
    setError('');
    try {
      const out = await resend.mutateAsync(memberId);
      setNotice(`QR nuevo enviado a ${out.email}. El anterior ya no funciona.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className={styles.root} style={{ marginTop: 18 }}>
      <div style={{ padding: '10px 16px', fontSize: 11, letterSpacing: '.08em', fontWeight: 600, color: 'var(--muted)' }}>
        STAFF CON QR · {people.length}
      </div>
      {notice && <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--state-done-fg)' }}>{notice}</div>}
      {error && <div style={{ padding: '0 16px 8px', fontSize: 12, color: '#C0392B' }}>{error}</div>}
      <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
        <span>Persona</span>
        <span>Staff</span>
        <span>Correo</span>
        <span>Acceso</span>
        <span />
      </div>
      {people.map((m) => (
        <div key={m.member_id} className={tableStyles.row} style={{ gridTemplateColumns: COLS }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{m.full_name}</span>
            {m.title && <span className={styles.small}>{m.title}</span>}
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={styles.tag} style={{ background: m.color, width: 26, height: 26, fontSize: 10 }}>
              {m.code}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>{m.staff_type}</span>
          </span>
          <span className={tableStyles.mutedCell}>{m.email ?? '—'}</span>
          <span>
            <StatusBadge tone={ACCESS[m.access].tone} label={ACCESS[m.access].label} />
          </span>
          {m.email ? (
            <button className={tableStyles.linkAction} onClick={() => handleResend(m.member_id)} disabled={resend.isPending}>
              {m.access === 'not_invited' ? 'Enviar QR' : 'Reenviar QR'}
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}

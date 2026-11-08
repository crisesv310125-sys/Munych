import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { ProgressBar } from '@munych/ui/components/ProgressBar';
import { Toggle } from '@munych/ui/components/SelectionControls';
import { StatusBadge } from '@munych/ui/components/StatusBadge';
import { useResendStaffAccess, useUpdateStaffMember } from '../../../data-access/staffHooks';
import { errorMessage } from '../../../data-access/errors';
import { initialsFor } from '../../../lib/initials';
import { downloadBlob } from '../../../lib/voterSheets';
import type { StaffMember, StaffTypeDetail } from '../../../data-access/staffTypes';
import type { TopActions } from './StaffTypePage';
import { RoleChip } from './staffUi';
import { ACCESS, committeesLabel } from './staffLabels';
import shared from '../AdminShared.module.css';
import tableStyles from '@munych/ui/components/Table.module.css';
import styles from './Staff.module.css';

const COLS = '2.6fr 1.2fr 1.1fr 1fr 110px';

/**
 * Personas de este tipo de staff en el evento. Solo lectura: se invitan (con su rol) desde la
 * pantalla de jueces del evento. Aquí se ve su avance y se puede reenviar su QR.
 */
export function MembersTab({ type, eventId, setActions }: { type: StaffTypeDetail; eventId: string; setActions: TopActions }) {
  const navigate = useNavigate();
  const resend = useResendStaffAccess();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const active = type.members.filter((m) => !m.removed_at);
  const former = type.members.filter((m) => m.removed_at);
  const account = type.access === 'account';
  const invitePath = `/admin/eventos/${eventId}/jueces`;

  useEffect(() => {
    setActions(
      <>
        <Button variant="secondary" onClick={() => exportMembers(type)} disabled={type.members.length === 0}>
          Exportar lista
        </Button>
        <Button onClick={() => navigate(invitePath)}>+ Invitar persona</Button>
      </>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, setActions, invitePath]);

  async function handleResend(member: StaffMember) {
    setError('');
    setNotice('');
    try {
      const out = await resend.mutateAsync(member.id);
      setNotice(`QR nuevo enviado a ${out.email}. El anterior ya no funciona.`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className={shared.content}>
      <div className={styles.calloutInfo}>
        Las personas se invitan desde <strong>Jueces</strong> del evento, eligiendo su rol.{' '}
        {account
          ? `${type.name} recibe un correo para crear su contraseña y califica en el panel del juez con rol de mesa.`
          : `${type.name} recibe por correo su QR de acceso personal.`}
      </div>
      {notice && <span className={`${styles.small} ${styles.green}`}>{notice}</span>}
      {error && <span style={{ color: '#C0392B', fontSize: 13 }}>{error}</span>}

      {active.length === 0 ? (
        <div className={styles.dashedNote} style={{ textAlign: 'center', padding: '28px 20px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Nadie de {type.name} en este evento todavía</strong>
          <Button onClick={() => navigate(invitePath)} style={{ marginTop: 8 }}>
            + Invitar desde Jueces
          </Button>
        </div>
      ) : (
        <div className={shared.panelCard}>
          <div className={tableStyles.scrollWrap}>
            <div style={{ minWidth: 640 }}>
              <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
                <span>Persona · rol</span>
                <span>Asignado a</span>
                <span>{account ? 'Califica en' : 'Evaluados'}</span>
                <span>Acceso</span>
                <span />
              </div>
              {active.map((m) => {
                const percent = m.assigned ? (m.evaluated / m.assigned) * 100 : 0;
                return (
                  <div key={m.id} className={tableStyles.row} style={{ gridTemplateColumns: COLS }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                      <Avatar initials={initialsFor(m.full_name)} size={32} color={m.role === 'coordinator' ? 'var(--navy)' : 'var(--muted)'} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{m.full_name}</span>
                          <RoleChip role={m.role} title={m.title} />
                        </span>
                        <span className={styles.small}>{m.email ?? m.title ?? 'Sin correo'}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--ink)' }}>{committeesLabel(m.committee_ids, type.committees)}</span>
                    {account ? (
                      <span className={styles.small}>Panel del juez</span>
                    ) : m.assigned > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70 }}>
                          <ProgressBar percent={percent} color={percent >= 100 ? 'var(--state-done-dot)' : 'var(--gold)'} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                          {m.evaluated}/{m.assigned}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.faint}>—</span>
                    )}
                    <span>
                      {account ? (
                        <span className={styles.small}>Con contraseña</span>
                      ) : (
                        <StatusBadge tone={ACCESS[m.access].tone} label={ACCESS[m.access].label} />
                      )}
                    </span>
                    {!account && m.email ? (
                      <button className={tableStyles.linkAction} onClick={() => handleResend(m)} disabled={resend.isPending}>
                        Reenviar QR
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {former.length > 0 && <FormerMembers members={former} eventId={eventId} />}
    </div>
  );
}

function FormerMembers({ members, eventId }: { members: StaffMember[]; eventId: string }) {
  const update = useUpdateStaffMember(eventId);
  const [error, setError] = useState('');
  async function run(memberId: string, body: { evaluations_count?: boolean; restore?: boolean }) {
    setError('');
    try {
      await update.mutateAsync({ memberId, body });
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className={shared.panelCard}>
      <div className={shared.panelHeader}>
        <span className={shared.panelTitle}>Exmiembros</span>
        <span className={styles.small}>Sus evaluaciones no se borran: decide si cuentan.</span>
      </div>
      {error && <span style={{ color: '#C0392B', fontSize: 12, padding: '8px 20px' }}>{error}</span>}
      {members.map((m) => (
        <div key={m.id} className={tableStyles.row} style={{ gridTemplateColumns: '2fr 1.4fr auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--muted)' }}>{m.full_name}</span>
            <span className={styles.small}>{m.evaluated} evaluaciones completas</span>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--ink)' }}>
            <Toggle checked={m.evaluations_count} onClick={() => run(m.id, { evaluations_count: !m.evaluations_count })} />
            {m.evaluations_count ? 'Sus evaluaciones cuentan' : 'No cuentan'}
          </label>
          <button className={tableStyles.linkAction} onClick={() => run(m.id, { restore: true })}>
            Reactivar
          </button>
        </div>
      ))}
    </div>
  );
}

function exportMembers(type: StaffTypeDetail) {
  const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [
    ['Nombre', 'Correo', 'Puesto', 'Rol', 'Comités', 'Evaluados', 'Asignados', 'Acceso', 'Estado'],
    ...type.members.map((m) => [
      m.full_name,
      m.email ?? '',
      m.title ?? '',
      m.role === 'coordinator' ? 'Coordinación' : 'Evaluación',
      committeesLabel(m.committee_ids, type.committees),
      String(m.evaluated),
      String(m.assigned),
      type.access === 'account' ? 'Con contraseña' : ACCESS[m.access].label,
      m.removed_at ? 'Exmiembro' : 'Activo',
    ]),
  ];
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `staff-${type.code.toLowerCase()}-personas.csv`);
}

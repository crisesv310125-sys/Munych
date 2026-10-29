import { useState } from 'react';
import tableStyles from '@munych/ui/components/Table.module.css';
import { useJudgeInvitations, useResendJudgeInvitation } from '../../data-access/hooks';
import { errorMessage } from '../../data-access/errors';
import type { ApiJudgeInvitation } from '../../data-access/apiTypes';

const COLS = '2fr 1.8fr 1.6fr 1fr';

/** Vigencia del enlace de invitación en Supabase Auth (por defecto 24 h; ajustable en el proyecto). */
const INVITE_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

function sentLabel(invitation: ApiJudgeInvitation): { text: string; expired: boolean } {
  if (!invitation.invited_at) return { text: '—', expired: false };
  const sentAt = new Date(invitation.invited_at);
  return { text: dateFormat.format(sentAt), expired: Date.now() - sentAt.getTime() > INVITE_LINK_TTL_MS };
}

/**
 * Jueces invitados que aún no abren el enlace (no salen en la lista principal). Permite reenviar el
 * correo cuando no llegó o el enlace venció.
 */
export function PendingInvitations({ eventId }: { eventId?: string }) {
  const { data: invitations } = useJudgeInvitations(eventId);
  const resend = useResendJudgeInvitation();
  const [feedback, setFeedback] = useState<Record<string, { text: string; error: boolean }>>({});

  if (!invitations || invitations.length === 0) return null;

  async function handleResend(invitation: ApiJudgeInvitation) {
    setFeedback((prev) => ({ ...prev, [invitation.judge_id]: { text: 'Enviando…', error: false } }));
    try {
      await resend.mutateAsync(invitation.judge_id);
      setFeedback((prev) => ({ ...prev, [invitation.judge_id]: { text: 'Invitación reenviada', error: false } }));
    } catch (err) {
      setFeedback((prev) => ({ ...prev, [invitation.judge_id]: { text: errorMessage(err), error: true } }));
    }
  }

  return (
    <section aria-labelledby="pending-invitations-title" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 16px 8px' }}>
        <span id="pending-invitations-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--navy)' }}>
          Invitaciones pendientes
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {invitations.length} · aparecerán en la lista cuando acepten
        </span>
      </div>
      <div className={tableStyles.head} style={{ gridTemplateColumns: COLS }}>
        <span>Juez</span>
        <span>Correo</span>
        <span>Enviada</span>
        <span />
      </div>
      {invitations.map((invitation) => {
        const sent = sentLabel(invitation);
        const status = feedback[invitation.judge_id];
        const sending = resend.isPending && resend.variables === invitation.judge_id;
        return (
          <div key={invitation.judge_id} className={tableStyles.row} style={{ gridTemplateColumns: COLS }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{invitation.full_name}</span>
            <span className={tableStyles.mutedCell}>{invitation.email ?? '—'}</span>
            <span className={tableStyles.mutedCell}>
              {sent.text}
              {sent.expired && <span style={{ color: '#C0392B', marginLeft: 6 }}>· enlace vencido</span>}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <button className={tableStyles.linkAction} onClick={() => handleResend(invitation)} disabled={sending}>
                {sending ? 'Enviando…' : 'Reenviar'}
              </button>
              {status && !sending && (
                <span role="status" style={{ fontSize: 11, color: status.error ? '#C0392B' : 'var(--muted)' }}>
                  {status.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

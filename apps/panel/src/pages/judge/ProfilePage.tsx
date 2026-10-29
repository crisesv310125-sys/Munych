import { useNavigate } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { Button } from '@munych/ui/components/Button';
import { Card } from '@munych/ui/components/Card';
import { useAppState } from '../../state/AppStateContext';
import { useIsDesktop } from '../../lib/useMediaQuery';
import { initialsFor } from '../../lib/initials';
import { useJudgeCommittees } from '../../data-access/hooks';

const ROLE_LABEL: Record<string, string> = { chair: 'Presidencia', moderator: 'Moderación', judge: 'Juez' };

export function ProfilePage() {
  const { session, logout } = useAppState();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { data: myCommittees } = useJudgeCommittees();

  if (!session || session.role !== 'judge') return null;

  return (
    <div
      style={{
        padding: isDesktop ? 28 : 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxWidth: 520,
        margin: isDesktop ? '0 auto' : undefined,
        width: '100%',
      }}
    >
      <Card style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar initials={initialsFor(session.name)} size={52} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, color: 'var(--navy)' }}>{session.name}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{session.email}</span>
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.06em' }}>MIS COMITÉS</span>
        {(myCommittees ?? []).map((c) => (
          <Card key={c.committee_id} style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {c.event.name} · {ROLE_LABEL[c.role] ?? c.role}
            </span>
          </Card>
        ))}
        {(myCommittees ?? []).length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin comités asignados todavía.</span>}
      </div>
      <Button
        variant="secondary"
        onClick={() => {
          logout();
          navigate('/login');
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

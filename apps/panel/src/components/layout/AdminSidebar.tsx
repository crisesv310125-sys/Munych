import { ArrowLeft, CalendarDays, CalendarClock, Download, Flag, LayoutDashboard, Landmark, LogOut, QrCode, SlidersHorizontal, Trophy, Users } from 'lucide-react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { useEvent } from '../../data-access/hooks';
import { delegatesVote } from '../../lib/statusLabels';
import type { EventType } from '../../data-access/apiTypes';
import styles from './AdminSidebar.module.css';

function eventNav(eventId: string, eventType: EventType) {
  const base = `/admin/eventos/${eventId}`;
  const voting = delegatesVote(eventType);
  return [
    { path: base, label: 'Dashboard', Icon: LayoutDashboard },
    { path: `${base}/comites`, label: 'Comités', Icon: Landmark },
    { path: `${base}/sesiones`, label: 'Sesiones', Icon: CalendarClock },
    { path: `${base}/paises`, label: 'Países', Icon: Flag },
    // En eventos con votación, aquí también se asignan la mesa y el staff.
    { path: `${base}/jueces`, label: voting ? 'Evaluadores' : 'Jueces', Icon: Users },
    // Decisión de diseño (hito 12): accesos de los delegados, solo si votan.
    ...(voting ? [{ path: `${base}/votacion`, label: 'Votación', Icon: QrCode }] : []),
    { path: `${base}/criterios`, label: 'Criterios', Icon: SlidersHorizontal },
    { path: `${base}/resultados`, label: 'Resultados', Icon: Trophy },
    { path: `${base}/exportar`, label: 'Exportar', Icon: Download },
  ];
}

export function AdminSidebar({ open, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAppState();
  const match = useMatch('/admin/eventos/:eventId/*');
  const eventId = match?.params.eventId;
  const { data: event } = useEvent(eventId);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function go(path: string) {
    navigate(path);
    onNavigate?.();
  }

  return (
    <div className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
      <div className={styles.brand} onClick={() => go('/admin/eventos')} style={{ cursor: 'pointer' }}>
        <img className={styles.brandCircle} src="/brand/munych-logo.png" alt="MUNYCH Association" />
        <div className={styles.brandText}>
          <span className={styles.brandName}>MUNYCH</span>
          <span className={styles.brandTag}>ADMIN</span>
        </div>
      </div>

      {event ? (
        <>
          <button className={styles.link} onClick={() => go('/admin/eventos')} style={{ marginTop: -12 }}>
            <ArrowLeft className={styles.linkIcon} strokeWidth={2} />
            Todos los eventos
          </button>
          <nav className={styles.nav}>
            {eventNav(event.id, event.event_type).map(({ path, label, Icon }) => {
              const active = path === `/admin/eventos/${event.id}` ? location.pathname === path : location.pathname.startsWith(path);
              return (
                <button
                  key={path}
                  className={`${styles.link} ${active ? styles.linkActive : ''}`}
                  onClick={() => go(path)}
                >
                  <Icon className={styles.linkIcon} strokeWidth={2} />
                  {label}
                </button>
              );
            })}
          </nav>
        </>
      ) : (
        <nav className={styles.nav}>
          <button className={`${styles.link} ${styles.linkActive}`} onClick={() => go('/admin/eventos')}>
            <CalendarDays className={styles.linkIcon} strokeWidth={2} />
            Eventos
          </button>
        </nav>
      )}
      <button className={styles.link} onClick={handleLogout} style={{ marginTop: 'auto' }}>
        <LogOut className={styles.linkIcon} strokeWidth={2} />
        Cerrar sesión
      </button>
    </div>
  );
}

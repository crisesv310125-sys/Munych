import { useNavigate, useLocation } from 'react-router-dom';
import { Avatar } from '@munych/ui/components/Avatar';
import { useAppState } from '../../state/AppStateContext';
import { initialsFor } from '../../lib/initials';
import styles from './JudgeTopNav.module.css';

export function JudgeTopNav() {
  const { session, logout } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) return null;

  const isComites = location.pathname.startsWith('/juez/comites') || location.pathname === '/juez';
  const isProgreso = location.pathname === '/juez/progreso';

  return (
    <div className={styles.nav}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <img className={styles.brandCircle} src="/brand/munych-logo.png" alt="MUNYCH Association" />
          <span className={styles.brandName}>MUNYCH</span>
        </div>
        <nav className={styles.links}>
          <button className={`${styles.link} ${isComites ? styles.linkActive : ''}`} onClick={() => navigate('/juez')}>
            Mis comités
          </button>
          <button className={`${styles.link} ${isProgreso ? styles.linkActive : ''}`} onClick={() => navigate('/juez/progreso')}>
            Mi progreso
          </button>
        </nav>
      </div>
      <div className={styles.right}>
        <span className={styles.name}>{session.name}</span>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          title="Cerrar sesión"
        >
          <Avatar initials={initialsFor(session.name)} size={32} onNavy />
        </button>
      </div>
    </div>
  );
}

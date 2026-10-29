import { Flag, LineChart, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './JudgeTabBar.module.css';

const ITEMS = [
  { path: '/juez', label: 'Comités', Icon: Flag },
  { path: '/juez/progreso', label: 'Progreso', Icon: LineChart },
  { path: '/juez/perfil', label: 'Perfil', Icon: User },
];

export function JudgeTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className={styles.bar}>
      {ITEMS.map(({ path, label, Icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            className={`${styles.item} ${active ? styles.itemActive : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon className={styles.icon} strokeWidth={2} />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

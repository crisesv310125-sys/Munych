import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { useIsAdminWide } from '../../lib/useMediaQuery';
import { AdminSidebar } from './AdminSidebar';
import styles from './AdminLayout.module.css';

export function AdminLayout() {
  const { session, sessionLoading } = useAppState();
  const isWide = useIsAdminWide();
  const [open, setOpen] = useState(false);

  if (sessionLoading) return null;
  if (!session || session.role !== 'admin') return <Navigate to="/login" replace />;

  return (
    <div className={styles.shell}>
      {(isWide || open) && <AdminSidebar open={open} onNavigate={() => setOpen(false)} />}
      {!isWide && open && <div className={styles.overlayOpen} onClick={() => setOpen(false)} />}
      <div className={styles.main}>
        {!isWide && (
          <div className={styles.mobileBar}>
            <button className={styles.menuBtn} onClick={() => setOpen(true)} aria-label="Abrir menú">
              <Menu size={18} />
            </button>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}>MUNYCH · Admin</span>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppState } from '../../state/AppStateContext';
import { useIsDesktop } from '../../lib/useMediaQuery';
import { JudgeTopNav } from './JudgeTopNav';
import { JudgeTabBar } from './JudgeTabBar';
import styles from './JudgeLayout.module.css';

const ROOT_TABS = ['/juez', '/juez/progreso', '/juez/perfil'];

export function JudgeLayout() {
  const { session, sessionLoading } = useAppState();
  const isDesktop = useIsDesktop();
  const location = useLocation();

  if (sessionLoading) return null;
  if (!session || session.role !== 'judge') return <Navigate to="/login" replace />;

  const showTabBar = !isDesktop && ROOT_TABS.includes(location.pathname);

  return (
    <div className={styles.shell}>
      {isDesktop && <JudgeTopNav />}
      <div className={styles.content}>
        <Outlet />
      </div>
      {showTabBar && <JudgeTabBar />}
    </div>
  );
}

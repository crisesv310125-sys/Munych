import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { authService } from '../data-access/authService';
import { useAppState } from '../state/AppStateContext';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './LoginPage.module.css';

const ROLE_ROUTES = { admin: '/admin', judge: '/juez' } as const;
const MIN_LENGTH = 8;

type LinkStatus = 'checking' | 'valid' | 'invalid';

/**
 * Destino de los enlaces de invitación y de recuperación: el usuario ya tiene sesión (la abrió el
 * enlace) y aquí define su contraseña para poder volver a entrar cuando el enlace haya vencido.
 */
export function SetPasswordPage() {
  const { session } = useAppState();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const isRecovery = authService.linkType === 'recovery';

  const [linkStatus, setLinkStatus] = useState<LinkStatus>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  // La sesión del enlace se guarda de forma asíncrona: hasta entonces no se puede decidir si es válido.
  useEffect(() => {
    let cancelled = false;
    authService.linkReady
      .then(() => authService.getAccessToken())
      .then((token) => {
        if (!cancelled) setLinkStatus(token ? 'valid' : 'invalid');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tras guardar, entra al panel en cuanto se conoce el rol (GET /me).
  useEffect(() => {
    if (saved && session) navigate(ROLE_ROUTES[session.role], { replace: true });
  }, [saved, session, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      await authService.updatePassword(password);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  }

  const heading = isRecovery ? 'Restablece tu contraseña' : 'Crea tu contraseña';
  const intro = isRecovery
    ? 'Elige una contraseña nueva para tu cuenta.'
    : 'Es tu primera vez aquí: elige la contraseña con la que entrarás al panel a partir de ahora.';

  const inputStyle: CSSProperties = isDesktop
    ? { border: '1px solid var(--border-input)', borderRadius: 8, padding: '12px 13px', fontSize: 14, letterSpacing: '.2em', outline: 'none' }
    : {
        background: 'rgba(255,255,255,.07)',
        border: '1px solid rgba(255,255,255,.22)',
        borderRadius: 9,
        padding: 14,
        color: '#FFFFFF',
        fontSize: 15,
        letterSpacing: '.2em',
        outline: 'none',
      };
  const labelStyle: CSSProperties = isDesktop
    ? { fontSize: 12, fontWeight: 600, color: 'var(--muted)' }
    : { fontSize: 12, color: 'rgba(255,255,255,.72)', fontWeight: 500 };
  const textColor = isDesktop ? 'var(--ink)' : '#FFFFFF';
  const errorColor = isDesktop ? '#C0392B' : '#FFB4B4';
  const linkStyle: CSSProperties = { color: isDesktop ? 'var(--navy)' : '#FFFFFF', fontSize: 13, fontWeight: 600 };

  let body;
  if (linkStatus === 'checking') {
    body = <span style={{ color: textColor, fontSize: 14 }}>Verificando enlace…</span>;
  } else if (linkStatus === 'invalid') {
    body = (
      <>
        <span style={{ color: errorColor, fontSize: 14 }}>
          El enlace venció o ya se usó. Pide uno nuevo con «¿Olvidaste tu contraseña?» o pide al administrador que te reenvíe la invitación.
        </span>
        <Link to="/login" style={linkStyle}>
          Ir al inicio de sesión
        </Link>
      </>
    );
  } else if (saved) {
    body = <span style={{ color: textColor, fontSize: 14 }}>Contraseña guardada. Entrando al panel…</span>;
  } else {
    body = (
      <>
        {error && (
          <div role="alert" style={{ color: errorColor, fontSize: 13 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="new-password" style={labelStyle}>
            Contraseña nueva
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: isDesktop ? 'var(--muted)' : 'rgba(255,255,255,.6)' }}>
            Mínimo {MIN_LENGTH} caracteres.
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="confirm-password" style={labelStyle}>
            Repite la contraseña
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
          />
        </div>
        <Button
          type="submit"
          variant={isDesktop ? undefined : 'gold'}
          fullWidth={isDesktop}
          disabled={submitting}
          style={isDesktop ? undefined : { padding: 16, fontSize: 15, marginTop: 6 }}
        >
          {submitting ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </>
    );
  }

  if (!isDesktop) {
    return (
      <div className={styles.page}>
        <div className={styles.mobile}>
          <div className={styles.mobileBody}>
            <div className={styles.brandBlock}>
              <img className={styles.brandCircle} src="/brand/munych-logo.png" alt="MUNYCH Association" />
              <div className={styles.brandTextWrap}>
                <span className={styles.brandName}>MUNYCH</span>
                <span className={styles.brandTag}>{heading}</span>
              </div>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              <span style={{ color: 'rgba(255,255,255,.72)', fontSize: 13, textAlign: 'center' }}>{intro}</span>
              {body}
            </form>
          </div>
          <div className={styles.footer}>MUNYCH Association · Edición 2026</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.desktop}>
        <div className={styles.desktopCard}>
          <div className={styles.desktopLeft}>
            <div className={styles.desktopLeftBrand}>
              <img className={styles.desktopLeftCircle} src="/brand/munych-logo.png" alt="MUNYCH Association" />
              <span style={{ fontSize: 11, letterSpacing: '.18em', color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>
                MUNYCH ASSOCIATION
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className={styles.desktopLeftTitle}>{isRecovery ? 'Recupera tu acceso' : 'Bienvenido'}</span>
              <span className={styles.desktopLeftText}>
                Con tu correo y esta contraseña podrás volver a entrar cuando quieras, sin depender del enlace del correo.
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>MUNYCH 2026 · Sesión de marzo</span>
          </div>
          <div className={styles.desktopRight}>
            <form className={styles.desktopForm} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                <span className={styles.desktopHeading}>{heading}</span>
                <span className={styles.desktopSub}>{intro}</span>
              </div>
              {body}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

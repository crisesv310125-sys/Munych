import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@munych/ui/components/Button';
import { Checkbox } from '@munych/ui/components/SelectionControls';
import { useAppState } from '../state/AppStateContext';
import { authService } from '../data-access/authService';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './LoginPage.module.css';

const ROLE_ROUTES = { admin: '/admin', judge: '/juez' } as const;

type Mode = 'password' | 'magic';

export function LoginPage() {
  const { session, login, loginWithMagicLink } = useAppState();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [mode] = useState<Mode>('password');
  const [email, setEmail] = useState('a.reyes@munych.org');
  const [password, setPassword] = useState('12345678');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(authService.linkError ?? '');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) navigate(ROLE_ROUTES[session.role], { replace: true });
  }, [session, navigate]);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'magic') {
        await loginWithMagicLink(email);
        setMagicLinkSent(true);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError('');
    setResetSent(false);
    const target = email.trim();
    if (!target.includes('@')) {
      setError('Escribe tu correo en «Usuario» y vuelve a pulsar «¿Olvidaste tu contraseña?».');
      return;
    }
    setSubmitting(true);
    try {
      await authService.sendPasswordReset(target);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setSubmitting(false);
    }
  }

  // Mismo texto sin importar si el correo existe: no revela qué cuentas hay.
  const resetNotice = 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.';

  const submitLabel = mode === 'magic' ? (submitting ? 'Enviando…' : 'Enviar enlace') : submitting ? 'Entrando…' : 'Entrar';

  if (!isDesktop) {
    return (
      <div className={styles.page}>
        <div className={styles.mobile}>
          <div className={styles.mobileBody}>
            <div className={styles.brandBlock}>
              <img className={styles.brandCircle} src="/brand/munych-logo.png" alt="MUNYCH Association" />
              <div className={styles.brandTextWrap}>
                <span className={styles.brandName}>MUNYCH</span>
                <span className={styles.brandTag}>Inicia sesión</span>
              </div>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
              {error && (
                <div style={{ color: '#FFB4B4', fontSize: 13, textAlign: 'center' }}>{error}</div>
              )}
              {magicLinkSent && (
                <div style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>
                  Revisa tu correo: te enviamos un enlace de acceso.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}>Usuario</label>
                <input
                  value={email}
                  onChange={(e) => setEmail (e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,.07)',
                    border: '1px solid rgba(255,255,255,.22)',
                    borderRadius: 9,
                    padding: 14,
                    color: '#FFFFFF',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
              {mode === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}>Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,.07)',
                      border: '1px solid rgba(255,255,255,.22)',
                      borderRadius: 9,
                      padding: 14,
                      color: '#FFFFFF',
                      fontSize: 15,
                      letterSpacing: '.2em',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
              <Button type="submit" variant="gold" disabled={submitting} style={{ padding: 16, fontSize: 15, marginTop: 6 }}>
                {submitLabel}
              </Button>
              {resetSent && (
                <div role="status" style={{ color: '#FFFFFF', fontSize: 13, textAlign: 'center' }}>
                  {resetNotice}
                </div>
              )}
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={submitting}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.8)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
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
              <span className={styles.desktopLeftTitle}>Bienvenido de nuevo</span>
              <span className={styles.desktopLeftText}>
                Inicia sesión con tus credenciales. Te llevaremos al panel de jueces o de administración según tu rol.
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>MUNYCH 2026 · Sesión de marzo</span>
          </div>
          <div className={styles.desktopRight}>
            <form className={styles.desktopForm} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                <span className={styles.desktopHeading}>Iniciar sesión</span>
                <span className={styles.desktopSub}>
                  {mode === 'password' ? 'Usa tus credenciales de chair o de administración.' : 'Te enviaremos un enlace de acceso a tu correo.'}
                </span>
              </div>
              {error && (
                <div style={{ color: '#C0392B', fontSize: 13 }}>{error}</div>
              )}
              {magicLinkSent && (
                <div style={{ color: 'var(--state-done-fg)', fontSize: 13 }}>
                  Revisa tu correo: te enviamos un enlace de acceso.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Usuario</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ border: '1px solid var(--border-input)', borderRadius: 8, padding: '12px 13px', fontSize: 14, outline: 'none' }}
                />
              </div>
              {mode === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ border: '1px solid var(--border-input)', borderRadius: 8, padding: '12px 13px', fontSize: 14, letterSpacing: '.2em', outline: 'none' }}
                  />
                </div>
              )}
              {mode === 'password' && (
                <div className={styles.rowBetween}>
                  <span className={styles.rememberRow}>
                    <Checkbox checked={remember} onClick={() => setRemember((r) => !r)} />
                    Mantener sesión
                  </span>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={submitting}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--navy)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
              {resetSent && (
                <div role="status" style={{ color: 'var(--state-done-fg)', fontSize: 13 }}>
                  {resetNotice}
                </div>
              )}
              <Button type="submit" fullWidth disabled={submitting}>
                {submitLabel}
              </Button>
            
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

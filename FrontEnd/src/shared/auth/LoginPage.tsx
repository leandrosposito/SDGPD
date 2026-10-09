import { useState, type FC } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { AUTH_IS_HTTP, useSessionStore, type LoginReason } from '@/shared/state/useSessionStore';
import { loginFormSchema, type LoginFormValues } from './login.schema';
import './LoginPage.css';

// ============================================================
// LoginPage — pantalla de login (BE-1b). Solo existe con 'auth' por http
// (VITE_HTTP_SERVICES): con auth en mock no hay login y /login redirige
// al inicio. Al entrar, vuelve a la ruta que el usuario queria ver
// (RequireSession la deja en location.state.from).
//
// El mensaje de credenciales es UNO solo, igual que el del backend: no
// distingue email inexistente, contrasena incorrecta, usuario inactivo ni
// bloqueado (ADR-BE-003, sub-decision 12).
// ============================================================

const LOGIN_ERROR_MESSAGES: Record<LoginReason, string> = {
  'invalid-credentials': 'Email o contrasena incorrectos.',
  network: 'No se pudo conectar con el servidor. Revisa que el backend este levantado.',
  unknown: 'No se pudo iniciar sesion. Intenta de nuevo.',
};

function fromPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state && typeof state.from === 'string') return state.from;
  return '/';
}

export const LoginPage: FC = () => {
  const login = useSessionStore((s) => s.login);
  const status = useSessionStore((s) => s.status);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } });

  if (!AUTH_IS_HTTP || status === 'authenticated') return <Navigate to={fromPath(location.state)} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await login(values.email, values.password);
    if (result.success) {
      navigate(fromPath(location.state), { replace: true });
      return;
    }
    setServerError(LOGIN_ERROR_MESSAGES[result.reason ?? 'unknown']);
  });

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={onSubmit} noValidate aria-labelledby="login-title">
        <h1 id="login-title" className="login-card__title">SDGPD</h1>
        <p className="login-card__subtitle">Ingresa con tu cuenta</p>

        <label className="login-card__field">
          <span className="login-card__label">Email</span>
          <input
            type="email"
            autoComplete="username"
            className={`login-card__input${errors.email ? ' login-card__input--error' : ''}`}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email && <span className="login-card__error">{errors.email.message}</span>}
        </label>

        <label className="login-card__field">
          <span className="login-card__label">Contrasena</span>
          <input
            type="password"
            autoComplete="current-password"
            className={`login-card__input${errors.password ? ' login-card__input--error' : ''}`}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password && <span className="login-card__error">{errors.password.message}</span>}
        </label>

        {serverError && (
          <p className="login-card__server-error" role="alert">
            {serverError}
          </p>
        )}

        <button type="submit" className="login-card__submit" disabled={isSubmitting}>
          <LogIn size={16} aria-hidden="true" />
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
};

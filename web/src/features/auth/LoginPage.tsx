import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { loginSchema, type LoginValues } from './loginSchema';
import { useLogin } from './useLogin';
import { useUiPreferences } from '../../app/providers/UiPreferencesContext';

type Lang = 'en' | 'ar';

const translations = {
  en: {
    title: 'Wisal',
    signIn: 'Sign in',
    subtitle: 'Use your Wisal work account',
    email: 'Email address',
    password: 'Password',
    signingIn: 'Signing in…',
    tooManyAttempts: (s: number) => `Too many attempts. Try again in ${s} seconds.`,
    adminNote: 'Accounts are provisioned by your administrator',
    invalidCredentials: 'Invalid email or password',
    networkError: 'Unable to reach the server. Check your connection and try again.',
    switchDark: 'Switch to dark mode',
    switchLight: 'Switch to light mode',
    switchAr: 'التبديل إلى العربية',
    switchEn: 'Switch to English',
  },
  ar: {
    title: 'وِصال',
    signIn: 'تسجيل الدخول',
    subtitle: 'استخدم حساب وِصال العمل الخاص بك',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signingIn: 'جارٍ تسجيل الدخول…',
    tooManyAttempts: (s: number) => `محاولات كثيرة جداً. حاول مجدداً بعد ${s} ثانية.`,
    adminNote: 'يتم إنشاء الحسابات بواسطة المسؤول',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    networkError: 'تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول مجدداً.',
    switchDark: 'التبديل إلى الوضع الداكن',
    switchLight: 'التبديل إلى الوضع الفاتح',
    switchAr: 'التبديل إلى العربية',
    switchEn: 'Switch to English',
  },
} as const;

export const LoginPage: React.FC = () => {
  const mutation = useLogin();
  const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
  const { resolvedTheme, toggleTheme, direction, setDirection } = useUiPreferences();

  const lang: Lang = direction === 'rtl' ? 'ar' : 'en';
  const t = translations[lang];
  const dir = direction;

  const toggleLang = () => {
    setDirection(direction === 'rtl' ? 'ltr' : 'rtl');
  };

  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const isPending = mutation.isPending;
  const errorStatus = (mutation.error as AxiosError)?.response?.status;
  const isRateLimited = !!mutation.error && errorStatus === 429;
  const isApiError = !!mutation.error && !isRateLimited && errorStatus === 422;
  const isNetworkOrOtherError =
    !!mutation.error && !isRateLimited && !isApiError;

  const apiErrorMessage = isApiError
    ? ((mutation.error as AxiosError).response?.data as { message?: string; errors?: Record<string, string[]> })
        ?.errors?.email?.[0] ||
      ((mutation.error as AxiosError).response?.data as { message?: string })?.message ||
      t.invalidCredentials
    : isNetworkOrOtherError
    ? t.networkError
    : null;

  useEffect(() => {
    if (isRateLimited) {
      const response = (mutation.error as AxiosError).response;
      const retryHeader = response?.headers['retry-after'];
      const initialSeconds = retryHeader ? parseInt(retryHeader, 10) : 60;
      setRetrySeconds(isNaN(initialSeconds) ? 60 : initialSeconds);
    } else {
      setRetrySeconds(null);
    }
  }, [isRateLimited, mutation.error]);

  useEffect(() => {
    if (retrySeconds === null || retrySeconds <= 0) return;
    const timer = setInterval(() => {
      setRetrySeconds((prev) => {
        if (prev === null || prev <= 1) {
          mutation.reset();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [retrySeconds, mutation]);

  const onSubmit = (data: LoginValues) => {
    if (retrySeconds !== null && retrySeconds > 0) return;
    mutation.mutate(data);
  };

  const formDisabled = isPending || (retrySeconds !== null && retrySeconds > 0);

  return (
    <div className="login-root" data-theme={resolvedTheme} dir={dir} lang={lang}>
      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-page, #F8FAFC);
          color: var(--text-main, #0F172A);
          padding-inline: 16px;
          box-sizing: border-box;
          font-family: Inter, 'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif;
        }

        /* Outer wrapper: 400px column, everything stacked */
        .login-wrapper {
          width: min(400px, 100% - 32px);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Toggles row — always right-aligned, immune to RTL via dir=ltr */
        .login-topbar {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-block-end: -4px;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid var(--icon-btn-border);
          background: transparent;
          color: var(--icon-btn-color);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          min-height: 32px;
          transition: opacity 0.15s ease;
        }
        .icon-btn:hover { opacity: 0.75; }
        .icon-btn:focus-visible {
          outline: 2px solid var(--btn-bg);
          outline-offset: 2px;
        }

        /* Logo block — OUTSIDE card, centered */
        .logo-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .logo-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0;
          color: var(--text-main);
        }

        /* Card — white box */
        .login-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 16px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .title-block h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px 0;
        }
        .title-block p {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
        }
        .form-input {
          padding: 8px 12px;
          font-size: 14px;
          border-radius: 8px;
          border: 1px solid var(--input-border);
          background-color: var(--input-bg);
          color: var(--text-main);
          box-sizing: border-box;
          width: 100%;
          font-family: inherit;
          min-height: 44px;
          transition: border-color 0.15s ease;
        }
        .form-input:focus-visible, .fv:focus-visible {
          outline: 2px solid var(--btn-bg);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .form-input:disabled {
          background-color: var(--bg-page);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        .form-input.error { border-color: #FECACA; }
        .field-error {
          font-size: 12px;
          color: #DC2626;
          margin: 2px 0 0 0;
        }
        /* Inline error — no background box, matches design reference */
        .alert-error {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #DC2626;
          font-size: 12px;
          font-weight: 600;
        }
        .btn-submit {
          padding: 14px 12px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 8px;
          border: none;
          background-color: var(--btn-bg);
          color: var(--btn-text);
          cursor: pointer;
          width: 100%;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: inherit;
          transition: opacity 0.15s ease;
        }
        .btn-submit:hover:not(:disabled) { opacity: 0.9; }
        .btn-submit:disabled {
          background-color: var(--btn-disabled);
          color: var(--btn-disabled-text);
          cursor: not-allowed;
        }

        /* Footer note — OUTSIDE card, below it */
        .footer-note {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .spinner { animation: none; }
        }
      `}</style>

      <div className="login-wrapper">
        {/* Logo — outside the card, centered */}
        <div className="logo-block">
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="24" cy="32" r="14" fill="none" stroke="var(--btn-bg, #4F46E5)" strokeWidth="7"/>
            <circle cx="42" cy="32" r="9" fill="none" stroke="var(--btn-bg, #4F46E5)" strokeWidth="7"/>
          </svg>
          <h2 className="logo-title">{t.title}</h2>
        </div>

        {/* Card — white box */}
        <div className="login-card">
          {/* Toggles inside card, dir=ltr so they stay right-aligned in both languages */}
          <div className="login-topbar" dir="ltr">
            <button
              type="button"
              className="icon-btn fv"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? t.switchLight : t.switchDark}
            >
              {resolvedTheme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            <button
              type="button"
              className="icon-btn fv"
              onClick={toggleLang}
              aria-label={lang === 'en' ? t.switchAr : t.switchEn}
            >
              {lang === 'en' ? 'ع' : 'EN'}
            </button>
          </div>

          <div className="title-block">
            <h1>{t.signIn}</h1>
            <p>{t.subtitle}</p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div className="form-group">
              <label htmlFor="email" className="form-label">{t.email}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                disabled={formDisabled}
                className={`form-input fv ${fieldErrors.email || apiErrorMessage ? 'error' : ''}`}
                {...register('email')}
              />
              {fieldErrors.email && <p className="field-error">{fieldErrors.email.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">{t.password}</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={formDisabled}
                className={`form-input fv ${fieldErrors.password || apiErrorMessage ? 'error' : ''}`}
                {...register('password')}
              />
              {fieldErrors.password && <p className="field-error">{fieldErrors.password.message}</p>}
            </div>

            {/* API error — inline, between password and button, matches design reference */}
            {apiErrorMessage && (
              <div className="alert-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v5 M12 16h.01"/>
                </svg>
                <span>{apiErrorMessage}</span>
              </div>
            )}

            {/* Rate limit error — inline, between password and button */}
            {isRateLimited && (
              <div className="alert-error" role="alert" aria-live="polite">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v5 M12 16h.01"/>
                </svg>
                <span>{t.tooManyAttempts(retrySeconds ?? 60)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={formDisabled}
              aria-busy={isPending}
              className="btn-submit fv"
            >
              {isPending && <span className="spinner" aria-hidden="true" />}
              {isPending ? t.signingIn : t.signIn}
            </button>
          </form>
        </div>

        {/* Footer note — outside the card, below it */}
        <p className="footer-note">{t.adminNote}</p>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useT } from '../../../i18n';
import { requestAccessCode, verifyAccessCode } from '../api/portalApi';
import { usePortalSession } from '../hooks/usePortalSession';
import { OtpInput } from '../components/OtpInput';

type IdentifierValues = { identifier: string };

/**
 * Story 17 (WIS-16). The two designed steps
 * (docs/design/references/15.WisalPortalAccess-Step1/,
 * 16.WisalPortalAccess-Step2/) as ONE route, `/portal` — artboards map to
 * component state, not routes.
 */
export const PortalAccessPage: React.FC = () => {
  const { t } = useT('portal');
  const navigate = useNavigate();
  const { signIn } = usePortalSession();

  const [step, setStep] = useState<'identifier' | 'code'>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [maskedIdentifier, setMaskedIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showGenericSent, setShowGenericSent] = useState(false);

  const schema = useMemo(
    () => z.object({ identifier: z.string().min(1, t('access.identifierError')) }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors: fieldErrors },
  } = useForm<IdentifierValues>({ resolver: zodResolver(schema) });

  const requestMutation = useMutation({
    mutationFn: (values: IdentifierValues) => requestAccessCode(values.identifier),
    onSuccess: (data, values) => {
      setIdentifier(values.identifier);
      setMaskedIdentifier(data.masked_identifier);
      setCooldown(data.resend_after_seconds);
      setShowGenericSent(true);
      setCode('');
      setStep('code');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (c: string) => verifyAccessCode(identifier, c),
    onSuccess: (data) => {
      signIn(data.token);
      navigate('/portal/requests', { replace: true });
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmitIdentifier = (values: IdentifierValues) => {
    setShowGenericSent(false);
    requestMutation.mutate(values);
  };

  const onSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    verifyMutation.mutate(code);
  };

  const onResend = () => {
    if (cooldown > 0) return;
    requestMutation.mutate({ identifier });
  };

  const verifyStatus = (verifyMutation.error as AxiosError)?.response?.status;
  const isWrongCode = verifyStatus === 422;
  const isExpiredCode = verifyStatus === 410;
  const attemptsRemaining = (
    (verifyMutation.error as AxiosError)?.response?.data as { attempts_remaining?: number } | undefined
  )?.attempts_remaining;

  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="portal-card">
      {step === 'identifier' && (
        <>
          <div>
            <h1 className="portal-heading">{t('access.heading')}</h1>
          </div>
          <form className="portal-form" onSubmit={handleSubmit(onSubmitIdentifier)} noValidate>
            <div className="portal-field">
              <label htmlFor="identifier" className="portal-label">
                {t('access.identifierLabel')}
              </label>
              <input
                id="identifier"
                type="text"
                className="portal-input fv"
                placeholder={t('access.identifierPlaceholder')}
                disabled={requestMutation.isPending}
                {...register('identifier')}
              />
              <span className="portal-hint">{t('access.identifierHint')}</span>
              {fieldErrors.identifier && (
                <span className="portal-alert-error" role="alert">
                  {fieldErrors.identifier.message}
                </span>
              )}
              {requestMutation.isError && !fieldErrors.identifier && (
                <span className="portal-alert-error" role="alert">
                  {t('access.identifierError')}
                </span>
              )}
            </div>
            <button type="submit" className="portal-btn fv" disabled={requestMutation.isPending} aria-busy={requestMutation.isPending}>
              {requestMutation.isPending ? t('access.sending') : t('access.sendCode')}
            </button>
            {showGenericSent && (
              <p className="portal-hint" role="status">
                {t('access.genericSentBanner')}
              </p>
            )}
          </form>
          <p className="portal-footer-note">
            {t('access.faqFooter')}{' '}
            <Link to="/portal/faq" className="portal-link">
              {t('access.faqLink')}
            </Link>
          </p>
        </>
      )}

      {step === 'code' && (
        <>
          <div>
            <h1 className="portal-heading">{t('access.heading')}</h1>
            <p className="portal-subheading">{t('access.codeSentTo', { identifier: maskedIdentifier })}</p>
          </div>
          <form className="portal-form" onSubmit={onSubmitCode} noValidate>
            <div className="portal-field">
              <span className="portal-label">{t('access.codeLegend')}</span>
              <OtpInput
                value={code}
                onChange={setCode}
                disabled={verifyMutation.isPending || isExpiredCode}
                invalid={isWrongCode}
                errorId="portal-otp-error"
              />
              {isWrongCode && (
                <span id="portal-otp-error" className="portal-alert-error" role="alert">
                  {t('access.codeInvalid')} {t('access.attemptsRemaining', { count: attemptsRemaining ?? 0 })}
                </span>
              )}
              {isExpiredCode && (
                <span className="portal-alert-error" role="alert">
                  {t('access.codeExpiredTitle')}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="portal-btn fv"
              disabled={verifyMutation.isPending || code.length !== 6 || isExpiredCode}
              aria-busy={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? t('access.verifying') : t('access.verify')}
            </button>
          </form>
          <p className="portal-resend" aria-live="polite">
            {cooldown > 0 ? (
              <>
                {t('access.resendIn', { time: formatCooldown(cooldown) }).replace(
                  formatCooldown(cooldown),
                  ''
                )}
                <span className="portal-resend-cooldown">{formatCooldown(cooldown)}</span>
              </>
            ) : (
              <button type="button" className="portal-link" onClick={onResend}>
                {t('access.resendAvailable')}
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
};

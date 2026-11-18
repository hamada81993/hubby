'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthShell from '@/components/auth/AuthShell';
import styles from '@/components/auth/auth.module.css';
import { I18nProvider, useI18n } from '@/components/landing/i18n';

export default function ResetPasswordPage() {
  return (
    <I18nProvider>
      <ResetInner />
    </I18nProvider>
  );
}

function ResetInner() {
  const { t } = useI18n();
  const c = t.auth.passwords;
  const router = useRouter();

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // Read token + email from the link the reset email pointed at.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
    setEmail(params.get('email') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(c.mismatch);
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/password/reset', {
        token,
        email,
        password,
        password_confirmation: confirm,
      });
      setDone(true);
      setTimeout(() => router.push('/login'), 2200);
    } catch (err: any) {
      setError(err.response?.data?.message || c.generalError);
    } finally {
      setIsLoading(false);
    }
  };

  const tokenMissing = !token || !email;

  return (
    <AuthShell accent="secondary" screen="login">
      <div className={styles.formHeader}>
        <h1>{c.resetTitle}</h1>
        <p>{c.resetSubtitle}</p>
      </div>

      {done ? (
        <div className="flex items-start gap-3 rounded-xl border border-[#5FE39A]/30 bg-[#5FE39A]/10 p-4 text-sm text-[#5FE39A]">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{c.success}</span>
        </div>
      ) : tokenMissing ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#F9C566]/30 bg-[#F9C566]/10 p-4 text-sm text-[#F9C566]">
            {c.missingToken}
          </div>
          <Link
            href="/forgot-password"
            data-cursor
            className="flex items-center justify-center gap-2 text-sm font-bold text-[#4FD34A] hover:underline"
          >
            <ArrowLeft size={16} className="rtl:-scale-x-100" />
            {c.backToLogin}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" className={styles.error}>
              {error}
            </div>
          )}

          <Input
            label={c.email}
            type="email"
            value={email}
            disabled
            className="opacity-70"
          />

          <Input
            label={c.newPassword}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Input
            label={c.confirmPassword}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <Button
            type="submit"
            isLoading={isLoading}
            data-cursor
            className={styles.submit}
          >
            {c.resetButton}
            <ArrowRight size={18} className="ms-2 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" />
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthShell from '@/components/auth/AuthShell';
import styles from '@/components/auth/auth.module.css';
import { I18nProvider, useI18n } from '@/components/landing/i18n';

export default function ForgotPasswordPage() {
  return (
    <I18nProvider>
      <ForgotInner />
    </I18nProvider>
  );
}

function ForgotInner() {
  const { t } = useI18n();
  const c = t.auth.passwords;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/password/forgot', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || c.generalError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell accent="primary" screen="login">
      <div className={styles.formHeader}>
        <h1>{c.forgotTitle}</h1>
        <p>{c.forgotSubtitle}</p>
      </div>

      {sent ? (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-[#5FE39A]/30 bg-[#5FE39A]/10 p-4 text-sm text-[#5FE39A]">
            <MailCheck size={18} className="mt-0.5 shrink-0" />
            <span>{c.sent}</span>
          </div>
          <Link
            href="/login"
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
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button
            type="submit"
            isLoading={isLoading}
            data-cursor
            className={styles.submit}
          >
            {c.sendButton}
            <ArrowRight size={18} className="ms-2 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" />
          </Button>

          <Link
            href="/login"
            data-cursor
            className="flex items-center justify-center gap-2 text-sm font-bold text-[#4FD34A] hover:underline"
          >
            <ArrowLeft size={16} className="rtl:-scale-x-100" />
            {c.backToLogin}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

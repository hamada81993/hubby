'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AuthShell from '@/components/auth/AuthShell';
import styles from '@/components/auth/auth.module.css';
import { I18nProvider, useI18n } from '@/components/landing/i18n';


export default function LoginPage() {
  return (
    <I18nProvider>
      <LoginInner />
    </I18nProvider>
  );
}

function LoginInner() {
  const { t } = useI18n();
  const c = t.auth.login;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setOrganizations = useAuthStore((state) => state.setOrganizations);
  const setActiveOrgId = useAuthStore((state) => state.setActiveOrgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/login', { email, password });
      const { access_token, user } = response.data;

      setAuth(user, access_token);

      if (user.organizations && user.organizations.length > 0) {
        setOrganizations(user.organizations);
        setActiveOrgId(user.organizations[0].id);
        router.push('/dashboard');
      } else {
        router.push('/onboarding');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || c.invalid);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell accent="primary" screen="login">
      <div className={styles.formHeader}>
        <h1 >{c.title}</h1>
        <p >{c.subtitle}</p>
      </div>

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

        <div className="space-y-1.5">
          <Input
            label={c.password}
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}

            required
          />
          <div className={styles.helper}>
            <Link
              href="/forgot-password"
              data-cursor

            >
              {c.forgot}
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isLoading}
          data-cursor
          className={styles.submit}
        >
          {c.submit}
          <ArrowRight size={18} className="ms-2 transition-transform group-hover:translate-x-1 rtl:-scale-x-100" />
        </Button>

        <p className={styles.switch}>
          {c.noAccount}{' '}
          <Link
            href="/register"
            data-cursor

          >
            {c.signup}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

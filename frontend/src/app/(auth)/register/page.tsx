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


export default function RegisterPage() {
  return (
    <I18nProvider>
      <RegisterInner />
    </I18nProvider>
  );
}

function RegisterInner() {
  const { t } = useI18n();
  const c = t.auth.register;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization_name: '',
    password: '',
    password_confirmation: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setOrganizations = useAuthStore((state) => state.setOrganizations);
  const setActiveOrgId = useAuthStore((state) => state.setActiveOrgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const response = await api.post('/register', formData);
      const { access_token, user } = response.data;

      setAuth(user, access_token);

      if (user.organizations && user.organizations.length > 0) {
        setOrganizations(user.organizations);
        setActiveOrgId(user.organizations[0].id);
      }

      router.push('/onboarding');
    } catch (err: any) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({
          general: [err.response?.data?.message || err.message || c.generalError],
        });
        console.error('Registration error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <AuthShell accent="secondary" screen="register">
      <div className={styles.formHeader}>
        <h1 >{c.title}</h1>
        <p >{c.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div role="alert" className={styles.error}>
            {errors.general[0]}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={c.name}
            name="name"
            autoComplete="name"
            placeholder={c.namePlaceholder}
            value={formData.name}
            onChange={handleChange}
            error={errors.name?.[0]}

            required
          />
          <Input
            label={c.org}
            name="organization_name"
            autoComplete="organization"
            placeholder={c.orgPlaceholder}
            value={formData.organization_name}
            onChange={handleChange}
            error={errors.organization_name?.[0]}

            required
          />
        </div>

        <Input
          label={c.email}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={formData.email}
          onChange={handleChange}
          error={errors.email?.[0]}

          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={c.password}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            error={errors.password?.[0]}

            required
          />
          <Input
            label={c.confirm}
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={formData.password_confirmation}
            onChange={handleChange}

            required
          />
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
          {c.haveAccount}{' '}
          <Link
            href="/login"
            data-cursor

          >
            {c.signin}
          </Link>
        </p>
      </form>

      <p className={styles.terms}>
        {c.termsPre}{' '}
        <Link href="/terms" data-cursor >
          {c.terms}
        </Link>{' '}
        {c.and}{' '}
        <Link href="/privacy" data-cursor >
          {c.privacy}
        </Link>
        .
      </p>
    </AuthShell>
  );
}

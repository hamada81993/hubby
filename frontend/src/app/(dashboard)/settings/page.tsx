'use client';

import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  User,
  Building2,
  Lock,
  Bell,
  Save,
  ShieldCheck,
  Box,
  ShoppingBag,
  Zap,
  Truck,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/i18n';
import { useTheme } from '@/components/providers/ThemeProvider';

function Banner({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'rounded-xl p-3 text-sm border',
        kind === 'success'
          ? 'bg-secondary/10 border-secondary/30 text-secondary'
          : 'bg-destructive/10 border-destructive/30 text-destructive'
      )}
    >
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { theme, toggleTheme } = useTheme();

  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const setUser = useAuthStore((s) => s.setUser);
  const updateOrganizationName = useAuthStore((s) => s.updateOrganizationName);

  const activeOrg = organizations.find((o) => o.id === activeOrgId) || organizations[0];

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ k: 'success' | 'error'; m: string } | null>(null);

  // Organization
  const [orgName, setOrgName] = useState(activeOrg?.name || '');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgMsg, setOrgMsg] = useState<{ k: 'success' | 'error'; m: string } | null>(null);

  // The signed-in user and organisation arrive after the first render; fill the forms once they do.
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);
  useEffect(() => {
    if (activeOrg) setOrgName(activeOrg.name || '');
  }, [activeOrg]);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ k: 'success' | 'error'; m: string } | null>(null);

  // Notification preferences (persisted via /notification-preferences)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    api
      .get('/notification-preferences')
      .then((r) => setPrefs(r.data))
      .catch(() => {});
  }, []);

  const savePref = async (key: string, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic
    try {
      const r = await api.put('/notification-preferences', { [key]: value });
      setPrefs(r.data);
    } catch {
      setPrefs((p) => ({ ...p, [key]: !value })); // revert on failure
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await api.put('/profile', { name, email });
      setUser({ name: res.data.name, email: res.data.email });
      setProfileMsg({ k: 'success', m: t('settings.profile.updated') });
    } catch (err: any) {
      setProfileMsg({ k: 'error', m: err.response?.data?.message || t('settings.profile.error') });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setSavingOrg(true);
    setOrgMsg(null);
    try {
      const res = await api.put('/organization', { name: orgName });
      updateOrganizationName(activeOrg.id, res.data.name);
      setOrgMsg({ k: 'success', m: t('settings.organization.updated') });
    } catch (err: any) {
      setOrgMsg({ k: 'error', m: err.response?.data?.message || t('settings.organization.error') });
    } finally {
      setSavingOrg(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    setPwMsg(null);
    try {
      await api.put('/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ k: 'success', m: t('settings.security.updated') });
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      const first = errors ? (Object.values(errors)[0] as string[])[0] : null;
      setPwMsg({ k: 'error', m: first || err.response?.data?.message || t('settings.security.error') });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{activeOrg?.name || t('settings.subtitle')}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-black tracking-[-0.025em]">{l('Make Hubby yours.', 'اجعل هَبّي على طريقتك.')}</h1>
      </div>

      {/* Everything on one page, in two columns of cards: nothing is hidden behind a tab. */}
      <div className="columns-1 gap-[18px] xl:columns-2 [&>*]:mb-[18px] [&>*]:break-inside-avoid">
          {(
            <Card className="p-6 rounded-[28px]">
              <form onSubmit={saveProfile} className="space-y-6">
                <div className="flex items-center gap-5 pb-6 border-b border-border">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 text-2xl font-bold uppercase">
                    {(name || user?.name || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{t('settings.profile.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.profile.desc')}</p>
                  </div>
                </div>

                {profileMsg && <Banner message={profileMsg.m} kind={profileMsg.k} />}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label={t('settings.profile.fullName')} value={name} onChange={(e) => setName(e.target.value)} required />
                  <Input label={t('settings.profile.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" isLoading={savingProfile}>
                    <Save size={16} className="me-2" />
                    {t('settings.profile.save')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="p-6 rounded-[28px] space-y-5">
            <h3 className="text-lg font-bold">{l('Look and language', 'المظهر واللغة')}</h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold">{l('Theme', 'المظهر')}</p>
                <p className="text-xs text-muted-foreground">{l('Dark or light, saved on this device', 'داكن أو فاتح، يُحفظ على هذا الجهاز')}</p>
              </div>
              <Segmented
                label={l('Theme', 'المظهر')}
                value={theme}
                options={[{ value: 'dark', label: l('Dark', 'داكن') }, { value: 'light', label: l('Light', 'فاتح') }]}
                onChange={(v) => { if (v !== theme) toggleTheme(); }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="text-sm font-bold">{l('Language', 'اللغة')}</p>
                <p className="text-xs text-muted-foreground">{l('Each person on the team keeps their own', 'كل فرد في الفريق يحتفظ بلغته')}</p>
              </div>
              <Segmented
                label={l('Language', 'اللغة')}
                value={locale}
                options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]}
                onChange={setLocale}
              />
            </div>
          </Card>

          {(
            <Card className="p-6 rounded-[28px]">
              <form onSubmit={saveOrg} className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold">{t('settings.organization.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.organization.desc')}</p>
                </div>

                {orgMsg && <Banner message={orgMsg.m} kind={orgMsg.k} />}

                <div className="space-y-6">
                  <Input label={t('settings.organization.name')} value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" isLoading={savingOrg} disabled={!activeOrg}>
                    {t('settings.organization.update')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {(
            <Card className="p-6 rounded-[28px] space-y-6">
              <div>
                <h3 className="text-lg font-bold">{t('settings.shipping.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.shipping.desc')}</p>
              </div>
              <Link
                href="/shipments/carriers"
                className="flex items-center justify-between rounded-xl border border-border px-5 py-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Truck size={20} className="text-primary" />
                  <div>
                    <p className="font-medium">{t('settings.shipping.carriersTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.shipping.carriersDesc')}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
            </Card>
          )}

          {(
            <Card className="p-6 rounded-[28px]">
              <form onSubmit={savePassword} className="space-y-8">
                <div>
                  <h3 className="text-base font-bold">{t('settings.security.title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.security.desc')}</p>
                </div>

                {pwMsg && <Banner message={pwMsg.m} kind={pwMsg.k} />}

                <div className="grid grid-cols-1 gap-4">
                  <Input label={t('settings.security.currentPassword')} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                  <Input label={t('settings.security.newPassword')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  <Input label={t('settings.security.confirmPassword')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" isLoading={savingPw}>
                    <ShieldCheck size={16} className="me-2" />
                    {t('settings.security.update')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {(
            <Card className="p-6 rounded-[28px] space-y-6">
              <div>
                <h3 className="text-lg font-bold">{t('settings.notifications.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.notifications.desc')}</p>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'new_orders', label: t('settings.notifications.items.newOrders.label'), desc: t('settings.notifications.items.newOrders.desc'), icon: ShoppingBag },
                  { key: 'inventory_alerts', label: t('settings.notifications.items.inventoryAlerts.label'), desc: t('settings.notifications.items.inventoryAlerts.desc'), icon: Box },
                  { key: 'security_updates', label: t('settings.notifications.items.securityUpdates.label'), desc: t('settings.notifications.items.securityUpdates.desc'), icon: Lock },
                  { key: 'marketing', label: t('settings.notifications.items.marketing.label'), desc: t('settings.notifications.items.marketing.desc'), icon: Zap },
                ].map((item) => (
                  <NotificationToggle
                    key={item.key}
                    label={item.label}
                    desc={item.desc}
                    icon={item.icon}
                    on={!!prefs[item.key]}
                    onToggle={(v) => savePref(item.key, v)}
                  />
                ))}
              </div>
            </Card>
          )}

          <section className="rounded-[28px] bg-action p-6 text-action-foreground">
            <p className="text-sm font-bold">{l('Plan and billing', 'الخطة والفوترة')}</p>
            <p className="mt-1 text-[32px] font-black leading-tight tracking-[-0.03em]">{activeOrg?.name || 'Hubby'}</p>
            <Link href="/billing" className="mt-4 inline-flex h-11 items-center rounded-xl bg-action-foreground px-5 text-sm font-bold text-white">
              {l('Manage plan and billing', 'إدارة الخطة والفوترة')}
            </Link>
          </section>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 rounded-lg px-4 text-sm font-bold transition-colors',
            o.value === value ? 'bg-action text-action-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NotificationToggle({
  label,
  desc,
  icon: Icon,
  on,
  onToggle,
}: {
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  on: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl hover:bg-accent/30 transition-all border border-border/50">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-background rounded-lg border border-border">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!on)}
        aria-pressed={on}
        className={cn(
          'w-12 h-6 rounded-full relative p-1 transition-colors',
          on ? 'bg-primary' : 'bg-accent'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full transition-all',
            on ? 'end-1' : 'start-1'
          )}
        />
      </button>
    </div>
  );
}

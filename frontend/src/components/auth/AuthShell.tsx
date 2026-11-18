'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import LiveHub from '@/components/operations/LiveHub';
import { useI18n } from '../landing/i18n';
import { Logo } from '../ui/Logo';
import styles from './auth.module.css';

// Illustrative stores for the hub beside the form; the real hub reads the merchant's own.
const sampleStores = [
  { id: 1, name: 'Salla', platform: 'salla', state: 'healthy', revenue: 16940 },
  { id: 2, name: 'Shopify', platform: 'shopify', state: 'healthy', revenue: 11280 },
  { id: 3, name: 'Noon', platform: 'noon', state: 'healthy', revenue: 7420 },
  { id: 4, name: 'Amazon.sa', platform: 'amazon', state: 'healthy', revenue: 4870 },
  { id: 5, name: 'Zid', platform: 'zid', state: 'healthy', revenue: 1350 },
];

/**
 * The sign-in and sign-up layout: the form on one side, and on the other the
 * thing the visitor is signing in to, the live hub, already moving.
 */
export default function AuthShell({ screen, children }: { accent?: 'primary' | 'secondary'; screen: 'login' | 'register'; children: ReactNode }) {
  const { locale, dir, toggle, t } = useI18n();
  const ar = locale === 'ar';
  const register = screen === 'register';
  return <div className={styles.shell} dir={dir} lang={locale}>
    <header className={styles.header}>
      <Link href="/" aria-label="Hubby"><Logo variant="dark" className={styles.logo} /></Link>
      <div className={styles.headerLinks}>
        <Link href="/" className={styles.back}>{ar ? 'العودة إلى هَبّي' : 'Back to Hubby'}<ArrowUpRight size={15} /></Link>
        <button type="button" onClick={toggle} aria-label={ar ? 'Switch to English' : 'Switch to Arabic'}>{ar ? 'English' : 'العربية'}</button>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.brand}>
        <div className={styles.brandIntro}>
          <p className={styles.kicker}><span />{ar ? 'متاجر كثيرة. هَبّي واحد.' : 'MANY STORES. ONE HUBBY.'}</p>
          <h2>{ar ? (register ? 'أحضر متاجرك.' : 'أهلاً بعودتك.') : (register ? 'Bring your stores.' : 'Welcome back.')}<br /><em>{ar ? (register ? 'ونحن نحفظ الإيقاع.' : 'متاجرك في انتظارك.') : (register ? 'We will keep the beat.' : 'Your stores are waiting.')}</em></h2>
        </div>
        <div className={styles.hub} aria-hidden="true">
          <LiveHub
            stores={sampleStores}
            centreValue="128"
            centreLabel={ar ? 'طلب اليوم' : 'orders today'}
            ariaLabel=""
            shareLabel={pct => `${pct}%`}
            moreLabel={n => `+${n}`}
            stateLabel={() => ({ text: ar ? 'مباشر' : 'Live', ok: true })}
          />
        </div>
        <p className={styles.brandFoot}>{ar ? 'الأرقام هنا بيانات تجريبية.' : 'Figures here are sample data.'}</p>
      </aside>
      <main className={styles.main}>
        <div className={styles.formCard}>
          {children}
        </div>
        <p className={styles.footer}>{t.footer.copyright}</p>
      </main>
    </div>
  </div>;
}

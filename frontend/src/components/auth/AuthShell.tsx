'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Package, Store, Sparkles } from 'lucide-react';
import { useI18n } from '../landing/i18n';
import { Logo } from '../ui/Logo';
import styles from './auth.module.css';

export default function AuthShell({ screen, children }: { accent?: 'primary' | 'secondary'; screen: 'login' | 'register'; children: ReactNode }) {
  const { locale, dir, toggle, t } = useI18n();
  const ar = locale === 'ar';
  const register = screen === 'register';
  return <div className={styles.shell} dir={dir} lang={locale}>
    <header className={styles.header}>
      <Link href="/" aria-label="Hubby"><Logo className={styles.logo} /></Link>
      <div className={styles.headerLinks}>
        <Link href="/" className={styles.back}>{ar ? 'العودة إلى هَبّي' : 'Back to Hubby'}<ArrowUpRight size={15} /></Link>
        <button type="button" onClick={toggle} aria-label={ar ? 'Switch to English' : 'Switch to Arabic'}>{ar ? 'English' : 'العربية'}</button>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.brand}>
        <div className={styles.brandIntro}>
          <p className={styles.kicker}><span />{ar ? 'متاجر كثيرة. هَبّي واحد.' : 'MANY STORES. ONE HUBBY.'}</p>
          <h2>{ar ? (register ? 'مساحة لطموحك.' : 'كل شيء في مكانه.') : (register ? 'Big ideas.' : 'Your world.')}<br /><em>{ar ? (register ? 'وبداية جديدة.' : 'أهلًا بعودتك.') : (register ? 'A place to grow.' : 'All together.')}</em></h2>
          <p className={styles.description}>{ar ? 'متاجرك وطلباتك وخطوتك القادمة — كلها متصلة في مساحة واحدة.' : 'Your stores, your orders, your next big move. All connected in one place.'}</p>
        </div>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.platform} />
          <div className={styles.bag}>
            <div className={styles.handle} />
            <div className={styles.storefront}><div className={styles.awning} /><Store strokeWidth={1.1} /><div className={styles.shelves}><i /><i /><i /></div></div>
            <span className={styles.bagLabel}>h.</span>
          </div>
          <div className={styles.parcel}><Package size={40} strokeWidth={1} /><span /></div>
          <div className={styles.statusCard}><span><Check size={15} /></span><div>{ar ? 'كل شيء متصل' : 'Everything connected'}<small>{ar ? 'جاهز لخطوتك القادمة' : 'Ready for your next move'}</small></div><ArrowUpRight size={18} /></div>
          <div className={styles.spark}><Sparkles size={27} strokeWidth={1.2} /></div>
        </div>
        <div className={styles.brandFoot}><span>H / {ar ? 'مساحتك للنمو' : 'YOUR SPACE TO GROW'}</span><span>01 — ∞</span></div>
      </aside>
      <main className={styles.main}>
        <div className={styles.formCard}>
          <p className={styles.formEyebrow}>{ar ? (register ? 'فصلك القادم يبدأ هنا' : 'أهلًا بك في مساحتك') : (register ? 'YOUR NEXT CHAPTER STARTS HERE' : 'MAKE YOURSELF AT HOME')}</p>
          {children}
        </div>
        <p className={styles.footer}>{t.footer.copyright}</p>
      </main>
    </div>
  </div>;
}

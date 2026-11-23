'use client';

import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { I18nProvider, useI18n } from '@/components/landing/i18n';

export type LegalSection = { title: string; body: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: LegalSection[] };

/** A plain, readable legal page in the site's dark look, in English and Arabic. */
export default function LegalPage({ en, ar }: { en: LegalDoc; ar: LegalDoc }) {
  return <I18nProvider><Body en={en} ar={ar} /></I18nProvider>;
}

function Body({ en, ar }: { en: LegalDoc; ar: LegalDoc }) {
  const { locale, dir, toggle } = useI18n();
  const doc = locale === 'ar' ? ar : en;
  return (
    <div dir={dir} lang={locale} className="min-h-screen bg-background text-foreground" style={locale === 'ar' ? { fontFamily: "'Alexandria', system-ui, sans-serif" } : undefined}>
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-10">
        <Link href="/" aria-label="Hubby"><Logo variant="dark" className="h-7 w-auto" /></Link>
        <button type="button" onClick={toggle} className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent">
          {locale === 'ar' ? 'English' : 'العربية'}
        </button>
      </header>
      <main className="mx-auto max-w-[70ch] px-5 py-12 sm:py-16">
        <h1 className="text-4xl font-black leading-tight tracking-[-0.03em]">{doc.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{doc.updated}</p>
        <p className="mt-8 text-base leading-8 text-muted-foreground">{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.title} className="mt-10">
            <h2 className="text-xl font-bold">{section.title}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="mt-3 text-base leading-8 text-muted-foreground">{paragraph}</p>
            ))}
          </section>
        ))}
      </main>
      <footer className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground sm:px-10">
        <Link href="/privacy" className="hover:text-foreground">{locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy'}</Link>
        <span className="mx-3">·</span>
        <Link href="/terms" className="hover:text-foreground">{locale === 'ar' ? 'شروط الاستخدام' : 'Terms'}</Link>
      </footer>
    </div>
  );
}

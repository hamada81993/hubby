'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, Menu, Minus, Plus, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Logo } from '@/components/ui/Logo';
import { I18nProvider, useI18n } from './i18n';
import { copy } from './redesign-copy';
import styles from './landing.module.css';

const CommerceWorld = dynamic(() => import('./scene/CommerceWorld'), { ssr: false });
gsap.registerPlugin(ScrollTrigger);

export default function LandingExperience() {
  return <I18nProvider><Landing /></I18nProvider>;
}

function Landing() {
  const { locale, dir, toggle } = useI18n();
  const c = copy[locale];
  const root = useRef<HTMLDivElement>(null);
  const journey = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [menu, setMenu] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({ trigger: journey.current, start: 'top top', end: 'bottom bottom', onUpdate: self => { progress.current = self.progress; } });
      if (motion) gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => {
        gsap.fromTo(element, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
    }, root);
    let disposed = false;
    document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    return () => { disposed = true; ctx.revert(); };
  }, [locale, motion]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);

  const links = ['world', 'platform', 'connections', 'how-it-works'];
  return (
    <div ref={root} className={styles.site} dir={dir} lang={locale}>
      <a className={styles.skip} href="#main">{c.skip}</a>
      <header className={styles.nav}>
        <Link href="/" aria-label="Hubby" className={styles.logo}><Logo /></Link>
        <nav className={styles.desktopNav} aria-label={c.navigation}>{c.nav.slice(0, 3).map((label, i) => <a key={label} href={`#${links[i]}`}>{label}</a>)}</nav>
        <div className={styles.navActions}>
          <button className={styles.language} onClick={toggle} aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}>{locale === 'en' ? 'العربية' : 'English'}</button>
          <Link href="/login" className={styles.login}>{c.login} <ArrowUpRight size={15} /></Link>
          <button className={styles.menuButton} onClick={() => setMenu(!menu)} aria-label={menu ? c.close : c.menu} aria-expanded={menu} aria-controls="landing-menu">{menu ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </header>
      {menu && <nav id="landing-menu" className={styles.menuPanel} aria-label={c.navigation}>
        {c.nav.map((label, i) => <a key={label} href={`#${links[i]}`} onClick={() => setMenu(false)}><span>0{i + 1}</span>{label}<ArrowUpRight /></a>)}
        <Link href="/register">{c.start}<ArrowUpRight /></Link><Link href="/login">{c.login}<ArrowUpRight /></Link>
      </nav>}
      <main id="main">
        <section ref={journey} id="world" className={styles.journey} aria-label={c.world}>
          <div className={styles.stage} aria-hidden="true">
            <div className={styles.stageGrid} />
            <div className={styles.fallbackSculpture}><span /><span /><span /></div>
            <CommerceWorld progress={progress} motion={motion} rtl={dir === 'rtl'} />
          </div>
          <div className={styles.story}>
            {c.chapters.map((chapter, i) => <section id={i === 1 ? 'chapter-two' : i === 2 ? 'chapter-three' : undefined} key={chapter.label} className={`${styles.chapter} ${i === 0 ? styles.hero : ''}`}>
              {i === 0 && <div className={styles.sceneCaption} aria-hidden="true"><span className={styles.liveDot} /> HUBBY / COMMERCE IN MOTION</div>}
              <div className={styles.chapterContent}>
                <p className={styles.eyebrow}><span className={styles.liveDot} />{chapter.label}</p>
                {i === 0 ? <h1>{chapter.title}<br /><em>{chapter.accent}</em></h1> : <h2>{chapter.title}<br /><em>{chapter.accent}</em></h2>}
                <p className={styles.chapterBody}>{chapter.body}</p>
                {i === 0 ? <Link href="/register" className={styles.primaryButton}>{c.start}<span><ArrowUpRight size={21} /></span></Link> : <a className={styles.textLink} href={i === 1 ? '#connections' : '#platform'}>{chapter.link}<ArrowUpRight size={20} /></a>}
              </div>
              <div className={styles.chapterBottom}><span>0{i + 1} / 03</span><a href={i === 0 ? '#chapter-two' : i === 1 ? '#chapter-three' : '#platform'}>{c.scroll}<ArrowDown size={15} /></a><span>{chapter.foot}</span></div>
            </section>)}
          </div>
        </section>
        <section className={styles.intro} data-reveal>
          <p className={styles.eyebrow}>{c.introLabel}</p><h2>{c.introTitle}<span>{c.introAccent}</span></h2>
          <div className={styles.introBottom}><span className={styles.asterisk} aria-hidden="true">✳</span><p>{c.introBody}</p></div>
        </section>
        <section id="platform" className={styles.platform}>
          <div className={styles.sectionTop} data-reveal><p className={styles.eyebrow}>01 / {c.platformLabel}</p><span>{c.platformNote}</span></div>
          <div className={styles.platformGrid}>
            <div className={styles.featureVisual} data-feature={activeFeature}>
              <span className={styles.visualNumber}>0{activeFeature + 1}</span><div className={styles.visualOrbit} />
              <div className={styles.visualBlock}><span>{['↗', '≋', '↔', '▥'][activeFeature]}</span></div>
              <div className={styles.miniLabel}><Check size={15} />{c.featureSignals[activeFeature]}</div>
              <p>{c.features[activeFeature].title}</p><span className={styles.visualCorner}>H / {c.connected}</span>
            </div>
            <div className={styles.featureList}><h2 data-reveal>{c.platformTitle}</h2>
              {c.features.map((feature, i) => <div key={feature.title} className={styles.feature}>
                <h3><button aria-expanded={activeFeature === i} aria-controls={`feature-${i}`} onClick={() => setActiveFeature(i)}><span className={styles.featureIndex}>0{i + 1}</span>{feature.title}{activeFeature === i ? <Minus size={20} /> : <Plus size={20} />}</button></h3>
                <div id={`feature-${i}`} hidden={activeFeature !== i}><p>{feature.body}</p><Link href="/register" className={styles.textLink}>{c.explore}<ArrowUpRight size={17} /></Link></div>
              </div>)}
            </div>
          </div>
        </section>
        <section id="connections" className={styles.connections}>
          <div className={styles.sectionTop}><p className={styles.eyebrow}>02 / {c.connectionsLabel}</p><span>7 {c.channels}</span></div>
          <h2 data-reveal>{c.connectionsTitle}<br /><em>{c.connectionsAccent}</em></h2><p className={styles.connectionsBody}>{c.connectionsBody}</p>
          <div className={styles.channelGrid}>{['Shopify', 'Salla', 'Amazon', 'Noon', 'Zid', 'WooCommerce', 'Trendyol'].map((name, i) => <div key={name} className={styles.channel}><span>0{i + 1}</span><strong>{name}</strong><ArrowUpRight size={18} /></div>)}</div>
          <div className={styles.connectionFooter}><span className={styles.liveDot} />{c.connectionFoot}<Link href="/register">{c.connect}<ArrowUpRight size={18} /></Link></div>
        </section>
        <section id="how-it-works" className={styles.steps}>
          <div className={styles.sectionTop}><p className={styles.eyebrow}>03 / {c.stepsLabel}</p><span>{c.stepsNote}</span></div><h2 data-reveal>{c.stepsTitle}</h2>
          <div className={styles.stepGrid}>{c.steps.map((step, i) => <article key={step.title} data-reveal><span className={styles.stepNumber}>0{i + 1}<ArrowUpRight size={28} /></span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div>
        </section>
        <section className={styles.closing}>
          <div className={styles.closingRing} aria-hidden="true" /><p className={styles.eyebrow}>{c.closingLabel}</p><h2 data-reveal>{c.closingTitle}<br /><em>{c.closingAccent}</em></h2>
          <Link href="/register" className={styles.primaryButton}>{c.start}<span><ArrowUpRight size={24} /></span></Link><div className={styles.closingBottom}><span>{c.closingFoot}</span><span>EN / العربية</span></div>
        </section>
      </main>
      <footer className={styles.footer}><Link href="/" aria-label="Hubby"><Logo /></Link><p>{c.footer}</p><a href="#world">{c.back}<ArrowUpRight size={16} /></a></footer>
    </div>
  );
}

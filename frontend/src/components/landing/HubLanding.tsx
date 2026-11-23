'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUp, Check, Package, ScanLine, Sparkles, Truck } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { I18nProvider, useI18n } from './i18n';
import { hubCopy } from './hub-copy';
import styles from './hub-landing.module.css';

// Sample marketplaces for the hero hub: `orders` is each one's share of the day.
const PLATFORMS = [
  { id: 'salla', name: 'Salla', file: 'marks/salla', orders: 52, on: true },
  { id: 'shopify', name: 'Shopify', file: 'marks/shopify', orders: 31, on: true },
  { id: 'noon', name: 'Noon', file: 'marks/noon', orders: 24, on: true },
  { id: 'amazon', name: 'Amazon', file: 'marks/amazon', orders: 15, on: false },
  { id: 'zid', name: 'Zid', file: 'marks/zid', orders: 9, on: false },
  { id: 'woocommerce', name: 'WooCommerce', file: 'woocommerce', orders: 7, on: false },
  { id: 'trendyol', name: 'Trendyol', file: 'trendyol', orders: 5, on: false },
];
const W = 760;
const H = 720;
const CX = W / 2;
const CY = H / 2;
const NODES = PLATFORMS.map((p, i) => {
  const angle = ((-90 + (i * 360) / PLATFORMS.length) * Math.PI) / 180;
  return { ...p, x: CX + 285 * Math.cos(angle), y: CY + 270 * Math.sin(angle), phase: i * 1.3, weight: p.orders / 52 };
});
const curve = (x: number, y: number) => {
  // Bend each line a little, always the same way round, so they read as a flow.
  const mx = (x + CX) / 2 - (y - CY) * 0.16;
  const my = (y + CY) / 2 + (x - CX) * 0.16;
  return { mx, my, d: `M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${CX} ${CY}` };
};

const FEED = [
  ['#SL-48213', 'Salla', 'Riyadh', '412.00'], ['#SH-10592', 'Shopify', 'Jeddah', '268.00'], ['#NN-90177', 'Noon', 'Dammam', '189.50'],
  ['#SL-48220', 'Salla', 'Riyadh', '655.00'], ['#AZ-33014', 'Amazon', 'Makkah', '97.75'], ['#ZD-7741', 'Zid', 'Hail', '240.00'],
  ['#SL-48226', 'Salla', 'Khobar', '318.25'], ['#SH-10601', 'Shopify', 'Madinah', '529.00'], ['#TY-2208', 'Trendyol', 'Tabuk', '143.00'],
];
const ORDERS = [
  ['#SL-48213', 'marks/salla', 'Reem Al-Harbi', '412.00', 0], ['#SH-10592', 'marks/shopify', 'Abdullah Al-Ghamdi', '268.00', 0],
  ['#NN-90177', 'marks/noon', 'Fahd Al-Otaibi', '189.50', 1], ['#AZ-33014', 'marks/amazon', 'Mohammed Al-Zahrani', '97.75', 2],
] as const;

export default function HubLanding() {
  return <I18nProvider><Page /></I18nProvider>;
}

function useMotion() {
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return motion;
}

function Page() {
  const { locale, dir, toggle } = useI18n();
  const c = hubCopy[locale];
  const ar = locale === 'ar';
  const root = useRef<HTMLDivElement>(null);
  const motion = useMotion();

  // Sections rise as they enter the view. Until this runs everything is visible,
  // so the page reads without script.
  useEffect(() => {
    const el = root.current;
    if (!el || !motion) return;
    el.classList.add(styles.ready);
    const seen = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-in', '');
          seen.unobserve(entry.target);
        }
      }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    el.querySelectorAll('[data-reveal]').forEach(node => seen.observe(node));
    return () => {
      seen.disconnect();
      el.classList.remove(styles.ready);
    };
  }, [motion, locale]);

  return (
    <div ref={root} className={styles.site} dir={dir} lang={locale}>
      <a className={styles.skip} href="#main">{c.skip}</a>
      <header className={styles.nav}>
        <Link href="/" aria-label="Hubby" className={styles.logo}><Logo variant="dark" /></Link>
        <nav aria-label="Main" className={styles.navLinks}>
          <a href="#product">{c.nav.product}</a><a href="#journey">{c.nav.journey}</a><a href="#ai">{c.nav.ai}</a>
        </nav>
        <div className={styles.navActions}>
          <button type="button" onClick={toggle} className={styles.lang} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'عربي'}</button>
          <Link href="/login" className={styles.ghost}>{c.nav.login}</Link>
          <Link href="/register" className={styles.cta}>{c.nav.start}</Link>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.dot} />{c.hero.eyebrow}</p>
            <h1>{c.hero.title}<br /><em>{c.hero.accent}</em></h1>
            <p className={styles.lead}>{c.hero.body}</p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.ctaLarge}>{c.nav.start}<ArrowRight size={20} className={styles.flip} /></Link>
              <Link href="/login" className={styles.ghostLarge}>{c.nav.login}</Link>
            </div>
          </div>
          <HeroHub motion={motion} c={c.hero} />
        </section>

        <div className={styles.ticker} aria-label={c.ticker}>
          <div className={styles.tickerTrack}>
            {[...FEED, ...FEED].map(([id, store, city, total], i) => (
              <span key={i} aria-hidden={i >= FEED.length}><b>{id}</b>{store}<i>{city}</i><strong>SAR {total}</strong></span>
            ))}
          </div>
        </div>

        <Journey motion={motion} c={c.journey} />

        <section id="product" className={styles.desk}>
          <p className={styles.eyebrow}>{c.desk.label}</p>
          <h2 data-reveal>{c.desk.title}<br /><em>{c.desk.accent}</em></h2>
          <div className={styles.bento}>
            <article className={`${styles.card} ${styles.wide}`} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.orders.title}</h3><p>{c.desk.orders.body}</p></div>
              <div className={styles.fragment} dir="ltr" aria-hidden="true">
                {ORDERS.map(([id, file, name, total, tone]) => (
                  <div key={id} className={styles.row}>
                    <span className={styles.mark}><img src={`/platforms/${file}.svg`} alt="" /></span>
                    <b>{id}</b><span className={styles.grow}>{name}</span>
                    <span className={styles.pill} data-tone={tone}>{(ar ? ['جاهز للتجهيز', 'تأخر عن الشحن', 'تم الشحن'] : ['Ready to pack', 'Late to ship', 'Shipped'])[tone]}</span>
                    <strong>{total}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className={styles.card} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.stock.title}</h3><p>{c.desk.stock.body}</p></div>
              <StockSync motion={motion} product={c.desk.stock.product} unit={c.desk.stock.unit} />
            </article>
            <article className={styles.card} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.profit.title}</h3><p>{c.desk.profit.body}</p></div>
              <div className={styles.fragment} dir="ltr" aria-hidden="true">
                <span className={styles.metricLabel}>{c.desk.profit.metric}</span>
                <span className={styles.metric}>SAR 38,420</span>
                <svg viewBox="0 0 320 96" className={styles.chart}>
                  <path d="M0 78 C 30 70, 46 74, 70 60 S 112 62, 138 44 S 182 50, 206 30 S 262 28, 320 8" fill="none" stroke="#4FD34A" strokeWidth="3" strokeLinecap="round" pathLength={1} />
                  <path d="M0 86 C 40 84, 80 80, 120 76 S 220 66, 320 58" fill="none" stroke="#2FA3A0" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.02 0.03" pathLength={1} />
                </svg>
              </div>
            </article>
            <article className={styles.card} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.ship.title}</h3><p>{c.desk.ship.body}</p></div>
              <ol className={styles.track} aria-hidden="true">
                {c.desk.ship.steps.map((step, i) => <li key={step} data-done={i < 3 ? '' : undefined}><span>{i < 3 ? <Check size={14} /> : <Truck size={14} />}</span>{step}</li>)}
              </ol>
            </article>
            <article className={styles.card} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.scan.title}</h3><p>{c.desk.scan.body}</p></div>
              <div className={styles.scan} aria-hidden="true"><ScanLine size={30} /><div className={styles.barcode} /><span><b>37 / 37</b> {c.desk.scan.done}</span></div>
            </article>
            <article className={`${styles.card} ${styles.full}`} data-reveal>
              <div className={styles.cardText}><h3>{c.desk.rule.title}</h3><p>{c.desk.rule.body}</p></div>
              <div className={styles.rule} aria-hidden="true">
                <p><b>{c.desk.rule.when}</b>{c.desk.rule.whenText}</p>
                <span className={styles.ruleArrow}><ArrowRight size={18} className={styles.flip} /></span>
                <p><b>{c.desk.rule.then}</b>{c.desk.rule.thenText}</p>
              </div>
            </article>
          </div>
        </section>

        <section id="ai" className={styles.ai}>
          <div className={styles.aiHead} data-reveal>
            <Orb />
            <h2>{c.ai.title}</h2><span className={styles.soon}>{c.ai.soon}</span>
          </div>
          <p className={styles.aiBody}>{c.ai.body}</p>
          <AskBar motion={motion} questions={c.ai.questions} label={c.ai.ask} />
          <div className={styles.aiGrid}>
            {c.ai.items.map(item => <article key={item.title} data-reveal><Sparkles size={20} /><h3>{item.title}</h3><p>{item.body}</p></article>)}
          </div>
        </section>

        <section className={styles.platforms} data-reveal>
          <div><h2>{c.platforms.title}</h2><p>{c.platforms.body}</p></div>
          <ul>{PLATFORMS.map(p => <li key={p.id}><img src={`/platforms/${p.file}.svg`} alt={p.name} /></li>)}</ul>
        </section>

        <section className={styles.pocket}>
          <div data-reveal><h2>{c.pocket.title}</h2><p>{c.pocket.body}</p></div>
          <div className={styles.phone} aria-hidden="true" data-reveal>
            <div className={styles.phoneScreen}>
              <div className={styles.phoneHub}><span>128</span></div>
              <div className={styles.phoneCard}><b>37</b><span>{c.pocket.waiting}</span></div>
              <div className={styles.phoneButton}><Package size={16} />{c.pocket.start}</div>
            </div>
          </div>
        </section>

        <section className={styles.closing}>
          <h2 data-reveal>{c.closing.title}<br /><em>{c.closing.accent}</em></h2>
          <Link href="/register" className={styles.beat}><span>{c.closing.cta}</span><ArrowRight size={26} className={styles.flip} /></Link>
          <p>{c.closing.note}</p>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo variant="dark" /><p>{c.footer.rights} {c.footer.sample}</p>
        <Link href="/privacy">{ar ? 'الخصوصية' : 'Privacy'}</Link><Link href="/terms">{ar ? 'الشروط' : 'Terms'}</Link>
        <a href="#main">{c.footer.top}<ArrowUp size={15} /></a>
      </footer>
    </div>
  );
}

type HeroCopy = (typeof hubCopy)['en']['hero'];

/**
 * The hero is the product's first screen, and it works: tap a marketplace to
 * connect it, and its line draws in, its orders start flowing and the count in
 * the middle rises. Positions are written straight to the DOM each frame.
 */
function HeroHub({ motion, c }: { motion: boolean; c: HeroCopy }) {
  const stage = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<string[]>(() => PLATFORMS.filter(p => p.on).map(p => p.id));
  const live = useRef(on);
  live.current = on;
  const total = NODES.filter(n => on.includes(n.id)).reduce((sum, n) => sum + n.orders, 0);

  useEffect(() => {
    const el = stage.current;
    if (!el || !motion) return;
    let raf = 0;
    let shown = 0;
    const started = performance.now();
    const cards = el.querySelectorAll<HTMLElement>('[data-card]');
    const lines = el.querySelectorAll<SVGPathElement>('[data-line]');
    const count = el.querySelector<HTMLElement>('[data-count]');
    const tick = (now: number) => {
      const t = now / 1000;
      const scale = el.clientWidth / W;
      let target = 0;
      NODES.forEach((n, i) => {
        const active = live.current.includes(n.id);
        const dx = Math.sin(t * 0.45 + n.phase * 2) * 2;
        const dy = Math.sin(t * 0.9 + n.phase) * 7;
        const { mx, my, d } = curve(n.x + dx, n.y + dy);
        cards[i].style.transform = `translate(${(dx * scale).toFixed(2)}px, ${(dy * scale).toFixed(2)}px)`;
        lines[i].setAttribute('d', d);
        if (active) target += n.orders;
        const dur = 5 - n.weight * 2.8;
        el.querySelectorAll<SVGCircleElement>(`[data-pulse="${i}"]`).forEach((dot, k) => {
          const u = (t / dur + k * 0.5 + n.phase) % 1;
          const v = 1 - u;
          dot.setAttribute('cx', (v * v * (n.x + dx) + 2 * v * u * mx + u * u * CX).toFixed(1));
          dot.setAttribute('cy', (v * v * (n.y + dy) + 2 * v * u * my + u * u * CY).toFixed(1));
          dot.setAttribute('opacity', active ? '1' : '0');
        });
      });
      // Orders keep arriving while you watch: about one every four seconds.
      target += Math.floor((now - started) / 4000);
      shown += (target - shown) * 0.08;
      if (count) count.textContent = String(Math.round(shown));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  return (
    <div className={styles.hubWrap}>
      <div ref={stage} className={styles.hub} role="group" aria-label={c.aria}>
        <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <circle cx={CX} cy={CY} r={178} fill="none" stroke="#4FD34A" strokeOpacity={0.14} strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={300} fill="none" stroke="#4FD34A" strokeOpacity={0.1} strokeWidth={1.5} strokeDasharray="3 9" />
          <g fill="none" strokeLinecap="round">
            {NODES.map(n => {
              const active = on.includes(n.id);
              return <path key={n.id} data-line d={curve(n.x, n.y).d} stroke={active ? '#4FD34A' : '#28635E'} strokeOpacity={active ? 0.6 : 0.5} strokeWidth={active ? 2.5 + n.weight * 7.5 : 1.5} strokeDasharray={active ? undefined : '4 8'} />;
            })}
          </g>
          <g fill="#C7FF46">
            {NODES.map((n, i) => (n.weight > 0.5 ? [0, 1] : [0]).map(k => <circle key={`${n.id}-${k}`} data-pulse={i} r={3.5 + n.weight * 1.5} opacity={0} />))}
          </g>
          <circle cx={CX} cy={CY} r={132} fill="#4FD34A" fillOpacity={0.16} className={styles.halo} />
          <circle cx={CX} cy={CY} r={106} fill="#4FD34A" />
        </svg>
        <div className={styles.centre} aria-live="off"><b data-count>{total}</b><span>{c.centre}</span></div>
        {NODES.map(n => {
          const active = on.includes(n.id);
          return (
            <div key={n.id} data-card className={styles.node} style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%` }}>
              <button type="button" aria-pressed={active} data-on={active ? '' : undefined}
                onClick={() => setOn(list => (list.includes(n.id) ? list.filter(id => id !== n.id) : [...list, n.id]))}>
                <span className={styles.mark}><img src={`/platforms/${n.file}.svg`} alt="" /></span>
                <span className={styles.nodeText}><b>{n.name}</b><i>{active ? c.connected : c.connect}</i></span>
              </button>
            </div>
          );
        })}
      </div>
      <p className={styles.hint}>{c.hint}</p>
    </div>
  );
}

type JourneyCopy = (typeof hubCopy)['en']['journey'];

function Journey({ motion, c }: { motion: boolean; c: JourneyCopy }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => setStep(s => (s + 1) % c.steps.length), 2400);
    return () => clearInterval(timer);
  }, [motion, c.steps.length]);
  return (
    <section id="journey" className={styles.journey}>
      <p className={styles.eyebrow}>{c.label}</p>
      <h2 data-reveal>{c.title}<br /><em>{c.accent}</em></h2>
      <ol className={styles.steps} style={{ ['--progress' as string]: step / (c.steps.length - 1) }}>
        {c.steps.map((item, i) => (
          <li key={item.title} data-state={!motion || i <= step ? 'done' : 'next'} data-now={motion && i === step ? '' : undefined}>
            <span className={styles.stepDot} />
            <h3>{item.title}</h3><p>{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StockSync({ motion, product, unit }: { motion: boolean; product: string; unit: string }) {
  const [stock, setStock] = useState(24);
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => setStock(s => (s <= 12 ? 24 : s - 1)), 2600);
    return () => clearInterval(timer);
  }, [motion]);
  return (
    <div className={styles.fragment} aria-hidden="true">
      <span className={styles.metricLabel}>{product}</span>
      <div className={styles.sync} dir="ltr">
        {['marks/salla', 'marks/shopify', 'marks/noon'].map((file, i) => (
          <span key={file}><span className={styles.mark}><img src={`/platforms/${file}.svg`} alt="" /></span><b key={stock} style={{ animationDelay: `${i * 180}ms` }}>{stock}</b></span>
        ))}
      </div>
      <span className={styles.metricNote}>{unit}</span>
    </div>
  );
}

function AskBar({ motion, questions, label }: { motion: boolean; questions: string[]; label: string }) {
  const [text, setText] = useState(questions[0]);
  useEffect(() => {
    if (!motion) return;
    let question = 0;
    let length = 0;
    let timer: ReturnType<typeof setTimeout>;
    const type = () => {
      const full = questions[question];
      length += 1;
      setText(full.slice(0, length));
      if (length < full.length) timer = setTimeout(type, 42);
      else timer = setTimeout(() => { question = (question + 1) % questions.length; length = 0; type(); }, 2200);
    };
    type();
    return () => clearTimeout(timer);
  }, [motion, questions]);
  return (
    <div className={styles.ask} aria-hidden="true">
      <Sparkles size={20} /><span className={styles.askText}>{motion ? text : questions[0]}<i /></span><span className={styles.askButton}>{label}</span>
    </div>
  );
}

function Orb() {
  return (
    <svg className={styles.orb} viewBox="0 0 30 30" aria-hidden="true">
      <defs><linearGradient id="hubOrb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#4FD34A" /></linearGradient></defs>
      <circle cx="15" cy="15" r="13" fill="none" stroke="url(#hubOrb)" strokeWidth="2" strokeDasharray="14 8" strokeLinecap="round" className={styles.orbRing} />
      <circle cx="15" cy="15" r="7.5" fill="url(#hubOrb)" className={styles.orbCore} />
    </svg>
  );
}

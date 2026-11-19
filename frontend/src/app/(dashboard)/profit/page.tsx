'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Coins, ShieldCheck, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/Money';
import { PlatformLogo } from '@/components/ui/PlatformLogo';
import { getPlatform } from '@/lib/platforms';
import api from '@/lib/api';
import { useStores } from '@/components/providers/StoresProvider';
import ConnectPrompt from '@/components/ui/ConnectPrompt';
import { useI18n, useT } from '@/i18n';

type Coverage = {
  orders_total: number;
  orders_missing_cost: number;
  orders_estimated: number;
  cost_coverage_pct: number | null;
  skus_missing_cost: string[];
};

type Summary = {
  orders: number;
  gross_revenue: string;
  net_revenue: string;
  vat: string;
  cogs: string;
  fees: string;
  ad_spend: string;
  expenses: string;
  operating_profit: string;
  refund_cogs: string;
  lost_cogs: string;
  net_profit: string;
  margin_pct: number | null;
  coverage: Coverage;
};

type TimelinePoint = {
  date: string;
  orders: number;
  net_revenue: string;
  cogs: string;
  fees: string;
  net_profit: string;
};

type SkuRow = {
  sku: string | null;
  units: number;
  net_revenue: string;
  cogs: string;
  fees: string;
  net_profit: string;
  profit_per_unit: string | null;
  margin_pct: number | null;
  is_estimated: boolean;
};

type ChannelRow = {
  store_id: number;
  store_name: string;
  platform: string;
  orders: number;
  net_revenue: string;
  net_profit: string;
  margin_pct: number | null;
};

const RANGES = [7, 30, 90] as const;

/** Inclusive window ending today, matching what the API defaults to. */
function rangeParams(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start_date: iso(start), end_date: iso(end) };
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export default function ProfitPage() {
  const t = useT();
  const { stores, hasConnectedStore, loading: storesLoading } = useStores();

  const [days, setDays] = useState<number>(30);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const params = { ...rangeParams(days), store_id: storeId ?? undefined };
    try {
      const [s, tl, sk, ch] = await Promise.all([
        api.get('/analytics/profit', { params }),
        api.get('/analytics/profit/timeline', { params }),
        api.get('/analytics/profit/by-sku', { params }),
        api.get('/analytics/profit/by-channel', { params }),
      ]);
      setSummary(s.data);
      setTimeline(tl.data);
      setSkus(sk.data);
      setChannels(ch.data);
    } catch (err) {
      console.error('Failed to load profit report', err);
    } finally {
      setIsLoading(false);
    }
  }, [days, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(
    () =>
      timeline.map((d) => ({
        date: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        revenue: Number(d.net_revenue),
        profit: Number(d.net_profit),
      })),
    [timeline],
  );

  // The hero chart shows profit building up over the period, not day-by-day noise.
  const cumulative = useMemo(() => {
    let running = 0;
    return chartData.map((d) => {
      running += d.profit;
      return { date: d.date, profit: Math.round(running * 100) / 100 };
    });
  }, [chartData]);

  // A simple proportional read of where net revenue ended up. Costs are shown as a share of
  // revenue so the bar always adds to what came in — including the part that stayed.
  const breakdown = useMemo(() => {
    if (!summary) return [];
    const revenue = Number(summary.net_revenue);
    const rows = [
      { key: 'cogs', value: Number(summary.cogs), color: 'bg-[var(--chart-alt)]' },
      { key: 'fees', value: Number(summary.fees), color: 'bg-orange-400' },
      { key: 'adSpend', value: Number(summary.ad_spend), color: 'bg-purple-400' },
      { key: 'expenses', value: Number(summary.expenses), color: 'bg-rose-400' },
      { key: 'netProfit', value: Number(summary.net_profit), color: 'bg-secondary' },
    ];
    return rows
      .filter((r) => r.value !== 0)
      .map((r) => ({ ...r, share: revenue > 0 ? Math.max(0, r.value / revenue) : 0 }));
  }, [summary]);

  if (!storesLoading && !hasConnectedStore) {
    return (
      <div className="space-y-6">
        <Header t={t} />
        <ConnectPrompt description={t('profit.connectPrompt')} />
      </div>
    );
  }

  const profitValue = Number(summary?.net_profit ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Header t={t} />

        <div className="flex flex-wrap items-center gap-2">
          {stores.length > 1 && (
            <select
              value={storeId ?? ''}
              onChange={(e) => setStoreId(e.target.value ? Number(e.target.value) : null)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium"
            >
              <option value="">{t('profit.allStores')}</option>
              {stores.map((s: { id: number; name: string }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {RANGES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  d === days ? 'bg-accent font-bold text-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {t(`profit.ranges.d${d}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !summary || summary.orders === 0 ? (
        <Card className="p-16 text-center space-y-2">
          <p className="font-medium">{t('profit.empty')}</p>
          <p className="text-sm text-muted-foreground">{t('profit.emptyHint')}</p>
        </Card>
      ) : (
        <>
          <CoverageBanner coverage={summary.coverage} t={t} />

          <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_372px]">
            <section className="hb-rise rounded-[28px] border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{t('profit.kpis.netProfit')} · {t(`profit.ranges.d${days}`)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className={cn('text-[44px] font-black leading-[1.1] tracking-[-0.035em] tabular-nums', profitValue < 0 && 'text-negative')}>
                  <Money amount={summary.net_profit} />
                </span>
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold', profitValue >= 0 ? 'bg-action text-action-foreground' : 'bg-negative/15 text-negative')}>
                  {pct(summary.margin_pct)} {t('profit.kpis.margin')}
                </span>
                <span className="text-sm text-muted-foreground">{summary.orders} {t('profit.kpis.orders')}</span>
              </div>
              <div className="mt-4 h-[260px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulative}>
                    <defs>
                      <linearGradient id="pnlProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4FD34A" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#4FD34A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={56} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
                    <Area type="monotone" dataKey="profit" name={t('profit.timeline.profit')} stroke="#4FD34A" strokeWidth={3} fill="url(#pnlProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {breakdown.filter((r) => r.key !== 'netProfit').map((r) => (
                  <div key={r.key} className="rounded-2xl bg-muted/60 p-3">
                    <p className="truncate text-xs text-muted-foreground">{t(`profit.breakdown.${r.key}`)}</p>
                    <p className="mt-1 text-xl font-black tracking-[-0.02em] tabular-nums">{pct(r.share)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">− <Money amount={r.value} /></p>
                  </div>
                ))}
              </div>
            </section>

            <section className="hb-rise rounded-[28px] border border-border bg-card p-6" style={{ animationDelay: '80ms' }}>
              <h2 className="text-lg font-bold">{t('profit.byChannel.title')}</h2>
              {channels.length ? (
                <ul className="mt-4 space-y-4">
                  {channels.map((c) => {
                    const margin = c.margin_pct ?? 0;
                    return (
                      <li key={c.store_id} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_52px] items-center gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <PlatformLogo platform={c.platform} size={16} />
                          <span className="truncate font-bold">{c.store_name}</span>
                        </span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span className={cn('block h-full rounded-full', margin >= 0.15 ? 'bg-action' : 'bg-warning')} style={{ width: `${Math.max(0, Math.min(100, margin * 200))}%` }} />
                        </span>
                        <span className="text-end font-bold tabular-nums">{pct(c.margin_pct)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t('profit.empty')}</p>
              )}
              <div className="mt-6 space-y-3 border-t border-border pt-5">
                {breakdown.map((r) => (
                  <div key={r.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={cn('h-2.5 w-2.5 rounded-full', r.color)} />
                      {t(`profit.breakdown.${r.key}`)}
                    </span>
                    <span className="font-bold tabular-nums"><Money amount={r.value} /></span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="font-bold text-lg">{t('profit.bySku.title')}</h3>
              <p className="text-xs text-muted-foreground">{t('profit.bySku.subtitle')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-border text-xs font-bold text-muted-foreground">
                    <th className="px-5 py-3">{t('profit.bySku.colSku')}</th>
                    <th className="px-5 py-3 text-center">{t('profit.bySku.colUnits')}</th>
                    <th className="px-5 py-3">{t('profit.bySku.colRevenue')}</th>
                    <th className="px-5 py-3">{t('profit.bySku.colCogs')}</th>
                    <th className="px-5 py-3">{t('profit.bySku.colFees')}</th>
                    <th className="px-5 py-3">{t('profit.bySku.colProfit')}</th>
                    <th className="px-5 py-3">{t('profit.bySku.colPerUnit')}</th>
                    <th className="px-5 py-3 text-end">{t('profit.bySku.colMargin')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {skus.map((row) => {
                    const profit = Number(row.net_profit);
                    return (
                      <tr key={row.sku ?? 'unknown'} className="hover:bg-accent/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{row.sku ?? '—'}</span>
                            {row.is_estimated && (
                              <span
                                title={t('profit.bySku.estimatedHint')}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-caution/15 text-caution"
                              >
                                {t('profit.bySku.estimated')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-center text-sm tabular-nums">{row.units}</td>
                        <td className="px-5 py-3 text-sm tabular-nums"><Money amount={row.net_revenue} /></td>
                        <td className="px-5 py-3 text-sm tabular-nums text-muted-foreground"><Money amount={row.cogs} /></td>
                        <td className="px-5 py-3 text-sm tabular-nums text-muted-foreground"><Money amount={row.fees} /></td>
                        <td className={cn('px-5 py-3 text-sm font-bold tabular-nums', profit >= 0 ? 'text-secondary' : 'text-destructive')}>
                          <Money amount={row.net_profit} />
                        </td>
                        <td className="px-5 py-3 text-sm tabular-nums">
                          {row.profit_per_unit === null ? '—' : <Money amount={row.profit_per_unit} />}
                        </td>
                        <td className="px-5 py-3 text-sm text-end tabular-nums">{pct(row.margin_pct)}</td>
                      </tr>
                    );
                  })}
                  {skus.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground">
                        {t('profit.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {channels.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="font-bold text-lg">{t('profit.byChannel.title')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead>
                    <tr className="border-b border-border text-xs font-bold text-muted-foreground">
                      <th className="px-5 py-3">{t('profit.byChannel.colChannel')}</th>
                      <th className="px-5 py-3 text-center">{t('profit.byChannel.colOrders')}</th>
                      <th className="px-5 py-3">{t('profit.byChannel.colRevenue')}</th>
                      <th className="px-5 py-3">{t('profit.byChannel.colProfit')}</th>
                      <th className="px-5 py-3 text-end">{t('profit.byChannel.colMargin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {channels.map((row) => {
                      const profit = Number(row.net_profit);
                      return (
                        <tr key={row.store_id} className="hover:bg-accent/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-accent/50 border border-border/50 flex items-center">
                                <PlatformLogo platform={row.platform} size={16} />
                              </div>
                              <div>
                                <p className="text-sm font-medium leading-tight">{row.store_name}</p>
                                <p className="text-[11px] text-muted-foreground">{getPlatform(row.platform).name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center text-sm tabular-nums">{row.orders}</td>
                          <td className="px-5 py-3 text-sm tabular-nums"><Money amount={row.net_revenue} /></td>
                          <td className={cn('px-5 py-3 text-sm font-bold tabular-nums', profit >= 0 ? 'text-secondary' : 'text-destructive')}>
                            <Money amount={row.net_profit} />
                          </td>
                          <td className="px-5 py-3 text-sm text-end tabular-nums">{pct(row.margin_pct)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Header({ t }: { t: (key: string) => string }) {
  const { locale } = useI18n();
  return (
    <div>
      <p className="text-sm text-muted-foreground">{t('profit.subtitle')}</p>
      <h1 className="mt-1 text-[28px] leading-tight font-black tracking-[-0.025em]">
        {locale === 'ar' ? 'ما بقي لك فعلاً.' : 'What you actually kept.'}
      </h1>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'muted' | 'good' | 'bad';
  icon?: React.ComponentType<{ size?: number }>;
}) {
  const toneClass = {
    neutral: 'text-foreground',
    muted: 'text-muted-foreground',
    good: 'text-secondary',
    bad: 'text-destructive',
  }[tone];

  return (
    <Card className="p-5 space-y-1">
      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p>
      <div className={cn('flex items-center gap-2 text-xl font-bold', toneClass)}>
        {Icon && <Icon size={18} />}
        {value}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/**
 * The honest disclosure, deliberately placed above the numbers rather than buried under them.
 * A margin built on orders with no cost on file is a different claim from one built on complete
 * data, and the merchant is entitled to know which they are reading before they act on it.
 */
function CoverageBanner({
  coverage,
  t,
}: {
  coverage: Coverage;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const covered = coverage.cost_coverage_pct;
  const complete = covered !== null && covered >= 0.999;
  const none = covered !== null && covered <= 0.001;

  const message = complete
    ? t('profit.coverage.full')
    : none
      ? t('profit.coverage.none')
      : t('profit.coverage.partial', { covered: Math.round((covered ?? 0) * 100) });

  return (
    <Card
      className={cn(
        'p-4 flex flex-col sm:flex-row sm:items-start gap-3 border-l-4',
        complete ? 'border-l-secondary' : 'border-l-orange-400',
      )}
    >
      <div className={cn('mt-0.5 shrink-0', complete ? 'text-secondary' : 'text-caution')}>
        {complete ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
      </div>
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-semibold">{t('profit.coverage.title')}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        {coverage.orders_estimated > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('profit.coverage.estimated', { count: coverage.orders_estimated })}
          </p>
        )}
        {coverage.skus_missing_cost.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{t('profit.coverage.missingSkus')}</span>{' '}
            <span className="font-mono">{coverage.skus_missing_cost.join(', ')}</span>
          </p>
        )}
      </div>
      {!complete && (
        <Link
          href="/products"
          className="shrink-0 self-start px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent transition-colors"
        >
          {t('profit.coverage.addCosts')}
        </Link>
      )}
    </Card>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { Truck, Search, ChevronRight, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useI18n } from '@/i18n';
import { shipmentStatusColor } from '@/components/shipping/statusColor';

type Shipment = {
  id: number;
  reference: string;
  status: string;
  carrier_code: string | null;
  tracking_number: string | null;
  items_count: number;
  created_at: string;
};

// The five stages a parcel moves through, in order; each is a counter and a filter.
const STAGES = ['label_purchased', 'awaiting_pickup', 'in_transit', 'out_for_delivery', 'delivered'];
const FILTERS = ['', 'draft', 'label_purchased', 'in_transit', 'out_for_delivery', 'delivered', 'returned_to_origin', 'cancelled'];

export default function ShipmentsPage() {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const router = useRouter();
  const [rows, setRows] = useState<Shipment[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // One small request per stage: the list endpoint already returns the total for a status.
  useEffect(() => {
    let live = true;
    Promise.all(STAGES.map((stage) => api.get('/shipments', { params: { status: stage } }).then((r) => [stage, Number(r.data?.total ?? 0)] as const).catch(() => [stage, 0] as const)))
      .then((pairs) => { if (live) setCounts(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shipments', { params: { status: status || undefined, search: search || undefined } });
      setRows(res.data.data ?? []);
    } catch (err) {
      console.error('Failed to load shipments', err);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const moving = STAGES.slice(0, 4).reduce((sum, stage) => sum + (counts[stage] ?? 0), 0);
  const everything = moving + (counts.delivered ?? 0);
  const carriers = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const key = r.carrier_code || '—';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((x, y) => y[1] - x[1]);
  const busiest = carriers[0]?.[1] ?? 1;

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(locale === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{l(`${moving} in motion`, `${moving} في الطريق`)}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-black tracking-[-0.025em]">
            {l('Out the door, all the way home.', 'من الباب إلى باب العميل.')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/shipments/manifests" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition-colors hover:bg-accent">
            <Truck size={16} /> {t('shipping.manifestsTitle')}
          </Link>
          <Link href="/shipments/carriers" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold transition-colors hover:bg-accent">
            <Settings2 size={16} /> {t('shipping.accountsTitle')}
          </Link>
        </div>
      </div>

      <section className="hb-rise rounded-[28px] border border-border bg-card p-5 md:px-7 md:py-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <button
              key={stage}
              onClick={() => setStatus(status === stage ? '' : stage)}
              aria-pressed={status === stage}
              className={cn('rounded-2xl p-2 text-start transition-colors hover:bg-accent', status === stage && 'bg-accent')}
            >
              <span className={cn(
                'block text-[40px] font-black leading-none tracking-[-0.04em] tabular-nums',
                stage === 'delivered' ? 'text-positive' : stage === 'awaiting_pickup' && (counts[stage] ?? 0) > 0 ? 'text-caution' : 'text-foreground',
              )}>
                {counts[stage] ?? '—'}
              </span>
              <span className="mt-2 block text-sm font-bold">{t(`shipping.statuses.${stage}`)}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-action transition-[width] duration-700" style={{ width: everything > 0 ? `${Math.round(((counts.delivered ?? 0) / everything) * 100)}%` : '0%' }} />
        </div>
      </section>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input placeholder={t('shipping.searchPlaceholder')} className="ps-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            aria-label={t('shipping.colStatus')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-[42px] rounded-xl border border-border bg-card px-3 text-sm"
          >
            {FILTERS.map((f) => <option key={f || 'all'} value={f}>{f === '' ? t('shipping.all') : t(`shipping.statuses.${f}`)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="font-medium">{t('shipping.empty')}</p>
              <p className="text-sm text-muted-foreground">{t('shipping.emptyHint')}</p>
              <Link
                href="/shipments/carriers"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-action text-action-foreground hover:opacity-90 transition-opacity"
              >
                <Settings2 size={16} /> {t('shipping.setupCarriers')}
              </Link>
            </div>
          ) : (
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted-foreground">
                  <th className="px-5 py-3">{t('shipping.colRef')}</th>
                  <th className="px-5 py-3">{t('shipping.colCarrier')}</th>
                  <th className="px-5 py-3">{t('shipping.colTracking')}</th>
                  <th className="px-5 py-3 text-center">{t('shipping.colItems')}</th>
                  <th className="px-5 py-3">{t('shipping.colStatus')}</th>
                  <th className="px-5 py-3">{t('shipping.colCreated')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/30 transition-colors cursor-pointer group" onClick={() => router.push(`/shipments/${r.id}`)}>
                    <td className="px-5 py-3 font-medium font-mono text-xs">{r.reference}</td>
                    <td className="px-5 py-3 capitalize">{r.carrier_code || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs">{r.tracking_number || '—'}</td>
                    <td className="px-5 py-3 text-center tabular-nums">{r.items_count}</td>
                    <td className="px-5 py-3">
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', shipmentStatusColor(r.status))}>
                        {t(`shipping.statuses.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-end">
                      <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      <section className="hb-rise rounded-[28px] border border-border bg-card p-6" style={{ animationDelay: '80ms' }}>
        <h2 className="text-lg font-bold">{l('By carrier', 'حسب شركة الشحن')}</h2>
        {carriers.length ? (
          <ul className="mt-4 space-y-4">
            {carriers.map(([name, n]) => (
              <li key={name} className="grid grid-cols-[88px_minmax(0,1fr)_28px] items-center gap-3 text-sm">
                <span className="truncate font-bold capitalize">{name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-action" style={{ width: `${Math.round((n / busiest) * 100)}%` }} /></span>
                <span className="text-end font-bold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{l('Carriers appear here once shipments are booked.', 'تظهر شركات الشحن هنا بعد حجز أول شحنة.')}</p>
        )}
        <p className="mt-5 text-xs text-muted-foreground">{l('Counted from the shipments listed here.', 'محسوبة من الشحنات المعروضة هنا.')}</p>
      </section>
      </div>
    </div>
  );
}

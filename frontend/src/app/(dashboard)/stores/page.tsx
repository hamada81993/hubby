'use client';

import React, { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import {
  RefreshCw,
  Trash2,
  Crown,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { PLATFORMS, getPlatform, type PlatformId } from '@/lib/platforms';
import { PlatformLogo } from '@/components/ui/PlatformLogo';
import ConnectStoreModal from '@/components/stores/ConnectStoreModal';
import { useStores } from '@/components/providers/StoresProvider';
import { useI18n } from '@/i18n';
import ChannelBuffers from '@/components/operations/ChannelBuffers';

/** Visual treatment for each real store status the backend reports. Labels are
 *  looked up at render time via `t('stores.status.<status>')`. */
const STATUS_META: Record<string, { dot: string; text: string }> = {
  connected: { dot: 'bg-secondary animate-pulse', text: 'text-secondary' },
  syncing: { dot: 'bg-warning animate-pulse', text: 'text-warning' },
  error: { dot: 'bg-destructive', text: 'text-destructive' },
  disconnected: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
};

const timeAgo = (t: (key: string) => string, iso?: string | null) => {
  if (!iso) return t('stores.time.never');
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return t('stores.time.justNow');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('stores.time.minutesAgo').replace('{n}', String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('stores.time.hoursAgo').replace('{n}', String(hrs));
  return t('stores.time.daysAgo').replace('{n}', String(Math.floor(hrs / 24)));
};

export default function StoresPage() {
  // Stores come from the shared provider so connect/disconnect updates the whole
  // dashboard (Orders filter, connect banner, etc.) at once — not just this page.
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { stores, loading: isLoading, refresh } = useStores();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [connectPlatform, setConnectPlatform] = useState<PlatformId | null>(null);
  const [oauthEnabled, setOauthEnabled] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState<{ store_id: number; orders: number; net_revenue: string }[] | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    // Re-sync on landing here in case stores changed elsewhere.
    refresh();
    // Which platforms offer one-click OAuth (operator has configured app keys).
    api.get('/stores/connect-options')
      .then((res) => setOauthEnabled(res.data?.oauth_enabled || {}))
      .catch(() => setOauthEnabled({}));
    // Each store's last 30 days; finance reports can be restricted by role, so the cards work without them.
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    api.get('/analytics/profit/by-channel', { params: { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) } })
      .then((res) => setChannels(Array.isArray(res.data) ? res.data : null))
      .catch(() => setChannels(null));
  }, [refresh]);

  const toggleMaster = async (id: number) => {
    try {
      await api.post(`/stores/${id}/set-master`);
      refresh();
    } catch (err) {
      console.error('Failed to set master store', err);
    }
  };

  const syncStore = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/stores/${id}/sync`);
      await refresh();
      // Sync runs in the background; re-poll shortly to reflect the result.
      setTimeout(refresh, 5000);
    } catch (err) {
      console.error('Failed to sync store', err);
    } finally {
      setBusyId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      await api.post('/stores/sync-all');
      setTimeout(refresh, 5000);
    } catch (err) {
      console.error('Failed to sync stores', err);
    } finally {
      setSyncingAll(false);
    }
  };

  const deleteStore = async (id: number) => {
    if (!window.confirm(t('stores.confirmDisconnect'))) return;
    try {
      await api.delete(`/stores/${id}`);
      refresh();
    } catch (err) {
      console.error('Failed to delete store', err);
    }
  };

  // Network-level summary so the page reads as an operations console, not just a list.
  const summary = {
    total: stores.length,
    connected: stores.filter((s) => s.status === 'connected').length,
    syncing: stores.filter((s) => s.status === 'syncing').length,
    error: stores.filter((s) => s.status === 'error').length,
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{t('stores.loading')}</div>;
  }

  const needsYou = stores.filter((s) => s.status === 'error' || s.status === 'disconnected').length;
  const totalRevenue = (channels ?? []).reduce((sum, c) => sum + Number(c.net_revenue), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {l(`${summary.total} connected · ${summary.connected} live · ${needsYou} need you`, `${summary.total} متصلة · ${summary.connected} مباشرة · ${needsYou} تحتاج تدخلك`)}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-black tracking-[-0.025em]">
            {l('Every door you sell through.', 'كل باب تبيع منه.')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={syncAll} disabled={syncingAll || !stores.length}>
            <RefreshCw size={16} className={cn('me-2', syncingAll && 'animate-spin')} />
            {l('Sync now', 'مزامنة الآن')}
          </Button>
          <Button variant="primary" size="md" onClick={() => setConnectPlatform(PLATFORMS[0].id)}>
            <Plus size={16} className="me-2" />
            {t('stores.connect')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[18px]">
        {stores.map((store) => {
          const status = store.status || 'disconnected';
          const meta = STATUS_META[status] || STATUS_META.disconnected;
          const reconnectable = status === 'disconnected' || status === 'error';
          const channel = channels?.find((c) => c.store_id === store.id);
          const share = channel && totalRevenue > 0 ? Math.round((Number(channel.net_revenue) / totalRevenue) * 100) : null;

          return (
            <section
              key={store.id}
              className={cn(
                'hb-rise flex min-h-[230px] flex-col gap-5 rounded-[28px] border bg-card p-6',
                reconnectable ? 'border-negative' : 'border-border',
              )}
            >
              <div className="flex items-center gap-4">
                <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl bg-white px-2">
                  <PlatformLogo platform={store.platform} size={30} className="!bg-transparent !p-0" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-black tracking-[-0.02em]">{store.name}</h2>
                    <span className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      reconnectable ? 'bg-negative/15 text-negative' : store.is_master ? 'bg-action text-action-foreground' : 'bg-positive/15 text-positive',
                    )}>
                      {reconnectable ? l('Needs you', 'يحتاج تدخلك') : store.is_master ? l('Master', 'الرئيسي') : l('Live', 'مباشر')}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{store.domain || getPlatform(store.platform).name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: channel ? String(channel.orders) : '—', label: l('orders, 30 days', 'طلب، 30 يوماً') },
                  { value: channel ? Math.round(Number(channel.net_revenue)).toLocaleString('en-US') : '—', label: l('net revenue', 'صافي الإيرادات') },
                  { value: share === null ? '—' : `${share}%`, label: l('of revenue', 'من الإيرادات') },
                ].map((stat) => (
                  <div key={stat.label} className="min-w-0">
                    <p className="truncate text-[26px] font-black leading-none tracking-[-0.03em] tabular-nums">{stat.value}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex items-center gap-2 text-xs">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
                <span className={cn('min-w-0 flex-1 truncate', reconnectable ? 'text-negative' : 'text-muted-foreground')}>
                  {status === 'error'
                    ? t('stores.card.syncError')
                    : `${t('stores.card.lastSynced')} ${timeAgo(t, store.last_synced_at)}`}
                </span>
                {reconnectable ? (
                  <button className="font-bold text-primary hover:underline" onClick={() => setConnectPlatform(store.platform as PlatformId)}>
                    {t('stores.card.reconnect')}
                  </button>
                ) : (
                  <>
                    {!store.is_master && (
                      <button className="font-bold text-primary hover:underline" onClick={() => toggleMaster(store.id)}>
                        {t('stores.card.setMaster')}
                      </button>
                    )}
                    <button
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      title={t('stores.card.syncNow')}
                      aria-label={t('stores.card.syncNow')}
                      onClick={() => syncStore(store.id)}
                    >
                      <RefreshCw size={15} className={cn(busyId === store.id && 'animate-spin')} />
                    </button>
                  </>
                )}
                <button
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title={t('stores.card.disconnect')}
                  aria-label={t('stores.card.disconnect')}
                  onClick={() => deleteStore(store.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </section>
          );
        })}

        <section className="flex min-h-[230px] flex-col gap-4 rounded-[28px] border-2 border-dashed border-border p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-action text-action-foreground">
            <Plus size={24} strokeWidth={2.5} />
          </span>
          <div>
            <h2 className="text-xl font-black tracking-[-0.02em]">{l('Add another store', 'أضف متجراً آخر')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{l('Pick a platform. It connects in about a minute and joins the hub straight away.', 'اختر منصة. تتصل خلال دقيقة وتنضم للمركز مباشرة.')}</p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setConnectPlatform(p.id)}
                title={`${t('stores.add')} ${p.name}`}
                aria-label={`${t('stores.add')} ${p.name}`}
                className="flex h-11 items-center justify-center rounded-xl bg-white px-2.5 transition-transform hover:scale-105"
              >
                <PlatformLogo platform={p.id} size={22} className="!bg-transparent !p-0" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Crown size={14} className="mt-0.5 shrink-0 text-primary" />
        <span><b className="text-foreground">{t('stores.master.title')}.</b> {t('stores.master.description')}</span>
      </p>

      <ChannelBuffers />

      <ConnectStoreModal
        platformId={connectPlatform}
        oauthEnabled={connectPlatform ? !!oauthEnabled[connectPlatform] : false}
        onClose={() => setConnectPlatform(null)}
        onConnected={refresh}
      />
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Boxes, Check, Crown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import ConnectStoreModal from '@/components/stores/ConnectStoreModal';
import { useStores } from '@/components/providers/StoresProvider';
import { useI18n } from '@/i18n';

/** Not built yet: shown as coming soon, with a request button that records the demand. */
const COMING: { group: 'accounting' | 'ads'; key: string; name: string; note: [string, string] }[] = [
  { group: 'accounting', key: 'zoho_books', name: 'Zoho Books', note: ['Invoices and stock with Zoho Books', 'الفواتير والمخزون مع Zoho Books'] },
  { group: 'accounting', key: 'qoyod', name: 'Qoyod · قيود', note: ['Invoices and journals with Qoyod', 'الفواتير والقيود مع قيود'] },
  { group: 'accounting', key: 'daftra', name: 'Daftra · دفترة', note: ['Products, invoices and stock with Daftra', 'المنتجات والفواتير والمخزون مع دفترة'] },
  { group: 'accounting', key: 'wafeq', name: 'Wafeq · وافق', note: ['Invoices and accounts with Wafeq', 'الفواتير والحسابات مع وافق'] },
  { group: 'ads', key: 'meta_ads', name: 'Meta Ads', note: ['Facebook and Instagram spend, every day', 'مصروف فيسبوك وإنستجرام يومياً'] },
  { group: 'ads', key: 'google_ads', name: 'Google Ads', note: ['Search and Shopping spend, every day', 'مصروف البحث والتسوق يومياً'] },
  { group: 'ads', key: 'tiktok_ads', name: 'TikTok Ads', note: ['TikTok spend, every day', 'مصروف تيك توك يومياً'] },
  { group: 'ads', key: 'snapchat_ads', name: 'Snapchat Ads', note: ['Snapchat spend, every day', 'مصروف سناب شات يومياً'] },
];

export default function IntegrationsPage() {
  const { t, locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const { stores, refresh } = useStores();
  const odoo = stores.filter((s) => s.platform === 'odoo');
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [requested, setRequested] = useState<string[]>([]);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    api.get('/integration-requests')
      .then((res) => setRequested(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRequested([]));
  }, [refresh]);

  const request = async (key: string) => {
    setAsking(key);
    try {
      await api.post('/integration-requests', { integration: key });
      setRequested((list) => (list.includes(key) ? list : [...list, key]));
    } catch (err) {
      console.error('Failed to request integration', err);
    } finally {
      setAsking(null);
    }
  };

  const sync = async (id: number) => {
    setBusy(id);
    try {
      await api.post(`/stores/${id}/sync`);
      setTimeout(refresh, 5000);
    } catch (err) {
      console.error('Failed to sync', err);
    } finally {
      setBusy(null);
    }
  };

  const setMaster = async (id: number) => {
    try {
      await api.post(`/stores/${id}/set-master`);
      refresh();
    } catch (err) {
      console.error('Failed to set master', err);
    }
  };

  const disconnect = async (id: number) => {
    if (!window.confirm(t('stores.confirmDisconnect'))) return;
    try {
      await api.delete(`/stores/${id}`);
      refresh();
    } catch (err) {
      console.error('Failed to disconnect', err);
    }
  };

  const group = (id: 'accounting' | 'ads') => COMING.filter((c) => c.group === id);

  const comingCard = (item: (typeof COMING)[number]) => {
    const done = requested.includes(item.key);
    return (
      <section key={item.key} className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{item.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.note[locale === 'ar' ? 1 : 0]}</p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{l('Coming soon', 'قريباً')}</span>
        </div>
        <button
          onClick={() => request(item.key)}
          disabled={done || asking === item.key}
          className={cn(
            'mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors',
            done ? 'border-transparent bg-positive/15 text-positive' : 'border-border hover:bg-accent',
          )}
        >
          {done ? <Check size={16} /> : null}
          {done ? l('Requested. We will tell you when it is ready.', 'تم الطلب. سنبلغك عند جاهزيته.') : l('Request this', 'اطلب هذا التكامل')}
        </button>
      </section>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          {l(`${odoo.length} connected · ${requested.length} requested`, `${odoo.length} متصل · ${requested.length} مطلوب`)}
        </p>
        <h1 className="mt-1 text-[28px] leading-tight font-black tracking-[-0.025em]">
          {l('Everything around your stores.', 'كل ما حول متاجرك.')}
        </h1>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold">{l('Accounting and ERP', 'المحاسبة وتخطيط الموارد')}</h2>

        <section className="rounded-[28px] border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#A24689]">
              <Boxes size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-[-0.02em]">Odoo</h3>
                <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[11px] font-bold text-positive">{l('Available', 'متاح')}</span>
              </div>
              <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">
                {l(
                  'Bring your products, variants, prices and stock from Odoo. Make it the master store and its stock becomes the number every sales channel follows. Hubby only reads; nothing in Odoo is changed.',
                  'اجلب منتجاتك ومتغيراتها وأسعارها ومخزونها من أودو. اجعله المتجر الرئيسي فيصبح مخزونه الرقم الذي تتبعه كل قنوات البيع. هَبّي يقرأ فقط ولا يغيّر شيئاً في أودو.',
                )}
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => setConnecting(true)}>
              <Plus size={16} className="me-2" />
              {l('Connect Odoo', 'اربط أودو')}
            </Button>
          </div>

          {odoo.length > 0 && (
            <ul className="mt-5 divide-y divide-border border-t border-border">
              {odoo.map((store) => {
                const failed = store.status === 'error' || store.status === 'disconnected';
                return (
                  <li key={store.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', failed ? 'bg-destructive' : store.status === 'syncing' ? 'bg-warning' : 'bg-secondary')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{store.name}</span>
                      <span className={cn('block truncate text-xs', failed ? 'text-negative' : 'text-muted-foreground')}>
                        {failed
                          ? l('Could not read from Odoo. Check the address, the key and the login, then connect again.', 'تعذرت القراءة من أودو. راجع العنوان والمفتاح والبريد ثم أعد الربط.')
                          : store.status === 'syncing'
                            ? l('Reading your products…', 'جارٍ قراءة منتجاتك…')
                            : store.domain}
                      </span>
                    </span>
                    {store.is_master ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-action px-2.5 py-1 text-[11px] font-bold text-action-foreground">
                        <Crown size={12} /> {l('Master', 'الرئيسي')}
                      </span>
                    ) : (
                      !failed && (
                        <button className="font-bold text-primary hover:underline" onClick={() => setMaster(store.id)}>
                          {t('stores.card.setMaster')}
                        </button>
                      )
                    )}
                    <button
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={t('stores.card.syncNow')}
                      title={t('stores.card.syncNow')}
                      onClick={() => sync(store.id)}
                    >
                      <RefreshCw size={15} className={cn(busy === store.id && 'animate-spin')} />
                    </button>
                    <button
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={t('stores.card.disconnect')}
                      title={t('stores.card.disconnect')}
                      onClick={() => disconnect(store.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{group('accounting').map(comingCard)}</div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">{l('Advertising', 'الإعلانات')}</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
            {l(
              'Today you type your ad spend into the profit report by hand. Connected, each platform sends its daily spend on its own, so profit is right every morning.',
              'اليوم تُدخل مصروف الإعلانات في تقرير الأرباح يدوياً. بعد الربط ترسل كل منصة مصروفها اليومي تلقائياً، فيكون الربح صحيحاً كل صباح.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{group('ads').map(comingCard)}</div>
      </div>

      <ConnectStoreModal
        platformId={connecting ? 'odoo' : null}
        oauthEnabled={false}
        onClose={() => setConnecting(false)}
        onConnected={refresh}
      />
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import api from '@/lib/api';
import { MARKETS, NEEDS_MARKET } from '@/lib/markets';
import { useI18n } from '@/i18n';

interface Setup {
  market: string | null;
  channel_warehouse: string | null;
  warehouse_ids: number[];
  price_list_id: number | null;
  options: {
    channel_warehouses: { code: string; name: string }[];
    channel_warehouses_error: string | null;
    warehouses: { id: number; name: string; code: string }[];
    price_lists: { id: number; name: string; currency: string | null }[];
  };
}

const field = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm';

/**
 * How one store is wired: the country it sells in, the channel warehouse it stocks, the
 * warehouses whose stock it sells and the price list it sells from. Everything is optional:
 * left alone, a store sells the whole stock at the product's own price.
 */
export default function StoreSetupModal({ store, onClose }: { store: { id: number; name: string; platform: string } | null; onClose: () => void }) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSetup(null);
    setError('');
    if (!store) return;
    api.get(`/stores/${store.id}/setup`)
      .then((res) => setSetup(res.data))
      .catch(() => setError(l('Could not load this store’s setup.', 'تعذر تحميل إعداد هذا المتجر.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  if (!store) return null;

  const save = async () => {
    if (!setup) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/stores/${store.id}/setup`, {
        market: setup.market,
        channel_warehouse: setup.channel_warehouse,
        warehouse_ids: setup.warehouse_ids,
        price_list_id: setup.price_list_id,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.status === 403
        ? l('Only the owner or an admin can change this.', 'هذا الإعداد للمالك أو المدير فقط.')
        : err.response?.data?.message || l('Could not save.', 'تعذر الحفظ.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleWarehouse = (id: number) => setSetup((s) => s && ({
    ...s,
    warehouse_ids: s.warehouse_ids.includes(id) ? s.warehouse_ids.filter((w) => w !== id) : [...s.warehouse_ids, id],
  }));

  return (
    <Modal isOpen onClose={onClose} title={l(`Set up ${store.name}`, `إعداد ${store.name}`)} size="lg">
      {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {!setup ? (
        !error && <p className="py-8 text-center text-sm text-muted-foreground">{l('Loading…', 'جارٍ التحميل…')}</p>
      ) : (
        <div className="space-y-6">
          {NEEDS_MARKET.has(store.platform) && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">{l('Country this store sells in', 'الدولة التي يبيع فيها المتجر')}</span>
              <select className={field} value={setup.market ?? ''} onChange={(e) => setSetup({ ...setup, market: e.target.value || null })}>
                <option value="">{l('Choose a country', 'اختر الدولة')}</option>
                {MARKETS.map((m) => <option key={m.code} value={m.code}>{l(m.en, m.ar)}</option>)}
              </select>
            </label>
          )}

          {store.platform === 'noon' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">{l('noon warehouse this store stocks', 'مخزن noon الذي يُرسل إليه المخزون')}</span>
              <select className={field} value={setup.channel_warehouse ?? ''} onChange={(e) => setSetup({ ...setup, channel_warehouse: e.target.value || null })}>
                <option value="">{l('First active warehouse', 'أول مخزن نشط')}</option>
                {setup.channel_warehouse && !setup.options.channel_warehouses.some((w) => w.code === setup.channel_warehouse) && (
                  <option value={setup.channel_warehouse}>{setup.channel_warehouse}</option>
                )}
                {setup.options.channel_warehouses.map((w) => <option key={w.code} value={w.code}>{w.name} · {w.code}</option>)}
              </select>
              {setup.options.channel_warehouses_error && (
                <span className="mt-1.5 block text-xs text-negative">{l('noon did not return your warehouses: ', 'لم يُرجع noon مخازنك: ')}{setup.options.channel_warehouses_error}</span>
              )}
            </label>
          )}

          <div>
            <p className="text-sm font-bold">{l('Warehouses this store sells from', 'المخازن التي يبيع منها المتجر')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {l('Tick none and the store sells your whole stock. Tick some and it is offered only what is in them.', 'بدون اختيار يبيع المتجر كل مخزونك. عند الاختيار يُعرض عليه ما في هذه المخازن فقط.')}
            </p>
            {setup.options.warehouses.length === 0 ? (
              <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                {l('No warehouses yet. They arrive from Odoo with the next sync, or add them under Warehouse.', 'لا توجد مخازن بعد. تصل من أودو مع المزامنة القادمة، أو أضفها من صفحة المخازن.')}
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {setup.options.warehouses.map((w) => (
                  <label key={w.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--action)]" checked={setup.warehouse_ids.includes(w.id)} onChange={() => toggleWarehouse(w.id)} />
                    <span className="min-w-0 flex-1 truncate font-bold">{w.name}</span>
                    <span className="text-xs text-muted-foreground">{w.code}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">{l('Price list', 'قائمة الأسعار')}</span>
            <select className={field} value={setup.price_list_id ?? ''} onChange={(e) => setSetup({ ...setup, price_list_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{l('One price: the product’s own', 'سعر واحد: سعر المنتج نفسه')}</option>
              {setup.options.price_lists.map((p) => <option key={p.id} value={p.id}>{p.name}{p.currency ? ` · ${p.currency}` : ''}</option>)}
            </select>
            <span className="mt-1.5 block text-xs text-muted-foreground">
              {l('Products the list does not mention keep their own price.', 'المنتجات غير المذكورة في القائمة تبقى بسعرها.')}
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>{l('Cancel', 'إلغاء')}</Button>
            <Button type="button" variant="primary" className="flex-1" isLoading={saving} onClick={save}>{l('Save', 'حفظ')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

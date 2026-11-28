'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import SheetUpload from '@/components/ui/SheetUpload';
import { useI18n } from '@/i18n';

interface PriceList { id: number; name: string; currency: string | null; items_count: number; from_odoo: boolean; stores: string[] }
interface Item { id: number; sku: string; name: string | null; base_price: number; price: number | null }

/**
 * Price lists. A store set to sell from a list uses its prices; a store with none sells at
 * the product's own price. Lists that come from Odoo are read-only here.
 */
export default function PriceListsPage() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [lists, setLists] = useState<PriceList[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const current = lists.find((p) => p.id === active) ?? null;

  const fail = (err: any, fallback: string) => setError(err.response?.status === 403
    ? l('Only the owner or an admin can change price lists.', 'تغيير قوائم الأسعار للمالك أو المدير فقط.')
    : err.response?.data?.message || fallback);

  const loadLists = useCallback(() => api.get('/price-lists').then(({ data }) => {
    setLists(data);
    setActive((id) => id ?? data[0]?.id ?? null);
  }).catch(() => setError(l('Could not load price lists.', 'تعذر تحميل قوائم الأسعار.'))), []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadItems = useCallback(() => {
    if (!active) return setItems([]);
    api.get(`/price-lists/${active}/items`, { params: { search, page } }).then(({ data }) => {
      setItems(data.data);
      setLastPage(data.last_page);
    }).catch(() => setItems([]));
  }, [active, search, page]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => {
    const wait = setTimeout(loadItems, 250);
    return () => clearTimeout(wait);
  }, [loadItems]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      const { data } = await api.post('/price-lists', { name: name.trim() });
      setName('');
      await loadLists();
      setActive(data.id);
      setPage(1);
    } catch (err) {
      fail(err, l('Could not create the list.', 'تعذر إنشاء القائمة.'));
    }
  };

  const remove = async (list: PriceList) => {
    if (!window.confirm(l(`Delete “${list.name}”? Stores using it go back to the product’s own price.`, `حذف «${list.name}»؟ المتاجر التي تستخدمها ترجع لسعر المنتج.`))) return;
    try {
      await api.delete(`/price-lists/${list.id}`);
      setActive(null);
      loadLists();
    } catch (err) {
      fail(err, l('Could not delete the list.', 'تعذر حذف القائمة.'));
    }
  };

  const savePrice = async (item: Item, value: string) => {
    const price = value.trim() === '' ? null : Number(value);
    if (price === item.price || (price !== null && (Number.isNaN(price) || price < 0))) return;
    setError('');
    try {
      await api.put(`/price-lists/${active}/items`, { variant_id: item.id, price });
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, price } : i)));
      loadLists();
    } catch (err) {
      fail(err, l('Could not save that price.', 'تعذر حفظ السعر.'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{l(`${lists.length} price lists`, `${lists.length} قائمة أسعار`)}</p>
        <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.025em]">{l('One price, or a price for every store.', 'سعر واحد، أو سعر لكل متجر.')}</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          {l(
            'With no list, every store sells at the product’s own price. Make a list, then choose it for a store under Stores → Set up. Price lists in Odoo arrive here on their own.',
            'بدون قائمة يبيع كل متجر بسعر المنتج نفسه. أنشئ قائمة ثم اخترها للمتجر من المتاجر ← إعداد. قوائم الأسعار في أودو تصل هنا تلقائياً.',
          )}
        </p>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => { setActive(list.id); setPage(1); setSearch(''); }}
              className={cn('block w-full rounded-[18px] border p-4 text-start transition-colors', list.id === active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-bold">{list.name}</span>
                {list.from_odoo && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Odoo</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {l(`${list.items_count} prices`, `${list.items_count} سعر`)}{list.currency ? ` · ${list.currency}` : ''}
                {list.stores.length > 0 && ` · ${list.stores.join(l(', ', '، '))}`}
              </span>
            </button>
          ))}
          <form onSubmit={create} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={l('New list name', 'اسم القائمة الجديدة')} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-sm" />
            <Button type="submit" variant="primary" size="md" aria-label={l('Add price list', 'أضف قائمة أسعار')}><Plus size={16} /></Button>
          </form>
        </aside>

        <section className="min-w-0 space-y-4">
          {!current ? (
            <p className="rounded-[22px] border border-border bg-card p-6 text-sm text-muted-foreground">{l('Make your first price list on the side.', 'أنشئ أول قائمة أسعار من الجانب.')}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="relative block w-full max-w-sm">
                  <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={l('Search by name or SKU', 'ابحث بالاسم أو الـ SKU')} className="h-11 w-full rounded-xl border border-border bg-card ps-9 pe-3 text-sm" />
                </label>
                {current.from_odoo ? (
                  <p className="text-xs text-muted-foreground">{l('From Odoo: change it there and it updates here.', 'من أودو: عدّلها هناك وتتحدث هنا.')}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetUpload endpoint={`/price-lists/${current.id}/import`} template={`sku,price\n${items[0]?.sku ?? 'YOUR-SKU'},99.00\n`} templateName={`${current.name} prices.csv`} onDone={() => { loadItems(); loadLists(); }} />
                    <button onClick={() => remove(current)} aria-label={l('Delete list', 'حذف القائمة')} title={l('Delete list', 'حذف القائمة')} className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-[22px] border border-border bg-card">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="p-4 font-bold">{l('Product', 'المنتج')}</th>
                      <th className="p-4 font-bold">SKU</th>
                      <th className="p-4 font-bold">{l('Own price', 'سعر المنتج')}</th>
                      <th className="p-4 font-bold">{l('Price in this list', 'السعر في هذه القائمة')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${current.id}-${item.id}`} className="border-b border-border last:border-0">
                        <td className="max-w-[260px] truncate p-4 font-bold">{item.name}</td>
                        <td className="p-4 font-mono text-xs">{item.sku}</td>
                        <td className="p-4 tabular-nums text-muted-foreground">{item.base_price.toFixed(2)}</td>
                        <td className="p-2">
                          <input
                            type="number" min="0" step="0.01" inputMode="decimal"
                            defaultValue={item.price ?? ''}
                            placeholder={item.base_price.toFixed(2)}
                            disabled={current.from_odoo}
                            aria-label={`${item.sku} · ${current.name}`}
                            onBlur={(e) => savePrice(item, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className="h-10 w-36 rounded-lg border border-border bg-background px-3 tabular-nums placeholder:text-muted-foreground/50 disabled:opacity-70"
                          />
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{l('No products match.', 'لا توجد منتجات مطابقة.')}</td></tr>}
                  </tbody>
                </table>
              </div>

              {lastPage > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <button className="rounded-lg border border-border px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>{l('Previous', 'السابق')}</button>
                  <span className="tabular-nums text-muted-foreground">{page} / {lastPage}</span>
                  <button className="rounded-lg border border-border px-3 py-2 font-bold disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>{l('Next', 'التالي')}</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

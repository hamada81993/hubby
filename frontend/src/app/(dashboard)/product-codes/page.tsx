'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import { PlatformLogo } from '@/components/ui/PlatformLogo';
import SheetUpload from '@/components/ui/SheetUpload';
import { useI18n } from '@/i18n';

interface Row { id: number; sku: string; name: string | null; codes: Record<string, string> }
interface Channel { id: number; name: string; platform: string }

/**
 * The code each sales channel knows a product by. Left empty, a channel is sent our SKU;
 * filled in, stock, prices and orders for that channel go by the code typed here.
 */
export default function ProductCodesPage() {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const [rows, setRows] = useState<Row[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/sku-links', { params: { search, page } })
      .then(({ data }) => {
        setRows(data.data);
        setChannels(data.stores);
        setLastPage(data.last_page);
        setTotal(data.total);
      })
      .catch(() => setError(l('Could not load your products.', 'تعذر تحميل منتجاتك.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => {
    const wait = setTimeout(load, 250);
    return () => clearTimeout(wait);
  }, [load]);

  const save = async (row: Row, channel: Channel, code: string) => {
    if ((row.codes[channel.id] ?? '') === code.trim()) return;
    setError('');
    try {
      await api.put('/sku-links', { variant_id: row.id, store_id: channel.id, code: code.trim() });
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, codes: { ...r.codes, [channel.id]: code.trim() } } : r)));
      setSaved(`${row.id}-${channel.id}`);
      setTimeout(() => setSaved(null), 1500);
    } catch (err: any) {
      setError(err.response?.status === 403
        ? l('Only the owner or an admin can change product codes.', 'تغيير الأكواد للمالك أو المدير فقط.')
        : l('Could not save that code.', 'تعذر حفظ الكود.'));
    }
  };

  const template = `sku,store,code\n${rows[0]?.sku ?? 'YOUR-SKU'},${channels[0]?.name ?? 'Store name'},CODE-ON-THAT-STORE\n`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{l(`${total} products`, `${total} منتج`)}</p>
          <h1 className="mt-1 text-[28px] font-black leading-tight tracking-[-0.025em]">{l('One product, its code on every store.', 'منتج واحد، وكوده في كل متجر.')}</h1>
          <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
            {l(
              'Leave a box empty when the store uses your SKU. Where a store knows the product by another code, type it once: stock, prices and orders for that store then follow it. Nothing changes in your ERP.',
              'اترك الخانة فارغة إذا كان المتجر يستخدم نفس الـ SKU. وإذا كان المتجر يعرف المنتج بكود آخر فاكتبه مرة واحدة، وبعدها يتبعه المخزون والأسعار والطلبات لهذا المتجر. لا شيء يتغير في نظامك المحاسبي.',
            )}
          </p>
        </div>
        <SheetUpload endpoint="/sku-links/import" template={template} templateName="product codes.csv" onDone={load} />
      </div>

      <label className="relative block max-w-md">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={l('Search by name, SKU or store code', 'ابحث بالاسم أو الـ SKU أو كود المتجر')}
          className="h-11 w-full rounded-xl border border-border bg-card ps-9 pe-3 text-sm"
        />
      </label>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {channels.length === 0 && !loading ? (
        <p className="rounded-[22px] border border-border bg-card p-6 text-sm text-muted-foreground">
          {l('Connect a sales channel first; its column appears here.', 'اربط قناة بيع أولاً، وسيظهر عمودها هنا.')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[22px] border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="p-4 font-bold">{l('Product', 'المنتج')}</th>
                <th className="p-4 font-bold">{l('Your SKU', 'الـ SKU عندك')}</th>
                {channels.map((c) => (
                  <th key={c.id} className="p-4 font-bold">
                    <span className="flex items-center gap-2"><PlatformLogo platform={c.platform} size={16} /> {c.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="max-w-[260px] truncate p-4 font-bold">{row.name}</td>
                  <td className="p-4 font-mono text-xs">{row.sku}</td>
                  {channels.map((c) => (
                    <td key={c.id} className="p-2">
                      <input
                        defaultValue={row.codes[c.id] ?? ''}
                        placeholder={row.sku}
                        aria-label={`${row.sku} · ${c.name}`}
                        onBlur={(e) => save(row, c, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className={`h-10 w-full min-w-[140px] rounded-lg border bg-background px-3 font-mono text-xs placeholder:text-muted-foreground/50 ${saved === `${row.id}-${c.id}` ? 'border-positive' : 'border-border'}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={2 + channels.length} className="p-8 text-center text-muted-foreground">{l('No products match.', 'لا توجد منتجات مطابقة.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="rounded-lg border border-border px-3 py-2 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>{l('Previous', 'السابق')}</button>
          <span className="tabular-nums text-muted-foreground">{page} / {lastPage}</span>
          <button className="rounded-lg border border-border px-3 py-2 font-bold disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>{l('Next', 'التالي')}</button>
        </div>
      )}
    </div>
  );
}

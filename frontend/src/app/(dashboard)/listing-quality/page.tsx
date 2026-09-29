"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
type Product = {
  id: number;
  name: string;
  sku: string;
  issues: string[];
  channels: {
    store: string;
    platform: string;
    mapped: number;
    variants: number;
    disabled: number;
    conflicts: number;
  }[];
};
const labels: Record<string, [string, string]> = {
  missing_sku: ["Missing SKU", "رمز الصنف مفقود"],
  missing_name: ["Missing name", "الاسم مفقود"],
  missing_description: ["Missing description", "الوصف مفقود"],
  missing_image_url: ["Missing image", "الصورة مفقودة"],
  nonpositive_price: ["Check price", "راجع السعر"],
  no_variants: ["No variants", "لا توجد متغيرات"],
};
export default function ListingQualityPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const org = useAuthStore((s) => s.activeOrgId);
  const [rows, setRows] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setRows([]);
    setError(false);
    api
      .get("/listing-quality", { params: { search, page }, signal: c.signal })
      .then((r) => {
        if (!c.signal.aborted) {
          setRows(r.data.data);
          setLast(r.data.last_page);
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [org, search, page]);
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">
        {ar ? "جودة الكتالوج" : "Catalog quality"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "افحص المحتوى الأساسي وربط المتغيرات قبل المزامنة. هذه الفحوص لا تضمن قبول منصة البيع."
          : "Check core content and variant mappings before syncing. These checks do not guarantee marketplace acceptance."}
      </p>
      <input
        aria-label={ar ? "بحث" : "Search"}
        placeholder={ar ? "بحث بالاسم أو رمز الصنف" : "Search name or SKU"}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="border border-border bg-background rounded-xl p-3"
      />
      {error && (
        <p role="alert" className="text-destructive">
          {ar ? "تعذر تحميل الفحوص" : "Could not load checks"}
        </p>
      )}
      {rows.map((p) => (
        <section key={p.id} className="rounded-2xl border border-border p-5">
          <div className="flex justify-between">
            <div>
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-xs text-muted-foreground">{p.sku}</p>
            </div>
            <Link
              href={`/products/${p.id}/edit`}
              className="text-primary text-sm"
            >
              {ar ? "مراجعة المنتج" : "Review product"} ↗
            </Link>
          </div>
          <div className="flex gap-2 flex-wrap mt-3">
            {p.issues.map((issue) => (
              <span
                key={issue}
                className="text-xs rounded-full px-3 py-1 bg-amber-500/10 text-amber-600"
              >
                {labels[issue]?.[ar ? 1 : 0] || issue}
              </span>
            ))}
            {!p.issues.length && (
              <span className="text-xs text-emerald-600">
                {ar ? "المحتوى الأساسي مكتمل" : "Core content complete"}
              </span>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {p.channels.map((c, i) => (
              <div key={i} className="rounded-xl bg-accent/30 p-3 text-sm">
                <strong>{c.store}</strong>
                <p className="text-xs mt-1">
                  {ar ? "المتغيرات المرتبطة" : "Mapped variants"}: {c.mapped}/
                  {c.variants} · {ar ? "مزامنة معطلة" : "Sync disabled"}:{" "}
                  {c.disabled} · {ar ? "تعارضات الربط" : "Mapping conflicts"}:{" "}
                  {c.conflicts}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="flex gap-3">
        <button disabled={page === 1} onClick={() => setPage((v) => v - 1)}>
          ←
        </button>
        <span>
          {page}/{last}
        </span>
        <button disabled={page >= last} onClick={() => setPage((v) => v + 1)}>
          →
        </button>
      </div>
    </div>
  );
}

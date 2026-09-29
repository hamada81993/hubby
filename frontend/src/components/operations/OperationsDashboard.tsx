"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
import { Money } from "@/components/ui/Money";

type Summary = {
  base_currency: string;
  generated_at: string;
  stores: { id: number; name: string }[];
  queues: { key: string; count: number }[];
};
type Health = {
  id: number;
  name: string;
  platform: string;
  state: string;
  last_synced_at: string | null;
  credential_expires_at: string | null;
  refund_push_supported: boolean;
  logs: { id: number; type: string; status: string; updated_at: string }[];
};
type Profit = {
  orders: number;
  gross_revenue: string;
  net_revenue: string;
  net_profit: string;
  coverage: { orders_missing_cost: number; orders_estimated: number };
};
type Row = { id: number; label: string; status: string; href: string };
const queueNames: Record<string, [string, string]> = {
  fulfillment: ["Ready for fulfillment", "جاهزة للتجهيز"],
  held: ["Orders on hold", "طلبات معلقة"],
  delivery: ["Delivery exceptions", "مشكلات التوصيل"],
  cod: ["Overdue COD", "تحصيلات متأخرة"],
  returns: ["Returns to review", "مرتجعات للمراجعة"],
  stock: ["Low stock · ≤ 5 units", "مخزون منخفض · ٥ وحدات أو أقل"],
};

export default function OperationsDashboard() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const l = (en: string, arabic: string) => (ar ? arabic : en);
  const org = useAuthStore((s) => s.activeOrgId);
  const [store, setStore] = useState("");
  const [days, setDays] = useState("30");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [health, setHealth] = useState<Health[]>([]);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [profitState, setProfitState] = useState("loading");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState("fulfillment");
  const [rows, setRows] = useState<Row[]>([]);
  const [queueError, setQueueError] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setStore("");
    setSummary(null);
    setHealth([]);
    setProfit(null);
    setRows([]);
  }, [org]);
  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const [a, b] = await Promise.all([
          api.get<Summary>("/operations", {
            params: { store_id: store || undefined },
            signal: controller.signal,
          }),
          api.get<Health[]>("/operations/health", {
            signal: controller.signal,
          }),
        ]);
        if (!controller.signal.aborted) {
          setSummary(a.data);
          setHealth(b.data);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted) setError("unavailable");
      }
    };
    void load();
    const timer = setInterval(load, 10000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [org, store, revision]);
  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    setProfit(null);
    setProfitState("loading");
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Number(days) + 1);
    api
      .get<Profit>("/analytics/profit", {
        signal: controller.signal,
        params: {
          store_id: store || undefined,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        },
      })
      .then((r) => {
        if (!controller.signal.aborted) {
          setProfit(r.data);
          setProfitState("ready");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setProfitState(
            e.response?.status === 403 ? "restricted" : "unavailable",
          );
      });
    return () => controller.abort();
  }, [org, store, days, revision]);
  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    setRows([]);
    setQueueError(false);
    api
      .get(`/operations/queues/${selected}`, {
        signal: controller.signal,
        params: { page, store_id: store || undefined },
      })
      .then((r) => {
        if (!controller.signal.aborted) {
          setRows(r.data.data);
          setLastPage(r.data.last_page);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setQueueError(true);
      });
    return () => controller.abort();
  }, [org, store, selected, page, revision]);
  const sync = async (id: number) => {
    setBusy(id);
    setNotice("");
    try {
      await api.post(`/stores/${id}/sync`);
      setRevision((v) => v + 1);
      setNotice(
        l(
          "Sync requested. Job status updates automatically.",
          "تم طلب المزامنة. يتم تحديث الحالة تلقائياً.",
        ),
      );
    } catch {
      setNotice(
        l(
          "Could not start sync. Please retry.",
          "تعذر بدء المزامنة. حاول مرة أخرى.",
        ),
      );
    } finally {
      setBusy(null);
    }
  };
  const control = "rounded-xl border border-border bg-card px-3 py-2 text-sm";
  return (
    <div className="space-y-7 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-primary font-semibold">
            Hubby / {l("Command centre", "مركز العمليات")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {l("Your business, in motion.", "أعمالك، تحت السيطرة.")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {l(
              "Resolve exceptions. Keep orders moving. Know your numbers.",
              "عالج المشكلات. تابع الطلبات. افهم أرقامك.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={l("Store", "المتجر")}
            value={store}
            onChange={(e) => {
              setStore(e.target.value);
              setPage(1);
            }}
            className={control}
          >
            <option value="">{l("All stores", "كل المتاجر")}</option>
            {summary?.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            className={control}
            onClick={() => setRevision((v) => v + 1)}
            aria-label={l("Refresh", "تحديث")}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-destructive"
        >
          {l(
            "Live data is unavailable. Displayed information may be stale. Retry using refresh.",
            "البيانات المباشرة غير متاحة. قد تكون المعلومات المعروضة قديمة. أعد التحديث.",
          )}
        </p>
      )}
      <section className="rounded-3xl border border-border bg-card p-5 md:p-7">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={19} className="text-primary" />
          <h2 className="font-semibold text-lg">
            {l("Needs attention", "تحتاج انتباهك")}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          {l(
            "Live open work across all dates. Select a queue to investigate.",
            "المهام المفتوحة لكل التواريخ. اختر قائمة للمراجعة.",
          )}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(queueNames).map(([key, name]) => (
            <button
              key={key}
              onClick={() => {
                setSelected(key);
                setPage(1);
              }}
              aria-pressed={selected === key}
              className={`text-start p-4 rounded-2xl border transition-colors ${selected === key ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
            >
              <span className="block text-xs text-muted-foreground">
                {name[ar ? 1 : 0]}
              </span>
              <span className="block mt-3 text-3xl font-semibold tabular-nums">
                {summary?.queues.find((q) => q.key === key)?.count ?? "—"}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <h3 className="font-medium">{queueNames[selected][ar ? 1 : 0]}</h3>
          <span className="text-xs text-muted-foreground">
            {page} / {lastPage}
          </span>
        </div>
        <div className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <Link
              href={row.href}
              key={row.id}
              className="flex justify-between items-center py-3 gap-3 hover:text-primary"
            >
              <span>{row.label || `#${row.id}`}</span>
              <span className="flex items-center gap-3 text-sm text-muted-foreground">
                {row.status}
                <ArrowUpRight size={16} />
              </span>
            </Link>
          ))}
          {!rows.length && (
            <p className="py-6 text-sm text-muted-foreground">
              {queueError
                ? l("Could not load this queue.", "تعذر تحميل القائمة.")
                : l("No records to display.", "لا توجد سجلات للعرض.")}
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            className={control}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {l("Previous", "السابق")}
          </button>
          <button
            className={control}
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            {l("Next", "التالي")}
          </button>
        </div>
      </section>
      <section>
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-lg">
              {l("Financial performance", "الأداء المالي")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {l(
                "Calculated order reports · base currency · includes recorded costs only",
                "تقارير الطلبات المحسوبة · العملة الأساسية · تشمل التكاليف المسجلة فقط",
              )}
            </p>
          </div>
          <select
            aria-label={l("Financial period", "الفترة المالية")}
            className={control}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} {l("days", "أيام")}
              </option>
            ))}
          </select>
        </div>
        {profit ? (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                [l("Gross revenue", "إجمالي الإيرادات"), profit.gross_revenue],
                [l("Net revenue", "صافي الإيرادات"), profit.net_revenue],
                [
                  l("Estimated net profit", "صافي الربح التقديري"),
                  profit.net_profit,
                ],
              ].map(([label, value]) => (
                <Link
                  href="/profit"
                  key={label}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="mt-3 text-2xl font-semibold">
                    {profit.orders > 0 ? (
                      <Money amount={value} currency={summary?.base_currency} />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </Link>
              ))}
              <Link
                href="/profit"
                className="rounded-2xl border border-border bg-card p-5"
              >
                <p className="text-xs text-muted-foreground">
                  {l("Orders with calculated profit", "طلبات تم حساب ربحها")}
                </p>
                <p className="mt-3 text-2xl font-semibold">{profit.orders}</p>
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {l("Missing costs", "تكاليف مفقودة")}:{" "}
              {profit.coverage.orders_missing_cost} ·{" "}
              {l("Estimated orders", "طلبات بتقديرات")}:{" "}
              {profit.coverage.orders_estimated}.{" "}
              {l(
                "This is not a bank balance. Uncalculated orders are excluded.",
                "هذا ليس رصيداً بنكياً. الطلبات غير المحسوبة مستبعدة.",
              )}
            </p>
          </>
        ) : (
          <p className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
            {profitState === "restricted"
              ? l(
                  "Your role does not allow access to financial reports.",
                  "صلاحياتك لا تسمح بعرض التقارير المالية.",
                )
              : profitState === "loading"
                ? l("Loading financial reports…", "جارٍ تحميل التقارير…")
                : l(
                    "Financial reports are unavailable. Refresh to retry.",
                    "التقارير غير متاحة. أعد التحديث.",
                  )}
          </p>
        )}
      </section>
      <section className="rounded-3xl border border-border bg-card p-5 md:p-7">
        <div className="flex justify-between mb-5">
          <h2 className="font-semibold text-lg">
            {l("Integration health", "حالة التكاملات")}
          </h2>
          <Link href="/stores" className="text-primary text-sm">
            {l("Manage stores", "إدارة المتاجر")}
          </Link>
        </div>
        {notice && (
          <p role="status" className="mb-4 text-sm">
            {notice}
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {health
            .filter((s) => !store || String(s.id) === store)
            .map((s) => (
              <div key={s.id} className="rounded-2xl border border-border p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {s.platform}
                    </p>
                  </div>
                  {s.state === "healthy" ? (
                    <ShieldCheck className="text-emerald-500" />
                  ) : (
                    <AlertTriangle className="text-amber-500" />
                  )}
                </div>
                <p className="mt-3 text-sm">
                  {s.state === "healthy"
                    ? l("Latest jobs succeeded", "نجحت آخر المهام")
                    : s.state === "running"
                      ? l("Queued / running", "في الانتظار / قيد التنفيذ")
                      : s.state === "stalled"
                        ? l(
                            "Delayed — check queue worker",
                            "متأخرة — تحقق من عامل المهام",
                          )
                        : s.state === "failed"
                          ? l(
                              "Sync failed — retry or check connection",
                              "فشلت المزامنة — أعد المحاولة أو راجع الاتصال",
                            )
                          : l("No sync history", "لا يوجد سجل مزامنة")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {l("Last catalog sync", "آخر مزامنة للكتالوج")}:{" "}
                  {s.last_synced_at
                    ? new Date(s.last_synced_at).toLocaleString(locale)
                    : "—"}
                </p>
                {s.credential_expires_at && <p className="mt-2 text-xs text-muted-foreground">
                  {l("Credential expiry", "انتهاء صلاحية الاتصال")}: {new Date(s.credential_expires_at).toLocaleString(locale)}
                </p>}
                <p className="mt-2 text-xs text-muted-foreground">{s.refund_push_supported
                  ? l("Refunds can be sent to this channel", "يمكن إرسال المبالغ المستردة لهذه القناة")
                  : l("Refunds require separate channel handling", "المبالغ المستردة تتطلب معالجة منفصلة على القناة")}</p>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer">
                    {l("Recent jobs", "المهام الأخيرة")}
                  </summary>
                  {s.logs.map((log) => (
                    <p key={log.id} className="py-1">
                      {log.type} · {log.status} ·{" "}
                      {new Date(log.updated_at).toLocaleString(locale)}
                    </p>
                  ))}
                </details>
                <button
                  disabled={busy === s.id || s.state === "running"}
                  onClick={() => sync(s.id)}
                  className={`${control} mt-4 disabled:opacity-40`}
                >
                  {busy === s.id
                    ? l("Requesting…", "جارٍ الطلب…")
                    : l("Sync store", "مزامنة المتجر")}
                </button>
              </div>
            ))}
        </div>
        {!health.length && (
          <Link href="/stores" className="text-sm text-primary">
            {l("Connect a store to begin", "اربط متجراً للبدء")}
          </Link>
        )}
      </section>
    </div>
  );
}

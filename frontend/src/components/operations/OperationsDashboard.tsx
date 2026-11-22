"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Check,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
import { Money } from "@/components/ui/Money";
import LiveHub, { type HubStore } from "./LiveHub";

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
type Totals = {
  total_revenue: number;
  total_orders: number;
  revenue_change: number | null;
};
type Channel = { store_id: number; net_revenue: string };
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
  const [totals, setTotals] = useState<Totals | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
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
    setTotals(null);
    setChannels(null);
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
  // The hub: organisation-wide totals and each store's share for the period.
  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - Number(days) + 1);
    api
      .get<Totals>("/analytics/dashboard", {
        signal: controller.signal,
        params: { days },
      })
      .then((r) => {
        if (!controller.signal.aborted)
          setTotals(typeof r.data?.total_orders === "number" ? r.data : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setTotals(null);
      });
    api
      .get<Channel[]>("/analytics/profit/by-channel", {
        signal: controller.signal,
        params: {
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
        },
      })
      .then((r) => {
        if (!controller.signal.aborted)
          setChannels(Array.isArray(r.data) ? r.data : null);
      })
      .catch(() => {
        // Finance reports can be restricted by role; the hub still draws without shares.
        if (!controller.signal.aborted) setChannels(null);
      });
    return () => controller.abort();
  }, [org, days, revision]);
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
  const count = (key: string) => summary?.queues.find((q) => q.key === key)?.count ?? 0;
  const waiting = count("fulfillment");
  // The hub shows where orders come from; Odoo is a product source and stays off it.
  const hubStores: HubStore[] = health.filter((s) => s.platform !== 'odoo').map((s) => {
    const channel = channels?.find((c) => c.store_id === s.id);
    return {
      id: s.id,
      name: s.name,
      platform: s.platform,
      state: s.state,
      revenue: channels ? Number(channel?.net_revenue ?? 0) : null,
    };
  });
  const attention = [
    ...health
      .filter((s) => s.state === "failed" || s.state === "stalled")
      .map((s) => ({
        key: `store-${s.id}`,
        queue: "",
        tone: "text-negative",
        title: l(`${s.name} is not syncing`, `${s.name} لا يُزامن`),
      })),
    ...(["held", "delivery", "cod", "returns", "stock"] as const)
      .filter((key) => count(key) > 0)
      .map((key) => ({
        key,
        queue: key as string,
        tone: key === "returns" ? "text-muted-foreground" : "text-caution",
        title: `${count(key)} · ${queueNames[key][ar ? 1 : 0]}`,
      })),
  ];
  return (
    <div className="space-y-7 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(ar ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · {l("live", "مباشر")}
          </p>
          <h1 className="mt-1 text-2xl md:text-[28px] font-black tracking-[-0.02em] leading-tight">
            {health.length > 1
              ? l(`${health.length} stores. One heartbeat.`, `${health.length} متاجر. نبض واحد.`)
              : l("Every store. One heartbeat.", "كل متاجرك. نبض واحد.")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={l("Period", "الفترة")}
            className={control}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            {[7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {l(`Last ${d} days`, `آخر ${d} يوماً`)}
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
          <Link
            href="/stores"
            className="inline-flex h-[42px] items-center gap-2 rounded-xl bg-action px-4 text-sm font-bold text-action-foreground transition hover:bg-action/90"
          >
            <Plus size={18} strokeWidth={2.5} />
            {l("Connect a store", "اربط متجراً")}
          </Link>
        </div>
      </div>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_372px]">
        <LiveHub
          stores={hubStores}
          centreValue={totals ? totals.total_orders.toLocaleString("en-US") : "—"}
          centreLabel={l(`orders in ${days} days`, `طلب في ${days} يوماً`)}
          ariaLabel={l("Orders flowing from your stores into the hub", "الطلبات من متاجرك إلى المركز")}
          shareLabel={(pct) => l(`${pct}% of revenue`, `${pct}% من الإيرادات`)}
          moreLabel={(n) => l(`+${n} more stores`, `+${n} متاجر أخرى`)}
          stateLabel={(state) =>
            state === "failed"
              ? { text: l("Reconnect", "أعد الربط"), ok: false }
              : state === "stalled"
                ? { text: l("Delayed", "متأخر"), ok: false }
                : { text: l("Live", "مباشر"), ok: true }
          }
        />
        <div className="flex flex-col gap-[18px]">
          <section className="hb-rise rounded-[28px] border border-border bg-card px-6 py-[22px]">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp size={18} className="text-primary" />
              {l(`Revenue · last ${days} days`, `الإيرادات · آخر ${days} يوماً`)}
            </p>
            <div className="mt-1 text-[32px] font-black leading-[1.15] tracking-[-0.03em] tabular-nums">
              {totals ? (
                <Money amount={totals.total_revenue} currency={summary?.base_currency} />
              ) : (
                "—"
              )}
            </div>
            {totals?.revenue_change != null && (
              <p className={`mt-1 text-sm font-bold ${totals.revenue_change >= 0 ? "text-positive" : "text-negative"}`}>
                {totals.revenue_change >= 0 ? "+" : ""}
                {totals.revenue_change}%{" "}
                {l(`against the ${days} days before`, `عن الـ ${days} يوماً السابقة`)}
              </p>
            )}
          </section>
          {waiting > 0 ? (
            <section
              className="hb-rise rounded-[28px] bg-action px-6 py-[22px] text-action-foreground"
              style={{ animationDelay: "80ms" }}
            >
              <div className="flex items-end gap-3.5">
                <span className="text-[56px] font-black leading-[0.95] tracking-[-0.04em] tabular-nums">
                  {waiting}
                </span>
                <span className="pb-1 text-base font-bold leading-tight">
                  {l("orders waiting", "طلب في انتظار")}
                  <br />
                  {l("to be packed", "التجهيز")}
                </span>
              </div>
              <Link
                href="/orders"
                className="mt-4 flex h-12 items-center justify-center gap-2.5 rounded-[14px] bg-action-foreground text-base font-bold text-white"
              >
                <Package size={20} />
                {l("Start packing", "ابدأ التجهيز")}
              </Link>
            </section>
          ) : (
            <section
              className="hb-rise flex items-center gap-3 rounded-[28px] border border-border bg-card px-6 py-[22px]"
              style={{ animationDelay: "80ms" }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-positive">
                <Check size={20} />
              </span>
              <span className="font-bold">{l("Nothing is waiting to be packed.", "لا توجد طلبات في انتظار التجهيز.")}</span>
            </section>
          )}
          <section
            className="hb-rise flex-1 rounded-[28px] border border-border bg-card px-6 py-[18px]"
            style={{ animationDelay: "160ms" }}
          >
            <h2 className="mb-1 text-lg font-bold">{l("Needs you", "يحتاج تدخلك")}</h2>
            {attention.length ? (
              attention.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.queue) {
                      setSelected(item.queue);
                      setPage(1);
                    }
                    document.getElementById(item.queue ? "hub-queues" : "hub-health")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex w-full items-center gap-3 border-t border-muted py-[11px] text-start"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${item.tone}`}>
                    <AlertTriangle size={20} />
                  </span>
                  <span className="min-w-0 flex-1 font-bold">{item.title}</span>
                  <span className="whitespace-nowrap text-sm font-bold text-primary">{l("Review", "راجع")}</span>
                </button>
              ))
            ) : (
              <p className="border-t border-muted py-4 text-sm text-muted-foreground">
                {l("All clear. Nothing needs you right now.", "كل شيء تمام. لا شيء يحتاج تدخلك الآن.")}
              </p>
            )}
          </section>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-xl font-bold">{l("Work queues", "قوائم العمل")}</h2>
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
      <section id="hub-queues" className="scroll-mt-24 rounded-[28px] border border-border bg-card p-5 md:p-7">
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
      <section id="hub-health" className="scroll-mt-24 rounded-[28px] border border-border bg-card p-5 md:p-7">
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
                    <ShieldCheck className="text-positive" />
                  ) : (
                    <AlertTriangle className="text-caution" />
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

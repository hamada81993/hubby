"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
import PackingStation from "@/components/operations/PackingStation";

type Line = {
  id: number;
  sku: string;
  name: string;
  qty_received?: number;
  qty_expected?: number;
  qty_picked?: number;
  qty_required?: number;
  counted_qty?: number;
  expected_qty?: number;
  status?: string;
};
type Session = {
  id: number;
  code: string;
  status: string;
  items?: Line[];
  entries?: Line[];
};
const kinds = {
  receipts: ["Receiving", "الاستلام"],
  "pick-lists": ["Picking", "التجهيز"],
  "count-sessions": ["Cycle counts", "الجرد"],
};
export default function WarehousePage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const l = (en: string, arabic: string) => (ar ? arabic : en);
  const org = useAuthStore((s) => s.activeOrgId);
  const [kind, setKind] = useState<keyof typeof kinds>("receipts");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [warehouse, setWarehouse] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("1");
  const scanRequest = useRef<{ signature: string; uuid: string } | null>(null);
  useEffect(() => {
    setSelected(null);
    setSessions([]);
    setWarehouse("");
  }, [org]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      api.get(`/${kind}`, { params: { page }, signal: controller.signal }),
      api.get("/warehouses", { signal: controller.signal }),
    ])
      .then(([a, b]) => {
        if (!controller.signal.aborted) {
          setSessions(a.data.data);
          setLastPage(a.data.last_page);
          setWarehouses(b.data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            l("Could not load warehouse work.", "تعذر تحميل مهام المخزن."),
          );
      });
    return () => controller.abort();
  }, [org, kind, page, version, locale]);
  const open = async (id: number) => {
    setError("");
    try {
      const r = await api.get(`/${kind}/${id}`);
      setSelected(r.data);
    } catch {
      setError(l("Could not load session.", "تعذر تحميل الجلسة."));
    }
  };
  const mutate = async (url: string, data: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(url, data);
      setVersion((v) => v + 1);
      return r.data;
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || l("Action failed.", "تعذر تنفيذ العملية."),
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const common = { warehouse_id: warehouse ? Number(warehouse) : undefined };
    const data =
      kind === "receipts"
        ? {
            ...common,
            supplier_name: form.get("supplier"),
            reference: form.get("reference"),
          }
        : kind === "pick-lists"
          ? {
              ...common,
              order_ids: String(form.get("orders"))
                .split(",")
                .map((s) => Number(s.trim())),
            }
          : { ...common, mode: "blind", scope_type: "full" };
    const r = await mutate(`/${kind}`, data);
    if (r) await open(r.id);
  };
  const scan = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const action =
      kind === "receipts" ? "scan" : kind === "pick-lists" ? "pick" : "count";
    const signature = `${org}/${kind}/${selected.id}/${barcode}/${qty}`;
    if (scanRequest.current?.signature !== signature) {
      scanRequest.current = { signature, uuid: crypto.randomUUID() };
    }
    const result = await mutate(`/${kind}/${selected.id}/${action}`, {
      uuid: scanRequest.current.uuid,
      barcode,
      ...(kind === "count-sessions"
        ? { counted_qty: Number(qty) }
        : { qty: Number(qty) }),
    });
    if (result) {
      scanRequest.current = null;
      setBarcode("");
      await open(selected.id);
    }
  };
  const action = async (verb: string) => {
    if (!selected) return;
    const r = await mutate(`/${kind}/${selected.id}/${verb}`, {});
    if (r) await open(selected.id);
  };
  const field = "rounded-xl border border-border bg-background p-3 text-sm";
  const lines = selected?.items || selected?.entries || [];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-xs uppercase tracking-widest">
          Hubby / {l("Operations", "العمليات")}
        </p>
        <h1 className="text-3xl font-bold mt-2">
          {l("Warehouse workspace", "إدارة المخازن")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {l(
            "Coordinate receiving, picking and count approvals with your mobile team.",
            "تابع الاستلام والتجهيز واعتماد الجرد مع فريقك على الهاتف.",
          )}
        </p>
      </div>
      <PackingStation key={org} />
      <div className="flex gap-2 flex-wrap">
        {Object.entries(kinds).map(([key, value]) => (
          <button
            key={key}
            className={`${field} ${kind === key ? "border-primary text-primary" : ""}`}
            onClick={() => {
              setKind(key as keyof typeof kinds);
              setSelected(null);
              setPage(1);
            }}
          >
            {value[ar ? 1 : 0]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <form
        onSubmit={create}
        className="rounded-2xl border border-border p-5 flex flex-wrap gap-3 items-center"
      >
        <select
          className={field}
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
          aria-label={l("Warehouse", "المخزن")}
        >
          <option value="">{l("Default warehouse", "المخزن الافتراضي")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {kind === "receipts" && (
          <>
            <input
              name="supplier"
              className={field}
              placeholder={l("Supplier", "المورد")}
              aria-label={l("Supplier", "المورد")}
            />
            <input
              name="reference"
              className={field}
              placeholder={l("Reference", "المرجع")}
              aria-label={l("Reference", "المرجع")}
            />
          </>
        )}
        {kind === "pick-lists" && (
          <input
            name="orders"
            required
            pattern="[0-9, ]+"
            className={field}
            placeholder={l(
              "Order IDs, comma separated",
              "أرقام الطلبات بفواصل",
            )}
            aria-label={l("Order IDs", "أرقام الطلبات")}
          />
        )}
        <button
          disabled={busy}
          className={`${field} bg-primary text-primary-foreground`}
        >
          {l("Create session", "إنشاء جلسة")}
        </button>
      </form>
      <div className="grid lg:grid-cols-[1fr_2fr] gap-5">
        <section className="border border-border rounded-2xl p-4">
          <h2 className="font-semibold mb-3">{l("Sessions", "الجلسات")}</h2>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => open(s.id)}
              className={`block w-full text-start p-3 rounded-xl ${selected?.id === s.id ? "bg-primary/10" : "hover:bg-accent"}`}
            >
              <span className="font-medium">{s.code || `#${s.id}`}</span>
              <span className="block text-xs text-muted-foreground">
                {s.status}
              </span>
            </button>
          ))}
          {!sessions.length && (
            <p className="text-sm text-muted-foreground">
              {l("No sessions yet.", "لا توجد جلسات.")}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className={field}
            >
              ←
            </button>
            <span className="p-3 text-sm">
              {page}/{lastPage}
            </span>
            <button
              disabled={page >= lastPage}
              onClick={() => setPage((p) => p + 1)}
              className={field}
            >
              →
            </button>
          </div>
        </section>
        <section className="border border-border rounded-2xl p-5 min-w-0">
          {selected ? (
            <>
              <h2 className="font-semibold">
                {selected.code} · {selected.status}
              </h2>
              <div className="overflow-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-start">SKU</th>
                      <th>{l("Expected", "المتوقع")}</th>
                      <th>{l("Processed", "المنفذ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-t border-border">
                        <td className="py-3">
                          {line.sku}
                          <span className="block text-xs text-muted-foreground">
                            {line.name}
                          </span>
                        </td>
                        <td className="text-center">
                          {line.qty_expected ??
                            line.qty_required ??
                            line.expected_qty ??
                            "—"}
                        </td>
                        <td className="text-center">
                          {line.qty_received ??
                            line.qty_picked ??
                            line.counted_qty ??
                            "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form onSubmit={scan} className="flex flex-wrap gap-2 mt-5">
                <input
                  className={field}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  required
                  placeholder={l("Scan barcode", "امسح الباركود")}
                  aria-label={l("Barcode", "الباركود")}
                />
                <input
                  type="number"
                  min={kind === "count-sessions" ? 0 : 1}
                  required
                  className={`${field} w-24`}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  aria-label={l("Quantity", "الكمية")}
                />
                <button disabled={busy} className={field}>
                  {l("Record", "تسجيل")}
                </button>
              </form>
              <div className="flex flex-wrap gap-2 mt-4">
                {kind === "pick-lists" &&
                    ["ready", "paused"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => action("start")}
                      className={field}
                    >
                      {l("Start picking", "بدء التجهيز")}
                    </button>
                  )}
                {kind !== "count-sessions" &&
                  ["draft", "in_progress"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => action("complete")}
                      className={field}
                    >
                      {l("Complete session", "إكمال الجلسة")}
                    </button>
                  )}
                {kind === "count-sessions" &&
                  ["draft", "in_progress"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => action("submit")}
                      className={field}
                    >
                      {l("Submit for approval", "إرسال للاعتماد")}
                    </button>
                  )}
                {kind === "count-sessions" &&
                  ["submitted", "under_review"].includes(selected.status) && (
                    <button
                      disabled={busy}
                      onClick={() => action("approve")}
                      className={`${field} border-primary`}
                    >
                      {l("Approve stock adjustments", "اعتماد تعديلات المخزون")}
                    </button>
                  )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {l(
                "Select a session to inspect its lines and progress.",
                "اختر جلسة لمراجعة العناصر والتقدم.",
              )}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

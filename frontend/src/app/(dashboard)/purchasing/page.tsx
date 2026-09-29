"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";

type Stock = {
  id: number;
  sku: string;
  stock: number;
  incoming: number;
  days_remaining: number | null;
  suggested_quantity: number;
};
type Line = {
  variant_id: number;
  sku: string;
  quantity: number;
  received?: number;
  unit_cost: number;
};
type Purchase = {
  id: number;
  reference: string;
  status: string;
  currency: string;
  lines: Line[];
};
export default function PurchasingPage() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const l = (en: string, a: string) => (ar ? a : en);
  const org = useAuthStore((s) => s.activeOrgId);
  const [suppliers, setSuppliers] = useState<
    { id: number; name: string; lead_days: number }[]
  >([]);
  const [supplier, setSupplier] = useState("");
  const [stock, setStock] = useState<Stock[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [poLastPage, setPoLastPage] = useState(1);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});
  const receiveKey = useRef("");
  const lead =
    suppliers.find((s) => String(s.id) === supplier)?.lead_days ?? 14;
  useEffect(() => {
    setLines([]);
    setSupplier("");
    setSelected(null);
    setStock([]);
    setPurchases([]);
  }, [org]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      api.get("/suppliers", { signal: controller.signal }),
      api.get("/purchase-orders", {
        params: { page: poPage },
        signal: controller.signal,
      }),
      api.get("/replenishment", {
        params: { lead_days: lead, search, page },
        signal: controller.signal,
      }),
    ])
      .then(([s, p, r]) => {
        if (!controller.signal.aborted) {
          setSuppliers(s.data);
          setPurchases(p.data.data);
          setPoLastPage(p.data.last_page);
          setStock(r.data.data);
          setLastPage(r.data.last_page);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            l(
              "Purchasing unavailable. Cost access is required.",
              "المشتريات غير متاحة. يلزم تصريح عرض التكاليف.",
            ),
          );
      });
    return () => controller.abort();
  }, [org, version, page, poPage, lead, search, locale]);
  const post = async (url: string, data: unknown) => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(url, data);
      setVersion((v) => v + 1);
      return r.data;
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || l("Action failed.", "تعذر التنفيذ."),
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const createSupplier = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await post("/suppliers", {
      name: f.get("name"),
      email: f.get("email") || null,
      lead_days: Number(f.get("lead_days")),
    });
    if (r) setSupplier(String(r.id));
  };
  const createPurchase = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await post("/purchase-orders", {
      supplier_id: Number(supplier),
      reference: f.get("reference"),
      expected_at: f.get("expected_at") || null,
      lines,
    });
    if (r) setLines([]);
  };
  const receive = async () => {
    if (!selected) return;
    const r = await post(`/purchase-orders/${selected.id}/receive`, {
      request_id: (receiveKey.current ||= crypto.randomUUID()),
      lines: selected.lines
        .filter((line) => Number(receiveQty[line.variant_id]) > 0)
        .map((line) => ({
          variant_id: line.variant_id,
          quantity: Number(receiveQty[line.variant_id]),
        })),
    });
    if (r) {
      setSelected(null);
      setReceiveQty({});
    }
  };
  const field =
    "rounded-xl border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        {l("Purchase with a plan.", "خطط لمشترياتك.")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {l(
          "Reorder suggestions use 30-day sales velocity, supplier lead time and 30 days of cover, less stock and open purchases. No seasonal adjustment yet.",
          "تعتمد الاقتراحات على مبيعات ٣٠ يوماً ومدة التوريد وتغطية ٣٠ يوماً، بعد خصم المخزون والمشتريات المفتوحة. دون تعديل موسمي حالياً.",
        )}
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <details className="rounded-2xl border border-border p-4">
        <summary className="cursor-pointer">
          {l("Add supplier", "إضافة مورد")}
        </summary>
        <form onSubmit={createSupplier} className="flex flex-wrap gap-3 mt-4">
          <input
            className={field}
            name="name"
            required
            placeholder={l("Supplier name", "اسم المورد")}
            aria-label={l("Supplier name", "اسم المورد")}
          />
          <input
            className={field}
            type="email"
            name="email"
            placeholder={l("Email", "البريد")}
            aria-label={l("Email", "البريد")}
          />
          <label className="text-sm">
            {l("Lead days", "أيام التوريد")}{" "}
            <input
              name="lead_days"
              type="number"
              min="0"
              max="365"
              defaultValue="14"
              required
              className={`${field} w-24`}
            />
          </label>
          <button disabled={busy} className={field}>
            {l("Save supplier", "حفظ المورد")}
          </button>
        </form>
      </details>
      <section className="rounded-2xl border border-border p-5">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <h2 className="font-semibold">
            {l("Replenishment", "تجديد المخزون")}
          </h2>
          <div className="flex gap-2">
            <select
              className={field}
              aria-label={l("Supplier", "المورد")}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option value="">
                {l(
                  "Choose supplier · 14 day default",
                  "اختر مورداً · ١٤ يوماً افتراضياً",
                )}
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.lead_days}d
                </option>
              ))}
            </select>
            <input
              className={`${field} w-36`}
              placeholder="SKU"
              aria-label="SKU"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  "SKU",
                  l("On hand", "المتاح"),
                  l("Incoming", "القادم"),
                  l("Days left", "الأيام المتبقية"),
                  l("Suggested", "المقترح"),
                  "",
                ].map((h, i) => (
                  <th key={i} className="p-2 text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-2">{s.sku}</td>
                  <td>{s.stock}</td>
                  <td>{s.incoming}</td>
                  <td>{s.days_remaining ?? "—"}</td>
                  <td>{s.suggested_quantity}</td>
                  <td>
                    <button
                      className="text-primary p-2"
                      disabled={lines.some((line) => line.variant_id === s.id)}
                      onClick={() =>
                        setLines([
                          ...lines,
                          {
                            variant_id: s.id,
                            sku: s.sku,
                            quantity: Math.max(1, s.suggested_quantity),
                            unit_cost: 0,
                          },
                        ])
                      }
                    >
                      {l("Add to draft", "إضافة للمسودة")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            className={field}
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            ←
          </button>
          <span className="p-2">
            {page}/{lastPage}
          </span>
          <button
            className={field}
            disabled={page >= lastPage}
            onClick={() => setPage((v) => v + 1)}
          >
            →
          </button>
        </div>
      </section>
      {!!lines.length && (
        <form
          onSubmit={createPurchase}
          className="border border-primary/40 rounded-2xl p-5 space-y-4"
        >
          <h2 className="font-semibold">
            {l(
              "Draft purchase · costs in organization base currency",
              "مسودة شراء · التكاليف بالعملة الأساسية",
            )}
          </h2>
          <input
            className={field}
            name="reference"
            required
            placeholder={l("Unique purchase reference", "مرجع شراء فريد")}
            aria-label={l("Reference", "المرجع")}
          />
          <input
            className={`${field} ms-2`}
            type="date"
            name="expected_at"
            aria-label={l("Expected receipt date", "تاريخ الاستلام المتوقع")}
          />
          {lines.map((line, index) => (
            <div
              key={line.variant_id}
              className="flex flex-wrap gap-3 items-center"
            >
              <span>{line.sku}</span>
              <label className="text-xs">
                {l("Quantity", "الكمية")}{" "}
                <input
                  type="number"
                  required
                  min="1"
                  className={`${field} w-24`}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, i) =>
                        i === index
                          ? { ...v, quantity: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <label className="text-xs">
                {l("Landed unit cost", "التكلفة الإجمالية للوحدة")}{" "}
                <input
                  type="number"
                  required
                  min="0"
                  step="0.0001"
                  className={`${field} w-28`}
                  value={line.unit_cost}
                  onChange={(e) =>
                    setLines(
                      lines.map((v, i) =>
                        i === index
                          ? { ...v, unit_cost: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="text-destructive"
                onClick={() =>
                  setLines(
                    lines.filter((v) => v.variant_id !== line.variant_id),
                  )
                }
              >
                {l("Remove", "إزالة")}
              </button>
            </div>
          ))}
          <button
            disabled={busy || !supplier}
            className={`${field} bg-primary text-primary-foreground`}
          >
            {l("Save draft", "حفظ المسودة")}
          </button>
        </form>
      )}
      <section className="rounded-2xl border border-border p-5">
        <h2 className="font-semibold mb-4">
          {l("Purchase orders", "أوامر الشراء")}
        </h2>
        {purchases.map((p) => (
          <div
            key={p.id}
            className="border-t border-border py-3 flex flex-wrap justify-between gap-3"
          >
            <div>
              {p.reference}
              <p className="text-xs text-muted-foreground">
                {p.status} · {p.currency} ·{" "}
                {p.lines.reduce((sum, line) => sum + (line.received || 0), 0)}/
                {p.lines.reduce((sum, line) => sum + line.quantity, 0)}
              </p>
            </div>
            <div>
              {p.status === "draft" && (
                <button
                  disabled={busy}
                  className={field}
                  onClick={() => post(`/purchase-orders/${p.id}/submit`, {})}
                >
                  {l("Mark ordered", "تسجيل إرسال الطلب")}
                </button>
              )}
              {["ordered", "partial"].includes(p.status) && (
                <button
                  className={field}
                  onClick={() => {
                    setSelected(p);
                    setReceiveQty({});
                    receiveKey.current = "";
                  }}
                >
                  {l("Receive stock", "استلام المخزون")}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-3">
          <button
            className={field}
            disabled={poPage === 1}
            onClick={() => setPoPage((v) => v - 1)}
          >
            ←
          </button>
          <span className="p-2">
            {poPage}/{poLastPage}
          </span>
          <button
            className={field}
            disabled={poPage >= poLastPage}
            onClick={() => setPoPage((v) => v + 1)}
          >
            →
          </button>
        </div>
      </section>
      {selected && (
        <section className="border border-primary rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">
            {l("Receive against", "استلام مقابل")} {selected.reference}
          </h2>
          <p className="text-sm text-muted-foreground">
            {l(
              "Record only quantities received now. This updates stock and records FIFO cost layers. Do not receive the same delivery again in the warehouse page.",
              "سجل الكميات المستلمة الآن فقط. يتم تحديث المخزون وتسجيل طبقات التكلفة. لا تسجل نفس الشحنة مجدداً في صفحة المخزن.",
            )}
          </p>
          {selected.lines
            .filter((line) => line.quantity > (line.received || 0))
            .map((line) => (
              <label key={line.variant_id} className="flex items-center gap-3">
                {line.sku} · {line.quantity - (line.received || 0)}{" "}
                {l("remaining", "متبقي")}
                <input
                  type="number"
                  min="0"
                  max={line.quantity - (line.received || 0)}
                  value={receiveQty[line.variant_id] || ""}
                  onChange={(e) =>
                    setReceiveQty({
                      ...receiveQty,
                      [line.variant_id]: e.target.value,
                    })
                  }
                  className={`${field} w-24`}
                />
              </label>
            ))}
          <button
            disabled={
              busy || !Object.values(receiveQty).some((q) => Number(q) > 0)
            }
            onClick={receive}
            className={`${field} bg-primary text-primary-foreground`}
          >
            {l("Confirm receipt", "تأكيد الاستلام")}
          </button>
          <button onClick={() => setSelected(null)} className={`${field} ms-2`}>
            {l("Close", "إغلاق")}
          </button>
        </section>
      )}
    </div>
  );
}

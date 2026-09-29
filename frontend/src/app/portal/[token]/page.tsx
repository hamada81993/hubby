"use client";
import { use, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
type Portal = {
  store: string;
  reference: string;
  status: string;
  can_return: boolean;
  items: { id: number; name: string; quantity: number }[];
  shipments: {
    status: string;
    tracking_number: string;
    events: {
      status: string;
      description_en: string;
      description_ar: string;
      event_at: string;
    }[];
  }[];
  requests: { rma_number: string; status: string; type: string }[];
};
export default function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [ar, setAr] = useState(false);
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [type, setType] = useState("customer_return");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const key = useRef("");
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  useEffect(() => {
    const c = new AbortController();
    fetch(`${base}/customer-portal/${token}`, {
      signal: c.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => {
        if (!c.signal.aborted)
          setError("Link expired or unavailable. / الرابط منتهي أو غير متاح.");
      });
    return () => c.abort();
  }, [base, token]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    key.current ||= crypto.randomUUID();
    try {
      const r = await fetch(`${base}/customer-portal/${token}/returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          request_id: key.current,
          type,
          reason,
          lines: Object.entries(qty)
            .filter(([, q]) => Number(q) > 0)
            .map(([id, q]) => ({
              order_item_id: Number(id),
              quantity: Number(q),
            })),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message);
      setResult(body.rma_number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  const field = "rounded-xl border border-border bg-background p-3 text-sm";
  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      className="theme-light bg-background text-foreground min-h-screen w-full max-w-3xl mx-auto p-5 md:p-10 space-y-7"
    >
      <meta name="referrer" content="no-referrer" />
      <meta name="robots" content="noindex,nofollow" />
      <header className="flex justify-between items-center">
        <Logo variant="color" className="h-8 w-auto" />
        <button className={field} onClick={() => setAr(!ar)}>
          {ar ? "English" : "العربية"}
        </button>
      </header>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {data ? (
        <>
          <div>
            <p className="text-primary text-sm">{data.store}</p>
            <h1 className="text-3xl font-bold mt-2">
              {ar ? "تابع طلبك" : "Your order, at a glance."}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {data.reference} · {data.status}
            </p>
          </div>
          {data.shipments.map((s, i) => (
            <section key={i} className="border border-border rounded-2xl p-5">
              <h2 className="font-semibold">
                {s.status} · {s.tracking_number}
              </h2>
              <ol className="mt-4 space-y-4">
                {s.events.map((ev, j) => (
                  <li key={j} className="border-s-2 border-primary ps-4">
                    <p className="text-sm">
                      {(ar ? ev.description_ar : ev.description_en) ||
                        ev.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.event_at).toLocaleString(ar ? "ar" : "en")}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <section className="border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">
              {ar ? "طلب إرجاع أو استبدال" : "Request a return or exchange"}
            </h2>
            {result ? (
              <p role="status" className="text-primary">
                {ar
                  ? "تم إرسال طلبك للمراجعة"
                  : "Your request is awaiting store review"}{" "}
                · {result}
              </p>
            ) : data.can_return ? (
              <form onSubmit={submit} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "خلال ٣٠ يوماً من التوصيل المؤكد. تخضع الطلبات لموافقة المتجر."
                    : "Within 30 days of confirmed delivery. Requests are subject to store approval."}
                </p>
                {data.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex justify-between items-center gap-3 text-sm"
                  >
                    {item.name}
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={qty[item.id] || ""}
                      onChange={(e) => {
                        setQty({ ...qty, [item.id]: e.target.value });
                        key.current = "";
                      }}
                      className={`${field} w-24`}
                      aria-label={`${item.name} quantity`}
                    />
                  </label>
                ))}
                <select
                  aria-label={ar ? "نوع الطلب" : "Request type"}
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    key.current = "";
                  }}
                  className={field}
                >
                  <option value="customer_return">
                    {ar ? "إرجاع" : "Return"}
                  </option>
                  <option value="exchange">
                    {ar ? "استبدال" : "Exchange"}
                  </option>
                </select>
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    key.current = "";
                  }}
                  placeholder={
                    ar
                      ? "سبب الطلب، وتفاصيل الاستبدال إن وجدت"
                      : "Reason, including desired replacement for an exchange"
                  }
                  aria-label={ar ? "السبب" : "Reason"}
                  className={`${field} w-full`}
                />
                <button
                  disabled={
                    busy || !Object.values(qty).some((q) => Number(q) > 0)
                  }
                  className={`${field} bg-primary text-primary-foreground disabled:opacity-40`}
                >
                  {ar ? "إرسال للمراجعة" : "Submit for review"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "الإرجاع الذاتي متاح خلال ٣٠ يوماً من التوصيل المؤكد. تواصل مع المتجر للمساعدة."
                  : "Self-service returns require confirmed delivery within the last 30 days. Contact the store for assistance."}
              </p>
            )}
          </section>
          {data.requests.length > 0 && (
            <section>
              <h2 className="font-semibold">
                {ar ? "طلباتك السابقة" : "Your requests"}
              </h2>
              {data.requests.map((r) => (
                <p key={r.rma_number} className="py-3 text-sm">
                  {r.rma_number} · {r.type} · {r.status}
                </p>
              ))}
            </section>
          )}
        </>
      ) : (
        !error && <p>{ar ? "جارٍ التحميل…" : "Loading your order…"}</p>
      )}
    </main>
  );
}

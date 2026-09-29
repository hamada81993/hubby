"use client";
import { useRef, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n";
type Pack = {
  id: number;
  status: string;
  items?: {
    id: number;
    sku: string;
    qty_required: number;
    qty_packed: number;
  }[];
};
export default function PackingStation() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [order, setOrder] = useState("");
  const [pack, setPack] = useState<Pack | null>(null);
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scanId = useRef("");
  const refresh = async (id: number) => {
    const r = await api.get(`/pack-sessions/${id}`);
    setPack(r.data);
  };
  const post = async (url: string, data: unknown) => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(url, data);
      await refresh(r.data.id || pack?.id);
      return true;
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || (ar ? "تعذر التنفيذ" : "Action failed"),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => {
    if (!pack) return;
    scanId.current ||= crypto.randomUUID();
    if (
      await post(`/pack-sessions/${pack.id}/scan`, {
        uuid: scanId.current,
        barcode,
        qty: 1,
      })
    ) {
      scanId.current = "";
      setBarcode("");
    }
  };
  return (
    <details className="border border-border rounded-2xl p-5">
      <summary className="font-semibold cursor-pointer">
        {ar ? "محطة التعبئة" : "Packing station"}
      </summary>
      <form
        className="flex flex-wrap gap-3 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void post("/pack-sessions", { order_id: Number(order) });
        }}
      >
        <input
          required
          type="number"
          min="1"
          aria-label={ar ? "رقم الطلب" : "Order ID"}
          placeholder={ar ? "رقم الطلب" : "Order ID"}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="border border-border bg-background rounded-xl p-3"
        />
        <button disabled={busy} className="text-primary text-sm">
          {ar ? "فتح التعبئة" : "Open packing"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm mt-3">
          {error}
        </p>
      )}
      {pack && (
        <div className="mt-4 space-y-3">
          <p>
            #{pack.id} · {pack.status}
          </p>
          {pack.items?.map((line) => (
            <p key={line.id} className="text-sm">
              {line.sku} · {line.qty_packed}/{line.qty_required}
            </p>
          ))}
          {pack.status !== "completed" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void scan();
                }}
                className="flex gap-3"
              >
                <input
                  required
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    scanId.current = "";
                  }}
                  aria-label={ar ? "باركود التعبئة" : "Packing barcode"}
                  placeholder={ar ? "امسح وحدة واحدة" : "Scan one unit"}
                  className="border border-border bg-background rounded-xl p-3"
                />
                <button disabled={busy} className="text-primary text-sm">
                  {ar ? "تحقق من الوحدة" : "Verify unit"}
                </button>
              </form>
              <button
                disabled={busy}
                onClick={() => post(`/pack-sessions/${pack.id}/complete`, {})}
                className="border border-border rounded-xl p-3 text-sm"
              >
                {ar ? "إكمال التعبئة" : "Complete packing"}
              </button>
            </>
          )}
        </div>
      )}
    </details>
  );
}

"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n";
export default function CustomerPortalLink({ orderId }: { orderId: number }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.post(`/orders/${orderId}/portal`);
      setUrl(window.location.origin + r.data.path);
    } catch {
      setError(ar ? "تعذر إنشاء الرابط" : "Could not create link");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border border-border rounded-xl p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          onClick={create}
          className="text-sm text-primary"
        >
          {ar ? "إنشاء رابط تتبع ومرتجعات" : "Generate tracking & returns link"}
        </button>
        <span className="text-xs text-muted-foreground">
          {ar
            ? "صالح ٣٠ يوماً. إنشاء رابط جديد يلغي السابق."
            : "Valid for 30 days. A new link revokes the previous one."}
        </span>
      </div>
      {url && (
        <input
          readOnly
          value={url}
          aria-label={ar ? "رابط العميل" : "Customer link"}
          onFocus={(e) => e.target.select()}
          className="w-full mt-3 bg-background border border-border rounded-lg p-2 text-xs"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

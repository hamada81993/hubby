"use client";
import { FormEvent, useEffect, useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/store/auth";
type Statement = {
  id: number;
  status: string;
  rows: {
    awb: string;
    currency: string;
    amount: string;
    expected: string | null;
    status: string;
  }[];
};
export default function CodStatements() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const org = useAuthStore((s) => s.activeOrgId);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [history, setHistory] = useState<
    { id: number; reference: string; rows: string; status: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatement(null);
    setHistory([]);
    api
      .get("/cod/statements", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setHistory(r.data.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [org, version]);
  const preview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/cod/statements", form);
      setStatement(r.data);
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || (ar ? "تعذر الاستيراد" : "Import failed"),
      );
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!statement) return;
    setBusy(true);
    setError("");
    try {
      const r = await api.post(`/cod/statements/${statement.id}/apply`);
      setStatement(r.data);
    } catch {
      setError(
        ar ? "تعذر التطبيق. أعد المحاولة." : "Could not apply. Retry safely.",
      );
    } finally {
      setBusy(false);
    }
  };
  const input =
    "border border-border rounded-lg px-3 py-2 bg-background text-sm";
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h2 className="font-semibold text-lg">
        {ar ? "مطابقة كشف التحصيل" : "Statement reconciliation"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "استورد CSV بأعمدة awb,currency,amount. المبلغ هو التحصيل الإجمالي قبل رسوم شركة الشحن. تتم معاينة المطابقات قبل التطبيق."
          : "Import CSV with columns awb,currency,amount. Use gross COD remittance before carrier fees. Preview matches before applying."}
      </p>
      <form onSubmit={preview} className="flex flex-wrap gap-3">
        <input
          className={input}
          name="carrier_code"
          required
          maxLength={50}
          aria-label={ar ? "رمز شركة الشحن" : "Carrier code"}
          placeholder={ar ? "رمز شركة الشحن" : "Carrier code"}
        />
        <input
          className={input}
          name="reference"
          required
          maxLength={100}
          aria-label={ar ? "مرجع الكشف" : "Statement reference"}
          placeholder={ar ? "مرجع الكشف الفريد" : "Unique statement reference"}
        />
        <input
          type="file"
          name="file"
          required
          accept=".csv,text/csv"
          aria-label={ar ? "ملف الكشف" : "Statement CSV"}
          className="text-sm max-w-full"
        />
        <button
          disabled={busy}
          className={`${input} text-primary disabled:opacity-40`}
        >
          {ar ? "معاينة" : "Preview"}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {statement && (
        <>
          <p className="text-sm">
            #{statement.id} · {statement.status}
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr>
                  {[
                    "AWB",
                    ar ? "المبلغ" : "Amount",
                    ar ? "المتوقع" : "Expected",
                    ar ? "الحالة" : "Status",
                  ].map((h) => (
                    <th key={h} className="text-start p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statement.rows.map((row) => (
                  <tr key={row.awb} className="border-t border-border">
                    <td className="p-2">{row.awb}</td>
                    <td>
                      {row.amount} {row.currency}
                    </td>
                    <td>{row.expected ?? "—"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {statement.status === "preview" && (
            <button
              disabled={
                busy || !statement.rows.some((r) => r.status === "matched")
              }
              onClick={apply}
              className={`${input} bg-primary text-primary-foreground disabled:opacity-40`}
            >
              {ar ? "تطبيق المطابقات التامة فقط" : "Apply exact matches only"}
            </button>
          )}
        </>
      )}
      <details>
        <summary className="cursor-pointer text-sm">
          {ar ? "الكشوف السابقة" : "Recent statements"}
        </summary>
        <button
          onClick={() => setVersion((v) => v + 1)}
          className="text-xs text-primary p-2"
        >
          {ar ? "تحديث" : "Refresh"}
        </button>
        {history.map((s) => (
          <button
            key={s.id}
            className="block py-2 text-sm"
            onClick={() =>
              setStatement({
                id: s.id,
                status: s.status,
                rows: JSON.parse(s.rows),
              })
            }
          >
            {s.reference} · {s.status}
          </button>
        ))}
      </details>
    </section>
  );
}

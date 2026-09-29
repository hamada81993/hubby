"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
type Filters = { search: string; platform: string; status: string };
export default function OrderWorkspaceTools({
  filters,
  apply,
  selected,
  clear,
}: {
  filters: Filters;
  apply: (f: Filters) => void;
  selected: number[];
  clear: () => void;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const org = useAuthStore((s) => s.activeOrgId);
  const user = useAuthStore((s) => s.user?.id);
  const key = `hubby-order-views-${user}-${org}`;
  const [views, setViews] = useState<{ name: string; filters: Filters }[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      setViews(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      setViews([]);
    }
  }, [key]);
  const save = () => {
    if (!name.trim()) return;
    const next = [
      ...views.filter((v) => v.name !== name.trim()),
      { name: name.trim(), filters },
    ].slice(-20);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setViews(next);
      setName("");
    } catch {
      setMessage(ar ? "تعذر حفظ العرض" : "Could not save view");
    }
  };
  const remove = (name: string) => {
    const next = views.filter((v) => v.name !== name);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setViews(next);
    } catch {
      setMessage(ar ? "تعذر حذف العرض" : "Could not delete view");
    }
  };
  const pick = async () => {
    setBusy(true);
    setMessage("");
    try {
      await api.post("/pick-lists", { order_ids: selected });
      clear();
      router.push("/warehouse");
    } catch (e) {
      setMessage(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ||
          (ar ? "تعذر إنشاء قائمة التجهيز" : "Could not create pick list"),
      );
    } finally {
      setBusy(false);
    }
  };
  const field =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={field}
          maxLength={60}
          aria-label={ar ? "اسم العرض" : "View name"}
          placeholder={ar ? "اسم العرض المحفوظ" : "Name this filter view"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={field} onClick={save} disabled={!name.trim()}>
          {ar ? "حفظ العرض" : "Save view"}
        </button>
        <span className="text-xs text-muted-foreground self-center">
          {ar
            ? "محفوظ لهذا الحساب والمتجر في هذا المتصفح"
            : "Saved for this user and organization in this browser"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <span key={v.name} className="rounded-lg border border-border">
            <button
              onClick={() => apply(v.filters)}
              className="p-2 text-sm text-primary"
            >
              {v.name}
            </button>
            <button
              aria-label={`${ar ? "حذف" : "Delete"} ${v.name}`}
              onClick={() => remove(v.name)}
              className="px-2"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-sm">
            {selected.length} {ar ? "طلب محدد" : "orders selected"}
          </span>
          <button
            disabled={busy || selected.length > 50}
            className={`${field} text-primary`}
            onClick={pick}
          >
            {ar ? "إنشاء قائمة تجهيز" : "Create pick list"}
          </button>
          <button className={field} onClick={clear}>
            {ar ? "إلغاء التحديد" : "Clear selection"}
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

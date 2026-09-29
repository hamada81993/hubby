"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";

type Channel = {
  id: number;
  name: string;
  is_master: boolean;
  safety_stock: number;
};

export default function ChannelBuffers() {
  const org = useAuthStore((s) => s.activeOrgId);
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [channels, setChannels] = useState<Channel[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<Channel[]>("/stores", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) {
          setChannels(r.data);
          setDrafts({});
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(ar ? "تعذر تحميل القنوات" : "Could not load channels");
      });
    return () => controller.abort();
  }, [org, ar]);

  const save = async (channel: Channel) => {
    setBusy(channel.id);
    setMessage("");
    try {
      const r = await api.put(`/stores/${channel.id}/safety-stock`, {
        safety_stock: Number(drafts[channel.id] ?? channel.safety_stock),
      });
      setChannels((rows) =>
        rows.map((row) =>
          row.id === channel.id
            ? { ...row, safety_stock: r.data.safety_stock }
            : row,
        ),
      );
      setMessage(
        ar
          ? "تم الحفظ. سيطبق على عمليات تحديث المخزون القادمة."
          : "Saved. Applies to subsequent stock pushes.",
      );
    } catch (e) {
      setMessage(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || (ar ? "تعذر الحفظ" : "Could not save"),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="border border-border rounded-2xl p-5">
      <summary className="cursor-pointer font-semibold">
        {ar ? "مخزون الأمان للقنوات" : "Channel safety stock"}
      </summary>
      <p className="text-sm text-muted-foreground mt-3">
        {ar
          ? "احتفظ بعدد ثابت من الوحدات خارج الكمية المنشورة لكل صنف في القناة. الكمية المنشورة لا تقل عن صفر. لا يطبق هذا على المتجر الرئيسي."
          : "Withhold a fixed number of units per SKU from each channel’s published quantity, with a minimum published quantity of zero. The master store remains unchanged."}
      </p>
      <div className="space-y-3 mt-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="flex flex-wrap gap-3 items-center justify-between"
          >
            <span className="text-sm">{channel.name}</span>
            {channel.is_master ? (
              <span className="text-xs text-muted-foreground">
                {ar ? "المصدر الرئيسي للمخزون" : "Authoritative master"}
              </span>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(channel);
                }}
                className="flex gap-2"
              >
                <input
                  type="number"
                  required
                  min="0"
                  max="100000"
                  step="1"
                  aria-label={`${channel.name} ${ar ? "مخزون الأمان" : "safety stock"}`}
                  value={drafts[channel.id] ?? channel.safety_stock ?? 0}
                  onChange={(e) =>
                    setDrafts({ ...drafts, [channel.id]: e.target.value })
                  }
                  className="w-24 rounded-lg border border-border bg-background p-2 text-sm"
                />
                <button
                  disabled={busy !== null}
                  className="rounded-lg border border-border p-2 text-sm text-primary"
                >
                  {ar ? "حفظ" : "Save"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm mt-3">
          {message}
        </p>
      )}
    </details>
  );
}

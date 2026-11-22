"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";
import { PlatformLogo } from "@/components/ui/PlatformLogo";

type Mode = "shared" | "split" | "manual";
type Channel = {
  id: number;
  name: string;
  platform: string;
  allocation_percent: number | null;
  effective_percent: number;
};

/**
 * How the stock is offered to the sales channels: the whole number everywhere,
 * divided between them, or set by hand per listing. The example under each
 * option uses 100 units so the difference is plain.
 */
export default function StockAllocation() {
  const org = useAuthStore((s) => s.activeOrgId);
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const [mode, setMode] = useState<Mode>("shared");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/stock-allocation", { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        setMode(r.data.mode);
        setChannels(r.data.channels ?? []);
        setDrafts({});
      })
      .catch(() => {});
    return () => controller.abort();
  }, [org]);

  const value = (c: Channel) => drafts[c.id] ?? (c.allocation_percent === null ? "" : String(c.allocation_percent));
  const total = channels.reduce((sum, c) => sum + (Number(value(c)) || 0), 0);
  const anySet = channels.some((c) => value(c) !== "");
  const over = total > 100;

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const percents = Object.fromEntries(channels.map((c) => [c.id, value(c) === "" ? null : Number(value(c))]));
      const r = await api.put("/stock-allocation", { mode, percents });
      setChannels(r.data.channels ?? []);
      setDrafts({});
      setMessage({ ok: true, text: l("Saved. Each product follows it from its next stock update.", "تم الحفظ. يطبق على كل منتج عند تحديث مخزونه القادم.") });
    } catch (e: unknown) {
      const reason = (e as { response?: { data?: { message?: string }; status?: number } }).response;
      setMessage({
        ok: false,
        text: reason?.status === 403
          ? l("Only an owner or admin can change this.", "هذا الإعداد للمالك أو المدير فقط.")
          : reason?.data?.message ?? l("Could not save. Try again.", "تعذر الحفظ. حاول مرة أخرى."),
      });
    } finally {
      setBusy(false);
    }
  };

  const options: { id: Mode; title: string; body: string; example: string }[] = [
    {
      id: "shared",
      title: l("Same stock everywhere", "نفس المخزون في كل مكان"),
      body: l("Every channel shows the full quantity. One sale lowers it on all of them.", "كل قناة تعرض الكمية كاملة. أي بيع يُنقصها في الجميع."),
      example: l("100 in stock → 100 on each channel", "100 في المخزن ← 100 في كل قناة"),
    },
    {
      id: "split",
      title: l("Divide it between channels", "قسّمه بين القنوات"),
      body: l("Each channel gets a share. Together they never show more than you have.", "لكل قناة نصيب. مجموعها لا يتجاوز ما لديك أبداً."),
      example: l("100 in stock → 50 / 30 / 20", "100 في المخزن ← 50 / 30 / 20"),
    },
    {
      id: "manual",
      title: l("Set each one yourself", "حدّد كل قناة بنفسك"),
      body: l("Choose the quantity per product and channel, above or below your stock.", "اختر الكمية لكل منتج وقناة، أكثر أو أقل من مخزونك."),
      example: l("Set on each product's page", "تُحدد من صفحة كل منتج"),
    },
  ];

  return (
    <section className="rounded-[28px] border border-border bg-card p-6">
      <h2 className="text-lg font-bold">{l("How stock is shared", "طريقة توزيع المخزون")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {l("Your master store holds the real number. This decides what each sales channel is told.", "متجرك الرئيسي يحمل الرقم الحقيقي. هذا الإعداد يحدد ما يُعرض في كل قناة بيع.")}
      </p>

      <div role="radiogroup" aria-label={l("How stock is shared", "طريقة توزيع المخزون")} className="mt-5 grid gap-3 lg:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={mode === o.id}
            onClick={() => setMode(o.id)}
            className={cn(
              "flex flex-col gap-2 rounded-[20px] border p-4 text-start transition-colors",
              mode === o.id ? "border-primary bg-accent" : "border-border hover:bg-accent",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{o.title}</span>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", mode === o.id ? "border-action bg-action text-action-foreground" : "border-border")}>
                {mode === o.id && <Check size={13} strokeWidth={3} />}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{o.body}</span>
            <span className="mt-auto pt-1 text-xs font-bold tabular-nums text-primary">{o.example}</span>
          </button>
        ))}
      </div>

      {mode === "shared" && (
        <p className="mt-4 rounded-2xl bg-caution/15 px-4 py-3 text-sm text-caution">
          {l(
            "If the last unit sells on two channels in the same minute, one of those orders cannot be filled. Channel safety stock, below, holds a few units back to prevent that.",
            "إذا بيعت آخر قطعة في قناتين في الدقيقة نفسها فلن يمكن تنفيذ أحد الطلبين. مخزون الأمان للقنوات، بالأسفل، يحجز بضع قطع لمنع ذلك.",
          )}
        </p>
      )}

      {mode === "split" && (
        <div className="mt-5">
          {channels.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {channels.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <PlatformLogo platform={c.platform} size={18} />
                  <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
                  {!anySet && <span className="text-xs text-muted-foreground tabular-nums">{c.effective_percent}%</span>}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      inputMode="numeric"
                      aria-label={l(`Share for ${c.name}`, `نصيب ${c.name}`)}
                      value={value(c)}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                      className="h-10 w-20 rounded-xl border border-border bg-background px-3 text-end font-bold text-foreground tabular-nums"
                    />
                    %
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{l("Connect a sales channel to give it a share.", "اربط قناة بيع لتعطيها نصيباً.")}</p>
          )}
          <p className={cn("mt-3 text-sm", over ? "font-bold text-negative" : "text-muted-foreground")}>
            {!anySet
              ? l("Leave them empty to split evenly.", "اتركها فارغة للتقسيم بالتساوي.")
              : over
                ? l(`The shares add up to ${total}%. Bring them down to 100% or less.`, `مجموع الأنصبة ${total}%. اجعله 100% أو أقل.`)
                : l(`${total}% shared out, ${100 - total}% held back.`, `تم توزيع ${total}%، واحتجاز ${100 - total}%.`)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {l("Shares round down. A channel that sells out does not borrow from the others.", "الأنصبة تُقرّب للأسفل. القناة التي ينفد نصيبها لا تأخذ من غيرها.")}
          </p>
        </div>
      )}

      {mode === "manual" && (
        <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          {l(
            "Open a product and set the quantity next to each channel. A sale on a channel uses up its number. A product you have not set shows your full stock. A quantity above your stock means selling units you do not have yet.",
            "افتح المنتج وحدّد الكمية بجوار كل قناة. البيع في قناة يُنقص رقمها. المنتج الذي لم تحدده يعرض مخزونك كاملاً. كمية أعلى من مخزونك تعني بيع قطع ليست لديك بعد.",
          )}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || (mode === "split" && over)}
          className="inline-flex h-11 items-center rounded-xl bg-action px-5 text-sm font-bold text-action-foreground transition hover:bg-action/90 disabled:opacity-50"
        >
          {busy ? l("Saving…", "جارٍ الحفظ…") : l("Save", "حفظ")}
        </button>
        {message && <p role="status" className={cn("text-sm", message.ok ? "text-positive" : "text-negative")}>{message.text}</p>}
      </div>
    </section>
  );
}

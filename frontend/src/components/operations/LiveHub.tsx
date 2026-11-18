"use client";

import { useEffect, useRef } from "react";
import { PlatformLogo } from "@/components/ui/PlatformLogo";
import { getPlatform } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export type HubStore = {
  id: number;
  name: string;
  platform: string;
  state: string;
  /** Net revenue in the selected period; null when the report is unavailable. */
  revenue: number | null;
};

// Stage geometry, in viewBox units. Cards are placed with the same numbers as
// percentages, so the stage keeps this aspect ratio at every width.
const W = 760;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const RX = 262;
const RY = 222;
const ANGLES: Record<number, number[]> = {
  1: [-90],
  2: [-158, 22],
  3: [-150, -30, 90],
  4: [-140, -40, 40, 140],
  5: [-140, -40, 40, 140, 90],
  6: [-150, -90, -30, 30, 90, 150],
};
const MAX_NODES = 6;
const MARKS = new Set(["amazon", "noon", "salla", "shopify", "zid"]);

function PlatformMark({ platform }: { platform: string }) {
  const id = platform.toLowerCase();
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white">
      {MARKS.has(id) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/platforms/marks/${id}.svg`} alt="" className="h-7 w-7 object-contain" />
      ) : (
        <PlatformLogo platform={id} size={16} />
      )}
    </span>
  );
}

/**
 * The live hub: every connected store around one centre. A line's thickness is
 * that store's share of revenue in the period, and pulses travel along it
 * towards the hub (faster for the busier stores).
 */
export default function LiveHub({
  stores,
  centreValue,
  centreLabel,
  ariaLabel,
  stateLabel,
  shareLabel,
  moreLabel,
}: {
  stores: HubStore[];
  centreValue: string;
  centreLabel: string;
  ariaLabel: string;
  stateLabel: (state: string) => { text: string; ok: boolean };
  /** Caption for a store's share of revenue, given a whole percentage. */
  shareLabel: (percent: number) => string;
  moreLabel: (count: number) => string;
}) {
  const ranked = [...stores].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
  const shown = ranked.slice(0, MAX_NODES);
  const hidden = ranked.length - shown.length;
  const top = Math.max(...shown.map((s) => s.revenue ?? 0), 0);
  const total = stores.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
  const caption = (store: HubStore) =>
    store.revenue === null || total <= 0
      ? getPlatform(store.platform).name
      : shareLabel(Math.round((store.revenue / total) * 100));
  const angles = ANGLES[shown.length] ?? [];

  const nodes = shown.map((store, i) => {
    const angle = (angles[i] * Math.PI) / 180;
    // The fifth store sits straight below the centre and needs a little more room.
    const reach = shown.length === 5 && i === 4 ? 1.08 : 1;
    const x = CX + RX * Math.cos(angle);
    const y = CY + RY * reach * Math.sin(angle);
    const weight = top > 0 ? (store.revenue ?? 0) / top : 0.4;
    // Bend each line a little, always the same way round, so they read as a flow.
    const mx = (x + CX) / 2 - (y - CY) * 0.16;
    const my = (y + CY) / 2 + (x - CX) * 0.16;
    return {
      store,
      x,
      y,
      weight,
      path: `M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${CX} ${CY}`,
    };
  });

  // The stores float: each card drifts a few pixels on its own beat, and its
  // line and pulses follow it. Written straight to the DOM so React does not
  // re-render sixty times a second; skipped when the viewer asks for less motion.
  const stage = useRef<HTMLDivElement>(null);
  const layout = useRef(nodes);
  layout.current = nodes;
  useEffect(() => {
    const el = stage.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      const scale = el.clientWidth / W;
      const cards = el.querySelectorAll<HTMLElement>("[data-hub-card]");
      const lines = el.querySelectorAll<SVGPathElement>("[data-hub-line]");
      layout.current.forEach((n, i) => {
        const phase = i * 1.3;
        const dx = Math.sin(t * 0.45 + phase * 2) * 2;
        const dy = Math.sin(t * 0.9 + phase) * 7;
        const x = n.x + dx;
        const y = n.y + dy;
        const mx = (x + CX) / 2 - (y - CY) * 0.16;
        const my = (y + CY) / 2 + (x - CX) * 0.16;
        if (cards[i]) cards[i].style.transform = `translate(${(dx * scale).toFixed(2)}px, ${(dy * scale).toFixed(2)}px)`;
        lines[i]?.setAttribute("d", `M${x.toFixed(1)} ${y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${CX} ${CY}`);
        const dur = 5 - n.weight * 2.8;
        el.querySelectorAll<SVGCircleElement>(`[data-hub-pulse="${i}"]`).forEach((dot, k) => {
          const u = (t / dur + k * 0.5 + phase) % 1;
          const v = 1 - u;
          dot.setAttribute("cx", (v * v * x + 2 * v * u * mx + u * u * CX).toFixed(1));
          dot.setAttribute("cy", (v * v * y + 2 * v * u * my + u * u * CY).toFixed(1));
          dot.setAttribute("opacity", "1");
        });
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      aria-label={ariaLabel}
      className="hub-stage relative overflow-hidden rounded-[28px] border border-border"
    >
      {/* Wide screens: the hub itself. */}
      <div ref={stage} className="relative hidden sm:block" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full"
        >
          <circle cx={CX} cy={CY} r={170} fill="none" stroke="var(--action)" strokeOpacity={0.14} strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={270} fill="none" stroke="var(--action)" strokeOpacity={0.1} strokeWidth={1.5} strokeDasharray="3 9" />
          <g fill="none" stroke="var(--action)" strokeLinecap="round" strokeOpacity={0.55}>
            {nodes.map((n) => (
              <path key={n.store.id} data-hub-line d={n.path} strokeWidth={2.5 + n.weight * 7.5} />
            ))}
          </g>
          <g fill="var(--hub-pulse)">
            {nodes.map((n, i) =>
              (n.weight > 0.6 ? [0, 1] : [0]).map((k) => (
                <circle key={`${n.store.id}-${k}`} data-hub-pulse={i} r={3.5 + n.weight * 1.5} opacity={0} />
              )),
            )}
          </g>
          <circle cx={CX} cy={CY} r={128} fill="var(--action)" fillOpacity={0.16} className="hb-breathe" />
          <circle cx={CX} cy={CY} r={104} fill="var(--action)" />
        </svg>

        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center text-action-foreground"
          style={{ left: "50%", top: "50%", width: `${(190 / W) * 100}%` }}
        >
          <span className="text-[clamp(2rem,4.4vw,3.5rem)] font-black leading-none tracking-[-0.03em] tabular-nums">
            {centreValue}
          </span>
          <span className="mt-1 text-[clamp(0.7rem,1.1vw,0.875rem)] font-bold leading-tight">{centreLabel}</span>
        </div>

        {nodes.map((n, i) => {
          const state = stateLabel(n.store.state);
          return (
            <div
              key={n.store.id}
              data-hub-card
              className="absolute w-[31%] min-w-[160px] -translate-x-1/2 -translate-y-1/2 will-change-transform"
              style={{ left: `${(n.x / W) * 100}%`, top: `${(n.y / H) * 100}%` }}
            >
            <div
              className="hb-rise flex items-center gap-3 rounded-[20px] border border-border bg-card p-3"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <PlatformMark platform={n.store.platform} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span dir="auto" className="truncate text-start font-bold">{n.store.name}</span>
                <span className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="truncate text-muted-foreground">{caption(n.store)}</span>
                  <span className={cn("shrink-0 text-xs font-bold", state.ok ? "text-positive" : "text-negative")}>
                    {state.text}
                  </span>
                </span>
              </span>
            </div>
            </div>
          );
        })}

        {hidden > 0 && (
          <span className="absolute bottom-3 end-4 text-xs font-medium text-muted-foreground">
            {moreLabel(hidden)}
          </span>
        )}
      </div>

      {/* Phones: the same numbers as a list. */}
      <div className="p-4 sm:hidden">
        <div className="flex items-center gap-4 rounded-[20px] bg-action p-4 text-action-foreground">
          <span className="text-5xl font-black leading-none tracking-[-0.03em] tabular-nums">{centreValue}</span>
          <span className="text-sm font-bold leading-tight">{centreLabel}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {ranked.map((store) => {
            const state = stateLabel(store.state);
            return (
              <li key={store.id} className="flex items-center gap-3 rounded-[18px] border border-border bg-card p-3">
                <PlatformMark platform={store.platform} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{store.name}</span>
                  <span className="truncate text-[13px] text-muted-foreground">{caption(store)}</span>
                </span>
                <span className={cn("shrink-0 text-xs font-bold", state.ok ? "text-positive" : "text-negative")}>
                  {state.text}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

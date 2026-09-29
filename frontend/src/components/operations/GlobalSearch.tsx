"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/i18n";

export default function GlobalSearch() {
  const { locale } = useI18n();
  const org = useAuthStore((s) => s.activeOrgId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { label: string; type: string; href: string }[]
  >([]);
  const [state, setState] = useState("idle");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, [org]);
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    if (query.trim().length < 2) return () => controller.abort();
    setState("loading");
    const timer = setTimeout(() => {
      api
        .get("/search", {
          params: { q: query.trim() },
          signal: controller.signal,
        })
        .then((r) => {
          if (!controller.signal.aborted) {
            setResults(r.data);
            setState("ready");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setState("error");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, org]);
  const ar = locale === "ar";
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Search
        size={17}
        className="absolute start-3 top-3 text-muted-foreground"
      />
      <input
        aria-label={ar ? "بحث شامل" : "Global search"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={
          ar
            ? "ابحث عن طلب أو منتج أو شحنة…"
            : "Search orders, products, tracking…"
        }
        className="rounded-full border border-border bg-background py-2 ps-9 pe-3 text-sm w-40 md:w-72"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute start-0 top-full mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-border bg-card shadow-xl p-2 z-50">
          {results.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg p-3 hover:bg-accent text-sm"
            >
              <span className="block text-xs text-muted-foreground">
                {r.type}
              </span>
              {r.label}
            </Link>
          ))}
          {!results.length && (
            <p role="status" className="p-3 text-sm">
              {state === "loading"
                ? ar
                  ? "جارٍ البحث…"
                  : "Searching…"
                : state === "error"
                  ? ar
                    ? "تعذر البحث"
                    : "Search unavailable"
                  : ar
                    ? "لا توجد نتائج"
                    : "No results"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

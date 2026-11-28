'use client';

import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/i18n';

/**
 * Upload a sheet (CSV, which Excel opens and saves) to an import endpoint, with a template
 * to start from. Reports how many rows were saved and which lines were skipped.
 */
export default function SheetUpload({ endpoint, template, templateName, onDone }: {
  endpoint: string;
  /** The template's content: a header line and one example row. */
  template: string;
  templateName: string;
  onDone: () => void;
}) {
  const { locale } = useI18n();
  const l = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post(endpoint, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      const skipped = data.skipped
        ? l(` ${data.skipped} skipped (lines ${data.skipped_lines.join(', ')}): unknown SKU, store or value.`, ` تم تخطي ${data.skipped} (الأسطر ${data.skipped_lines.join('، ')}): SKU أو متجر أو قيمة غير معروفة.`)
        : '';
      setNote({ ok: true, text: l(`${data.saved} rows saved.`, `تم حفظ ${data.saved} صف.`) + skipped });
      onDone();
    } catch (err: any) {
      setNote({ ok: false, text: err.response?.status === 403
        ? l('Only the owner or an admin can upload.', 'الرفع للمالك أو المدير فقط.')
        : err.response?.data?.message || l('Could not read that file. Save it as CSV and try again.', 'تعذرت قراءة الملف. احفظه بصيغة CSV وحاول مجدداً.') });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        // The byte-order mark makes Excel read Arabic names correctly.
        href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + template)}`}
        download={templateName}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition-colors hover:bg-accent"
      >
        <Download size={15} /> {l('Template', 'القالب')}
      </a>
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold transition-colors hover:bg-accent disabled:opacity-60"
      >
        <Upload size={15} /> {busy ? l('Uploading…', 'جارٍ الرفع…') : l('Upload sheet (CSV)', 'ارفع الملف (CSV)')}
      </button>
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {note && <p className={`basis-full text-xs ${note.ok ? 'text-positive' : 'text-negative'}`}>{note.text}</p>}
    </div>
  );
}

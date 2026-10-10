"use client";
import { forwardRef, useMemo } from "react";
import { detectPlatform } from "@/lib/scraper/detector";
import { getPlatform } from "@/lib/scraper/registry";
import { ArrowIcon } from "@/components/ui/Icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder?: string;
}

const UrlInput = forwardRef<HTMLInputElement, Props>(function UrlInput({ value, onChange, onSubmit, busy, placeholder }, ref) {
  const det = useMemo(() => (value.trim() ? detectPlatform(value) : null), [value]);
  const label = det?.platform ? getPlatform(det.platform)?.label : null;

  async function paste() {
    try { onChange((await navigator.clipboard.readText()).trim()); } catch { /* permission denied: user can paste manually */ }
  }

  return (
    <form className="card input-card" onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }}>
      <label className="input-wrap">
        <span className="sr">Media URL</span>
        <input
          ref={ref} value={value} onChange={(e) => onChange(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false}
          placeholder={placeholder ?? "Paste URL"} maxLength={2048}
        />
        {label ? <span className="chip">{label}</span> : det ? <span className="chip warn">Unsupported</span> : (
          <button type="button" className="paste" onClick={paste}>Paste</button>
        )}
      </label>
      <button className="btn" type="submit" disabled={busy || !value.trim()}>
        Download <ArrowIcon />
      </button>
    </form>
  );
});
export default UrlInput;

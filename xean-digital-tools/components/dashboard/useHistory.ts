"use client";
import { useCallback, useEffect, useState } from "react";
import type { HistoryEntry } from "@/types";

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/history", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setHistory(((await r.json()) as { history: HistoryEntry[] }).history);
      setError(false);
    } catch { setError(true); setHistory([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id?: string) => {
    await fetch(`/api/history${id ? `?id=${encodeURIComponent(id)}` : ""}`, { method: "DELETE" }).catch(() => {});
    load();
  };
  return { history, error, remove };
}

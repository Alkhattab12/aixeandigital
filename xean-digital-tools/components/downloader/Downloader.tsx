"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DownloadFailure, DownloadSuccess } from "@/types";
import { detectPlatform } from "@/lib/scraper/detector";
import { getPlatform } from "@/lib/scraper/registry";
import UrlInput from "./UrlInput";
import DownloadProgress from "./DownloadProgress";
import MediaResult from "./MediaResult";
import ErrorCard from "./ErrorCard";

type State =
  | { phase: "idle" }
  | { phase: "loading"; platformLabel: string }
  | { phase: "done"; result: DownloadSuccess }
  | { phase: "error"; title: string; message: string; retryable: boolean; requestId?: string };

export default function Downloader({ hint, focusSignal }: { hint?: string | null; focusSignal?: number }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [stack, setStack] = useState<DownloadSuccess[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const lastUrl = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (focusSignal) inputRef.current?.focus(); }, [focusSignal]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (target: string, opts?: { push?: DownloadSuccess }) => {
    const det = detectPlatform(target);
    if (!det.supported || !det.platform) {
      setState({ phase: "error", title: "That link isn't supported yet", message: "Try a link from TikTok, Instagram, YouTube, Facebook, X, Pinterest, Spotify and the other platforms listed below.", retryable: false });
      return;
    }
    lastUrl.current = target;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setState({ phase: "loading", platformLabel: getPlatform(det.platform)?.label ?? det.platform });
    try {
      const res = await fetch("/api/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: target }), signal: ctl.signal });
      const body = (await res.json()) as DownloadSuccess | DownloadFailure;
      if (body.success) {
        if (opts?.push) setStack((s) => [...s, opts.push!]);
        setState({ phase: "done", result: body });
      } else {
        const retryable = body.error.code === "EXTRACTION_FAILED" || body.error.code === "BUSY" || body.error.code === "RATE_LIMITED" || body.error.code === "INTERNAL";
        setState({ phase: "error", title: body.error.code === "EXTRACTION_FAILED" ? "We couldn't process this link." : "Something's off", message: body.error.message, retryable, requestId: body.requestId });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ phase: "error", title: "Connection problem", message: "We couldn't reach the server. Check your connection and try again.", retryable: true });
    }
  }, []);

  const submit = () => { setStack([]); run(url.trim()); };
  const cancel = () => { abortRef.current?.abort(); setState({ phase: "idle" }); };
  const back = () => {
    const prev = stack[stack.length - 1];
    if (!prev) return;
    setStack(stack.slice(0, -1));
    setState({ phase: "done", result: prev });
  };

  return (
    <div className="stack rel">
      <UrlInput ref={inputRef} value={url} onChange={setUrl} onSubmit={submit} busy={state.phase === "loading"} placeholder={hint ? `Paste a ${hint} link` : "Paste URL"} />
      {state.phase === "loading" ? <DownloadProgress platformLabel={state.platformLabel} onCancel={cancel} /> : null}
      {state.phase === "done" ? (
        <MediaResult
          result={state.result}
          onBack={stack.length ? back : undefined}
          onResolveItem={(u) => run(u, { push: state.result })}
        />
      ) : null}
      {state.phase === "error" ? (
        <ErrorCard title={state.title} message={state.message} requestId={state.requestId} onRetry={state.retryable ? () => run(lastUrl.current) : undefined} />
      ) : null}
    </div>
  );
}

"use client";

import { Check, Copy, DiscordLogo } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type LinkState = { code: string; expiresAt: number } | null;

export function DiscordLink({ initiallyConnected, username }: { initiallyConnected: boolean; username?: string | null | undefined }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [link, setLink] = useState<LinkState>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!link || connected) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/discord/link", { cache: "no-store" });
      if (response.ok && (await response.json()).connected) { setConnected(true); setLink(null); }
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [link, connected]);

  async function createCode() {
    setError("");
    const response = await fetch("/api/discord/link", { method: "POST" });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Could not create a link code."); return; }
    setLink(body);
  }

  if (connected) return <div className="flex items-center gap-2 rounded-[7px] bg-[color-mix(in_srgb,var(--success)_9%,transparent)] px-2.5 py-2 text-[10px] text-[var(--success)]"><Check size={12} weight="bold" />Connected{username ? ` as @${username}` : ""}</div>;

  return (
    <div className="grid gap-3">
      {!link ? <button onClick={createCode} className="flex h-8 items-center justify-center gap-2 rounded-[7px] bg-[var(--accent)] px-3 text-[10px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]"><DiscordLogo size={13} weight="fill" />Generate connection code</button> : <div className="rounded-[8px] bg-[var(--surface-subtle)] p-3"><p className="text-[10px] text-[var(--text-faint)]">In the Discord channel that should receive Evee alerts, run this command within 10 minutes:</p><div className="mt-2 flex items-center justify-between gap-2 rounded-[7px] border bg-[var(--surface)] px-2.5 py-2"><code className="font-mono text-xs font-semibold">/connect code:{link.code}</code><button aria-label="Copy connection command" onClick={async () => { await navigator.clipboard.writeText(`/connect code:${link.code}`); setCopied(true); }} className="text-[var(--accent)]">{copied ? <Check size={13} /> : <Copy size={13} />}</button></div><p className="mt-2 text-[10px] text-[var(--text-faint)]">The code is single-use. This page updates when Discord confirms it.</p></div>}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

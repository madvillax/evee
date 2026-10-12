"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TelegramConnection({ configured, connected, username, canManage }: { configured: boolean; connected: boolean; username: string | null; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);

  async function act(action: "link" | "disconnect") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/backend/telegram/${action}`, { method: "POST" });
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Telegram could not be updated.");
      setLink(body.url ?? null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Telegram could not be updated.");
    } finally { setBusy(false); }
  }

  return (
    <section className="rounded-[10px] border bg-[var(--surface)] p-4">
      <h2 className="text-xs font-semibold">Telegram bot</h2>
      <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
        {connected ? `Connected${username ? ` as @${username}` : ""}.` : "Connect your private Telegram chat to this workspace."} Ask the copilot questions or use /scan, /digest, /pause, and /resume.
      </p>
      {!configured ? <p className="mt-2 text-[11px] text-[var(--text-faint)]">Telegram setup is pending. The workspace administrator needs to configure the bot.</p> : null}
      {canManage && configured ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => void act("link")} className="rounded-[7px] bg-[var(--accent)] px-3 py-2 text-[11px] font-semibold text-[var(--accent-foreground)] disabled:opacity-50">{busy ? "Updating…" : connected ? "Relink Telegram" : "Connect Telegram"}</button>
          {connected ? <button type="button" disabled={busy} onClick={() => void act("disconnect")} className="rounded-[7px] border px-3 py-2 text-[11px] font-semibold disabled:opacity-50">Disconnect</button> : null}
        </div>
      ) : null}
      {link ? <div className="mt-3 text-[12px]"><a href={link} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">Open Telegram and press Start</a><p className="mt-1 text-[11px] text-[var(--text-faint)]">This one-use link expires in 10 minutes. Refresh this page after linking.</p></div> : null}
      {error ? <p role="alert" className="mt-2 text-[11px] text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}

"use client";

import { ArrowClockwise, CircleNotch } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ScanNowButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runScan() {
    if (running) return;
    setError("");
    setRunning(true);
    try {
      const response = await fetch("/api/backend/monitors/scan", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "The scan could not be completed.");
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The scan could not be completed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-1.5">
      <button
        type="button"
        disabled={running}
        onClick={runScan}
        className="flex h-8 items-center gap-2 rounded-[7px] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
      >
        {running ? <CircleNotch size={13} className="animate-spin" /> : <ArrowClockwise size={13} />}
        {running ? "Scanning" : "Scan now"}
      </button>
      {error ? <p role="alert" className="max-w-64 text-right text-[10px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

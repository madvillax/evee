"use client";

import type { StoredOpportunity } from "@evee/platform/domain/types";
import { ArrowSquareOut, Check, Copy, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HorizontalMeter } from "@/components/metric-visuals";

export function OpportunityCard({ opportunity }: { opportunity: StoredOpportunity }) {
  const router = useRouter();
  const [status, setStatus] = useState(opportunity.status);
  const [copied, setCopied] = useState(false);

  async function feedback(value: "good" | "bad" | "replied") {
    const response = await fetch("/api/backend/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunityId: opportunity.id, value }) });
    if (!response.ok) return;
    setStatus(value === "good" ? "saved" : value === "bad" ? "dismissed" : "replied");
    router.refresh();
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(opportunity.replyDraft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  const breakdown = [
    { label: "Intent", value: opportunity.intentScore, maximum: 25 },
    { label: "Fit", value: opportunity.fitScore, maximum: 25 },
    { label: "Urgency", value: opportunity.urgencyScore, maximum: 20 },
    { label: "Specificity", value: opportunity.specificityScore, maximum: 15 },
    { label: "Safety", value: opportunity.replySafetyScore, maximum: 15 },
  ];

  return (
    <article className="opportunity-card overflow-hidden rounded-[10px] border bg-[var(--surface)]">
      <div className="grid gap-4 border-b px-4 py-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase text-[var(--text-faint)]">{opportunity.candidate.source}</span><span className="size-1 rounded-full bg-[var(--border-strong)]" /><span className="text-[10px] text-[var(--text-faint)]">{new Date(opportunity.createdAt).toLocaleString()}</span><span className="rounded-[5px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--text-muted)]">{status}</span></div>
          <h2 className="mt-2 text-sm font-semibold tracking-[-0.02em]">{opportunity.candidate.title}</h2>
          {opportunity.candidate.author ? <p className="mt-1 text-[11px] text-[var(--text-faint)]">By {opportunity.candidate.author}</p> : null}
          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{opportunity.reason}</p>
        </div>
        <div className="grid grid-cols-[58px_repeat(5,minmax(0,1fr))] gap-2 rounded-[8px] bg-[var(--surface-subtle)] p-3">
          <div className="border-r pr-2"><p className="font-mono text-2xl font-medium leading-none tracking-[-0.06em]">{opportunity.score}</p><p className="mt-1 font-mono text-[8px] uppercase text-[var(--text-faint)]">Total</p></div>
          {breakdown.map((item) => <div key={item.label} className="min-w-0 text-center"><p className="font-mono text-sm leading-none">{item.value}</p><p className="mt-1 truncate font-mono text-[8px] text-[var(--text-faint)]">/{item.maximum}</p><div className="mt-2"><HorizontalMeter value={item.value} maximum={item.maximum} label={`${item.label} score`} /></div><p className="mt-1 truncate text-[8px] text-[var(--text-faint)]">{item.label}</p></div>)}
        </div>
      </div>

      {opportunity.signals.length > 0 ? <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">{opportunity.signals.map((signal, index) => <span key={signal} className="flex items-center gap-1.5 rounded-[6px] border bg-[var(--background)] px-2 py-1 text-[10px] text-[var(--text-muted)]"><span className="font-mono text-[8px] text-[var(--text-faint)]">{String(index + 1).padStart(2, "0")}</span>{signal}</span>)}</div> : null}

      <div className="px-4 py-4">
        <div className="rounded-[8px] bg-[var(--surface-subtle)] p-3.5"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">Reply draft</p><button onClick={copyDraft} className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text)]">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy"}</button></div><p className="mt-2.5 whitespace-pre-wrap text-xs leading-5">{opportunity.replyDraft || "No reply was drafted because the opportunity did not pass the safety threshold."}</p></div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button onClick={() => feedback("good")} className="flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[10px] font-semibold hover:bg-[var(--surface-subtle)]"><ThumbsUp size={12} />Useful</button>
          <button onClick={() => feedback("bad")} className="flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[10px] font-semibold hover:bg-[var(--surface-subtle)]"><ThumbsDown size={12} />Not a fit</button>
          <button onClick={() => feedback("replied")} className="flex h-7 items-center gap-1.5 rounded-[7px] border px-2.5 text-[10px] font-semibold hover:bg-[var(--surface-subtle)]"><Check size={12} />Mark replied</button>
          <a href={opportunity.candidate.url} target="_blank" rel="noreferrer" className="ml-auto flex h-7 items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">Open conversation <ArrowSquareOut size={12} /></a>
        </div>
      </div>
    </article>
  );
}

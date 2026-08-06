import { listSourcesForUser } from "@evee/platform/db/repository";
import { ArrowRight, Crosshair, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";
import { addMonitor, toggleMonitor } from "./actions";

export const metadata = { title: "Monitors" };

export default async function MonitorsPage() {
  const { runtimeUser } = await requireWorkspace();
  const monitors = await listSourcesForUser(runtimeUser.id);
  const activeCount = monitors.filter((monitor) => monitor.enabled).length;
  const sourceCount = new Set(monitors.map((monitor) => monitor.type)).size;
  return (
    <div className="grid gap-5">
      <PageHeader title="Monitors" description="Define where Evee searches and what signals matter. The copilot can turn a plain-English goal into a focused monitor." actions={<Link href="/dashboard/agents" className="flex h-8 items-center gap-2 rounded-[7px] border bg-[var(--surface)] px-3 text-[12px] font-semibold hover:border-[var(--border-strong)]">Build with AI <ArrowRight size={13} /></Link>} />
      <section className="grid overflow-hidden rounded-[10px] border bg-[var(--surface)] sm:grid-cols-3">{[["Total monitors", monitors.length], ["Active", activeCount], ["Source types", sourceCount]].map(([label, value]) => <div key={String(label)} className="border-r px-4 py-3.5 last:border-r-0 max-sm:border-b max-sm:border-r-0"><p className="text-[11px] text-[var(--text-faint)]">{label}</p><p className="mt-2 font-mono text-2xl leading-none tracking-[-0.05em]">{value}</p></div>)}</section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.5fr)]">
        <section className="rounded-[10px] border bg-[var(--surface)]">
          <div className="border-b px-4 py-3.5"><h2 className="text-xs font-semibold">Source monitors</h2><p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Enabled monitors are scanned every twenty minutes by the Mastra worker.</p></div>
          {monitors.length ? <div className="divide-y">{monitors.map((monitor) => (
            <div key={monitor.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-subtle)]">
              <span className="grid size-7 place-items-center rounded-[7px] bg-[var(--surface-subtle)] text-[var(--text-faint)]"><Crosshair size={14} /></span>
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium">{monitor.name}</p><span className="font-mono text-[9px] uppercase text-[var(--text-faint)]">{monitor.type}</span></div><p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{String(monitor.config.query ?? monitor.config.url ?? "Uses business profile keywords")}</p></div>
              <form action={toggleMonitor}><input type="hidden" name="sourceId" value={monitor.id} /><input type="hidden" name="enabled" value={String(!monitor.enabled)} /><button className={`rounded-[6px] px-2 py-1 text-[10px] font-semibold ${monitor.enabled ? "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]" : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"}`}>{monitor.enabled ? "Active" : "Paused"}</button></form>
            </div>
          ))}</div> : <div className="px-5 py-12 text-center"><Crosshair size={24} className="mx-auto text-[var(--text-faint)]" /><h3 className="mt-3 text-sm font-semibold">No monitors configured</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Add one manually or ask the copilot to build it.</p></div>}
        </section>
        <form action={addMonitor} className="h-fit rounded-[10px] border bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2"><Plus size={14} className="text-[var(--text-muted)]" /><h2 className="text-xs font-semibold">Add monitor</h2></div>
          <div className="mt-4 grid gap-3.5">
            <label className="grid gap-1.5 text-[11px] font-semibold">Name<input name="name" required className="h-9 rounded-[7px] border bg-[var(--background)] px-3 text-xs font-normal" placeholder="Competitor alternatives" /></label>
            <label className="grid gap-1.5 text-[11px] font-semibold">Source<select name="type" className="h-9 rounded-[7px] border bg-[var(--background)] px-3 text-xs font-normal"><option value="reddit">Reddit</option><option value="hackernews">Hacker News</option><option value="github">GitHub</option><option value="rss">RSS</option></select></label>
            <label className="grid gap-1.5 text-[11px] font-semibold">Query or feed URL<textarea name="query" required className="min-h-20 rounded-[7px] border bg-[var(--background)] px-3 py-2.5 text-xs font-normal leading-5" placeholder="looking for an alternative to..." /></label>
            <button className="h-9 rounded-[7px] bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:translate-y-px">Create monitor</button>
          </div>
        </form>
      </div>
    </div>
  );
}

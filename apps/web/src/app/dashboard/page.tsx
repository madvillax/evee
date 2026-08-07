import { ArrowRight, ChartLineUp, Crosshair, PaperPlaneTilt, Target } from "@phosphor-icons/react/dist/ssr";
import { getProfile, listOpportunitiesForUser } from "@evee/platform/db/repository";
import { getDiscordConnection, getWorkspaceDashboard } from "@evee/platform/db/workspaces";
import Link from "next/link";
import { HorizontalMeter, MiniLine, ScoreRing } from "@/components/metric-visuals";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";

function Metric({ label, value, detail, icon: Icon, visual }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Target;
  visual: React.ReactNode;
}) {
  return (
    <div className="group min-w-0 border-r px-4 py-4 last:border-r-0 max-md:border-b max-md:border-r-0 max-md:last:border-b-0">
      <div className="flex items-center justify-between"><p className="text-[12px] font-medium text-[var(--text-muted)]">{label}</p><Icon size={14} className="text-[var(--text-faint)]" /></div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0"><p className="font-mono text-[30px] font-medium leading-none tracking-[-0.06em]">{value}</p><p className="mt-2 truncate text-[11px] text-[var(--text-faint)]">{detail}</p></div>
        {visual}
      </div>
    </div>
  );
}

function ScanActivity({ runs }: { runs: Array<{ id: string; startedAt: number; candidatesFound: number; opportunitiesCreated: number }> }) {
  const ordered = [...runs].reverse();
  const maximum = Math.max(...ordered.flatMap((run) => [run.candidatesFound, run.opportunitiesCreated]), 1);
  const totalCandidates = ordered.reduce((sum, run) => sum + run.candidatesFound, 0);
  const totalCreated = ordered.reduce((sum, run) => sum + run.opportunitiesCreated, 0);

  return (
    <section className="overflow-hidden rounded-[10px] border bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3.5">
        <div><h2 className="text-xs font-semibold">Scan activity</h2><p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Last {ordered.length || 0} monitor runs</p></div>
        <div className="flex gap-5 text-right"><div><p className="font-mono text-lg leading-none">{totalCandidates}</p><p className="mt-1 text-[10px] text-[var(--text-faint)]">Candidates</p></div><div><p className="font-mono text-lg leading-none">{totalCreated}</p><p className="mt-1 text-[10px] text-[var(--text-faint)]">Qualified</p></div></div>
      </div>
      <div className="relative h-56 px-4 pb-4 pt-5">
        <div className="pointer-events-none absolute inset-x-4 bottom-10 top-5 grid grid-rows-3"><span className="border-t border-dashed border-[var(--chart-grid)]" /><span className="border-t border-dashed border-[var(--chart-grid)]" /><span className="border-y border-dashed border-[var(--chart-grid)]" /></div>
        {ordered.length ? (
          <div className="relative flex h-full items-end justify-around gap-3 pt-4">
            {ordered.map((run) => (
              <div key={run.id} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className="flex h-[calc(100%_-_22px)] items-end justify-center gap-1">
                  <span className="w-[28%] max-w-5 rounded-t-[3px] bg-[var(--accent-soft)]" style={{ height: `${Math.max(run.candidatesFound ? 5 : 1, (run.candidatesFound / maximum) * 100)}%`, opacity: run.candidatesFound ? 0.9 : 0.25 }} title={`${run.candidatesFound} candidates`} />
                  <span className="w-[28%] max-w-5 rounded-t-[3px] bg-[var(--accent)]" style={{ height: `${Math.max(run.opportunitiesCreated ? 5 : 1, (run.opportunitiesCreated / maximum) * 100)}%`, opacity: run.opportunitiesCreated ? 0.95 : 0.15 }} title={`${run.opportunitiesCreated} opportunities`} />
                </div>
                <p className="mt-2 truncate text-center font-mono text-[9px] text-[var(--text-faint)]">{new Date(run.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
              </div>
            ))}
          </div>
        ) : <div className="relative grid h-full place-items-center text-center"><div><Crosshair size={22} className="mx-auto text-[var(--text-faint)]" /><p className="mt-2 text-xs text-[var(--text-muted)]">Activity appears after the first scan.</p></div></div>}
      </div>
      <div className="flex items-center gap-4 border-t px-4 py-2.5 text-[10px] text-[var(--text-faint)]"><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[var(--accent-soft)]" />Candidates</span><span className="flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[var(--accent)]" />Qualified</span></div>
    </section>
  );
}

export default async function DashboardPage() {
  const { runtimeUser, workspace } = await requireWorkspace();
  const [stats, opportunities, profile, discord] = await Promise.all([
    getWorkspaceDashboard(runtimeUser.id),
    listOpportunitiesForUser(runtimeUser.id, 5),
    getProfile(runtimeUser.id),
    getDiscordConnection(workspace.id),
  ]);
  const runValues = [...stats.recentRuns].reverse();
  const readiness = [Boolean(profile), stats.activeMonitors > 0, Boolean(discord)].filter(Boolean).length;

  return (
    <div className="grid gap-5">
      <PageHeader title="Overview" description="Live GTM signal across monitors, opportunities, and connected delivery channels." actions={
        <Link href="/dashboard/agents" className="flex h-8 items-center gap-2 rounded-[7px] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:translate-y-px">Ask copilot <ArrowRight size={13} /></Link>
      } />

      <section className="grid overflow-hidden rounded-[10px] border bg-[var(--surface)] md:grid-cols-4">
        <Metric label="Opportunities" value={stats.opportunities} detail="Found in the last 7 days" icon={Target} visual={<MiniLine values={runValues.map((run) => run.opportunitiesCreated)} label="Opportunities from recent scans" />} />
        <Metric label="Average score" value={stats.averageScore || "-"} detail="Across recent opportunities" icon={ChartLineUp} visual={<ScoreRing value={stats.averageScore} size={46} label="Average opportunity score" />} />
        <Metric label="Active monitors" value={stats.activeMonitors} detail="Scanning connected sources" icon={Crosshair} visual={<MiniLine values={runValues.map((run) => run.sourcesChecked)} label="Sources checked in recent scans" />} />
        <Metric label="Replies tracked" value={stats.replied} detail="Marked as replied this week" icon={PaperPlaneTilt} visual={<div className="w-16 pb-1"><HorizontalMeter value={stats.replied} maximum={stats.opportunities} label="Replies from recent opportunities" /></div>} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]">
        <ScanActivity runs={stats.recentRuns} />
        <section className="rounded-[10px] border bg-[var(--surface)]">
          <div className="flex items-start justify-between border-b px-4 py-3.5"><div><h2 className="text-xs font-semibold">Workspace readiness</h2><p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Required signal foundations</p></div><p className="font-mono text-2xl leading-none tracking-[-0.06em]">{readiness}<span className="text-sm text-[var(--text-faint)]">/3</span></p></div>
          <div className="divide-y">
            {[
              { index: "01", label: "Business profile", ready: Boolean(profile), href: "/dashboard/business" },
              { index: "02", label: "Source monitors", ready: stats.activeMonitors > 0, href: "/dashboard/monitors" },
              { index: "03", label: "Discord companion", ready: Boolean(discord), href: "/dashboard/integrations" },
            ].map((item) => (
              <Link href={item.href} key={item.label} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-subtle)]">
                <span className="font-mono text-[10px] text-[var(--text-faint)]">{item.index}</span><span className="flex-1 text-xs font-medium">{item.label}</span><span className={`text-[10px] font-semibold ${item.ready ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{item.ready ? "Ready" : "Set up"}</span><ArrowRight size={12} className="text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-[10px] border bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b px-4 py-3.5"><div><h2 className="text-xs font-semibold">Latest opportunities</h2><p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Recent conversations ordered by freshness and fit</p></div><Link className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]" href="/dashboard/opportunities">View all</Link></div>
        {opportunities.length ? (
          <div className="divide-y">
            {opportunities.map((opportunity, index) => (
              <Link href="/dashboard/opportunities" key={opportunity.id} className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--surface-subtle)] sm:grid-cols-[28px_minmax(0,1fr)_88px_52px] sm:items-center">
                <span className="hidden font-mono text-[10px] text-[var(--text-faint)] sm:block">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] uppercase text-[var(--text-faint)]">{opportunity.candidate.source}</span><span className="truncate text-xs font-medium">{opportunity.candidate.title}</span></div><p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-muted)]">{opportunity.reason}</p></div>
                <div><HorizontalMeter value={opportunity.score} maximum={100} label={`${opportunity.candidate.title} fit score`} /><p className="mt-1 text-right font-mono text-[9px] text-[var(--text-faint)]">Fit</p></div>
                <span className="text-right font-mono text-lg font-medium tracking-[-0.05em]">{opportunity.score}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center"><Target size={22} className="mx-auto text-[var(--text-faint)]" /><h3 className="mt-3 text-xs font-semibold">No opportunities yet</h3><p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">Complete the business profile, review your monitors, then ask the copilot to run a focused scan.</p><Link href={profile ? "/dashboard/monitors" : "/dashboard/business"} className="mt-3 inline-flex text-[11px] font-semibold text-[var(--text)] underline underline-offset-4">{profile ? "Review monitors" : "Create business profile"}</Link></div>
        )}
      </section>
    </div>
  );
}

import { getProfile } from "@evee/platform/db/repository";
import { getDiscordConnection } from "@evee/platform/db/workspaces";
import { ArrowRight, BellSimple, FloppyDisk, IdentificationCard, PlugsConnected } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";
import { saveSettings } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { runtimeUser, workspace } = await requireWorkspace();
  const [profile, discord] = await Promise.all([
    getProfile(runtimeUser.id),
    getDiscordConnection(workspace.id),
  ]);

  const setupLinks = [
    {
      href: "/dashboard/business",
      title: "Business profile",
      description: "Product, audience, positioning, keywords, and reply style.",
      ready: Boolean(profile),
      icon: IdentificationCard,
    },
    {
      href: "/dashboard/integrations",
      title: "Connections",
      description: "Signal sources and your Discord companion.",
      ready: Boolean(discord),
      icon: PlugsConnected,
    },
  ];

  return (
    <div className="grid gap-5">
      <PageHeader title="Settings" description="Keep workspace context, connections, and notification preferences organized in one place." />

      <section className="overflow-hidden rounded-[10px] border bg-[var(--surface)]">
        <div className="border-b px-4 py-3.5">
          <h2 className="text-xs font-semibold">Workspace setup</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Context and connections Evee uses across every workflow</p>
        </div>
        <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
          {setupLinks.map((item) => (
            <Link key={item.href} href={item.href} className="group flex min-h-28 items-start gap-3 bg-[var(--surface)] p-4 hover:bg-[var(--surface-subtle)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <item.icon size={18} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold">{item.title}</h3>
                  <span className={`text-[9px] font-semibold ${item.ready ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{item.ready ? "Ready" : "Set up"}</span>
                </div>
                <p className="mt-1.5 max-w-sm text-[11px] leading-4 text-[var(--text-muted)]">{item.description}</p>
              </div>
              <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
            </Link>
          ))}
        </div>
      </section>

      <form action={saveSettings} className="max-w-3xl overflow-hidden rounded-[10px] border bg-[var(--surface)]">
        <div className="flex items-center gap-3 border-b px-4 py-3.5">
          <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--surface-subtle)] text-[var(--text-muted)]"><BellSimple size={16} weight="fill" /></span>
          <div><h2 className="text-xs font-semibold">Alerts and scoring</h2><p className="mt-0.5 text-[11px] text-[var(--text-faint)]">Preferences shared by web schedules and Discord</p></div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[11px] font-semibold">Timezone<input name="timezone" required defaultValue={runtimeUser.timezone} className="h-9 rounded-[7px] border bg-[var(--background)] px-3 text-xs font-normal" /></label>
          <label className="grid gap-1.5 text-[11px] font-semibold">Daily digest hour<input name="digestHour" type="number" min="0" max="23" required defaultValue={runtimeUser.digestHour} className="h-9 rounded-[7px] border bg-[var(--background)] px-3 font-mono text-xs font-normal" /></label>
          <label className="grid gap-1.5 text-[11px] font-semibold">Minimum opportunity score<input name="minScore" type="number" min="40" max="100" required defaultValue={runtimeUser.minScore} className="h-9 rounded-[7px] border bg-[var(--background)] px-3 font-mono text-xs font-normal" /><span className="font-normal leading-4 text-[var(--text-faint)]">Lower-scoring opportunities stay in the dashboard without triggering an alert.</span></label>
          <label className="flex items-start gap-3 rounded-[8px] bg-[var(--surface-subtle)] p-3 text-[11px]"><input type="checkbox" name="alertsEnabled" defaultChecked={runtimeUser.alertsEnabled} className="mt-0.5 size-3.5 accent-[var(--accent)]" /><span><strong className="block font-semibold">Instant alerts</strong><span className="mt-1 block leading-4 text-[var(--text-muted)]">Deliver qualified opportunities to connected channels.</span></span></label>
        </div>
        <div className="flex justify-end border-t px-4 py-3"><button className="flex h-9 items-center gap-2 rounded-[7px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"><FloppyDisk size={14} />Save settings</button></div>
      </form>
    </div>
  );
}

import { getWorkspaceSubscription } from "@evee/platform/db/workspaces";
import { Check, CreditCard } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const { workspace } = await requireWorkspace();
  const subscription = await getWorkspaceSubscription(workspace.id);
  return (
    <div className="grid gap-5">
      <PageHeader title="Billing" description="Review the plan and subscription state for this workspace." />
      <section className="overflow-hidden rounded-[10px] border bg-[var(--surface)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-4 sm:p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]"><CreditCard size={17} /></span><div><p className="text-[11px] text-[var(--text-faint)]">Current plan</p><h2 className="text-base font-semibold capitalize">{subscription?.plan ?? workspace.plan}</h2></div></div><div className="mt-5 grid gap-2.5 text-[12px] text-[var(--text-muted)]">{["Shared web and Discord workspace", "Public source monitoring", "GTM Copilot with workspace tools", "Opportunity scoring and reply drafts"].map((feature, index) => <p key={feature} className="grid grid-cols-[20px_1fr] items-center gap-2"><span className="font-mono text-[9px] text-[var(--text-faint)]">0{index + 1}</span><span className="flex items-center gap-2"><Check size={12} className="text-[var(--success)]" />{feature}</span></p>)}</div></div>
          <div className="border-t bg-[var(--surface-subtle)] p-4 lg:border-l lg:border-t-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">Subscription state</p><dl className="mt-4 grid gap-3 text-[11px]"><div className="flex justify-between"><dt className="text-[var(--text-muted)]">Status</dt><dd className="font-medium capitalize text-[var(--success)]">{subscription?.status ?? "trialing"}</dd></div><div className="flex justify-between"><dt className="text-[var(--text-muted)]">Billing provider</dt><dd className="font-medium capitalize">{subscription?.provider ?? "manual"}</dd></div></dl><p className="mt-5 border-t pt-3 text-[10px] leading-4 text-[var(--text-faint)]">Plan changes are currently managed outside the dashboard.</p></div>
        </div>
      </section>
    </div>
  );
}

import { listOpportunitiesForUser } from "@evee/platform/db/repository";
import { Target } from "@phosphor-icons/react/dist/ssr";
import { OpportunityCard } from "@/components/opportunity-card";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const { runtimeUser } = await requireWorkspace();
  const opportunities = await listOpportunitiesForUser(runtimeUser.id);
  return (
    <div className="grid gap-5">
      <PageHeader title="Opportunities" description="Every qualified conversation, its evidence, score, personalized draft, and feedback state in one review queue." />
      {opportunities.length ? <div className="grid gap-3">{opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)}</div> : <section className="rounded-[10px] border bg-[var(--surface)] px-6 py-20 text-center"><Target size={26} className="mx-auto text-[var(--text-faint)]" /><h2 className="mt-4 text-sm font-semibold">Your opportunity queue is empty</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--text-muted)]">Once your profile and monitors are ready, scans will add qualified conversations here and send the same alerts to Discord.</p></section>}
    </div>
  );
}

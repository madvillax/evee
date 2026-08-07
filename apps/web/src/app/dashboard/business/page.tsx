import { getProfile } from "@evee/platform/db/repository";
import { FloppyDisk } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/session";
import { saveBusinessProfile } from "./actions";

const inputClass = "h-9 w-full rounded-[7px] border bg-[var(--background)] px-3 text-xs placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]";
const textareaClass = "min-h-20 w-full resize-y rounded-[7px] border bg-[var(--background)] px-3 py-2.5 text-xs leading-5 placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]";

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-[11px] font-semibold">{label}{children}{helper ? <span className="font-normal leading-4 text-[var(--text-faint)]">{helper}</span> : null}</label>;
}

export const metadata = { title: "Business profile" };

export default async function BusinessProfilePage({ searchParams }: { searchParams: Promise<{ save?: string }> }) {
  const { save } = await searchParams;
  const { runtimeUser } = await requireWorkspace();
  const profile = await getProfile(runtimeUser.id);
  return (
    <div className="grid gap-5">
      <PageHeader title="Business profile" description="This is the shared context used by monitors, opportunity scoring, reply drafts, Discord, and the GTM copilot." />
      {save === "success" ? <p role="status" className="rounded-[8px] border border-[var(--success)]/30 bg-[color-mix(in_srgb,var(--success)_9%,transparent)] px-3 py-2 text-xs text-[var(--success)]">Profile saved successfully.</p> : null}
      {save === "error" ? <p role="alert" className="rounded-[8px] border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_9%,transparent)] px-3 py-2 text-xs text-[var(--danger)]">Profile could not be saved. Check the deployment database settings and try again.</p> : null}
      <form action={saveBusinessProfile} className="grid gap-4">
        <section className="rounded-[10px] border bg-[var(--surface)]">
          <div className="flex items-center gap-3 border-b px-4 py-3.5"><span className="font-mono text-[10px] text-[var(--text-faint)]">01</span><div><h2 className="text-xs font-semibold">Product</h2><p className="mt-0.5 text-[10px] text-[var(--text-faint)]">Core positioning and customer outcome</p></div></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Product name"><input className={inputClass} name="productName" defaultValue={profile?.productName} required /></Field>
            <Field label="Product URL" helper="Optional if the product is not public yet."><input className={inputClass} type="url" name="productUrl" defaultValue={profile?.productUrl} placeholder="https://" /></Field>
            <div className="sm:col-span-2"><Field label="What it does" helper="Describe the customer outcome, not only the feature list."><textarea className={textareaClass} name="productSummary" defaultValue={profile?.productSummary} required minLength={10} /></Field></div>
          </div>
        </section>
        <section className="rounded-[10px] border bg-[var(--surface)]">
          <div className="flex items-center gap-3 border-b px-4 py-3.5"><span className="font-mono text-[10px] text-[var(--text-faint)]">02</span><div><h2 className="text-xs font-semibold">Market context</h2><p className="mt-0.5 text-[10px] text-[var(--text-faint)]">Customers, pain, alternatives, and language</p></div></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Target customers" helper="Comma-separated segments."><textarea className={textareaClass} name="targetCustomers" defaultValue={profile?.targetCustomers.join(", ")} required /></Field>
            <Field label="Pain points" helper="Comma-separated problems or blocked workflows."><textarea className={textareaClass} name="painPoints" defaultValue={profile?.painPoints.join(", ")} required /></Field>
            <Field label="Competitors" helper="Products, services, or manual alternatives."><textarea className={textareaClass} name="competitors" defaultValue={profile?.competitors.join(", ")} /></Field>
            <Field label="Keywords" helper="Terms the monitors should pay attention to."><textarea className={textareaClass} name="keywords" defaultValue={profile?.keywords.join(", ")} /></Field>
          </div>
        </section>
        <section className="rounded-[10px] border bg-[var(--surface)]">
          <div className="flex items-center gap-3 border-b px-4 py-3.5"><span className="font-mono text-[10px] text-[var(--text-faint)]">03</span><div><h2 className="text-xs font-semibold">Agent behavior</h2><p className="mt-0.5 text-[10px] text-[var(--text-faint)]">Voice, safety, and conversations to exclude</p></div></div>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Preferred reply style"><textarea className={textareaClass} name="replyStyle" defaultValue={profile?.replyStyle ?? "Concise, practical, friendly, and transparent about affiliation."} required /></Field>
            <Field label="Exclusions" helper="Conversations the system should ignore."><textarea className={textareaClass} name="exclusions" defaultValue={profile?.exclusions.join(", ")} placeholder="Hiring posts, student projects" /></Field>
          </div>
        </section>
        <div className="flex justify-end"><button className="flex h-9 items-center gap-2 rounded-[7px] bg-[var(--accent)] px-3.5 text-[11px] font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] active:translate-y-px"><FloppyDisk size={14} />Save profile</button></div>
      </form>
    </div>
  );
}

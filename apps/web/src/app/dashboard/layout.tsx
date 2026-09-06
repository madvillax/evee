import { AppShell } from "@/components/app-shell";
import { countNewOpportunities } from "@evee/platform/db/repository";
import { requireWorkspace } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, workspace, runtimeUser } = await requireWorkspace();
  const newOpportunityCount = await countNewOpportunities(runtimeUser.id, runtimeUser.minScore);
  return <AppShell workspaceName={workspace.name} userName={session.user.name} userEmail={session.user.email} newOpportunityCount={newOpportunityCount}>{children}</AppShell>;
}

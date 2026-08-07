import { createDiscordLinkCode, getDiscordConnection } from "@evee/platform/db/workspaces";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/session";

export async function GET() {
  const { workspace } = await requireWorkspace();
  const connection = await getDiscordConnection(workspace.id);
  return NextResponse.json({ connected: Boolean(connection), username: connection?.discordUsername ?? null, linkedAt: connection?.linkedAt ?? null });
}

export async function POST() {
  const { session, workspace } = await requireWorkspace();
  const link = await createDiscordLinkCode(workspace.id, session.user.id);
  return NextResponse.json(link);
}

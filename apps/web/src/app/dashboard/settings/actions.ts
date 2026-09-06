"use server";

import { updateUserPreferences } from "@evee/platform/db/repository";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/session";

export async function saveSettings(formData: FormData) {
  const { runtimeUser } = await requireWorkspace();
  const minScore = Number(formData.get("minScore"));
  if (!Number.isInteger(minScore) || minScore < 40 || minScore > 100) throw new Error("Minimum score must be between 40 and 100.");
  await updateUserPreferences(runtimeUser.id, { minScore, alertsEnabled: formData.get("monitoringEnabled") === "on" });
  revalidatePath("/dashboard/settings");
}

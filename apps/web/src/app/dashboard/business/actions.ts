"use server";

import { saveProfile } from "@evee/platform/db/repository";
import { profileInputSchema } from "@evee/platform/domain/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/session";

const list = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

export async function saveBusinessProfile(formData: FormData) {
  const { runtimeUser } = await requireWorkspace();
  let saved = false;
  try {
    const productUrl = String(formData.get("productUrl") ?? "").trim();
    const input = profileInputSchema.parse({
      productName: String(formData.get("productName") ?? "").trim(),
      ...(productUrl ? { productUrl } : {}),
      productSummary: String(formData.get("productSummary") ?? "").trim(),
      targetCustomers: list(formData.get("targetCustomers")),
      painPoints: list(formData.get("painPoints")),
      competitors: list(formData.get("competitors")),
      replyStyle: String(formData.get("replyStyle") ?? "").trim(),
      keywords: list(formData.get("keywords")),
      exclusions: list(formData.get("exclusions")),
    });
    await saveProfile(runtimeUser.id, input);
    saved = true;
  } catch (error) {
    console.error("Business profile save failed", error);
  }

  if (!saved) redirect("/dashboard/business?save=error");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/business?save=success");
}

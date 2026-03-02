"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createProjectRecord } from "@/lib/coreJobs";

const createProjectSchema = z.object({
  name: z.string().min(1),
  seedDefault: z.string().min(1).default("42")
});

export async function createProjectAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const seedDefault = String(formData.get("seedDefault") ?? "42").trim() || "42";
  const pastedRulebook = String(formData.get("rulebookText") ?? "").trim();
  const uploaded = formData.get("rulebookFile");
  const fileText =
    uploaded && typeof uploaded === "object" && "text" in uploaded && typeof uploaded.text === "function"
      ? (await uploaded.text()).trim()
      : "";
  const rulebookText = fileText.length > 0 ? fileText : pastedRulebook;

  const parsed = createProjectSchema.safeParse({
    name,
    seedDefault
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" | "));
  }
  if (rulebookText.length === 0) {
    throw new Error("rulebook text is required");
  }

  const project = createProjectRecord({
    name: parsed.data.name,
    seedDefault: parsed.data.seedDefault,
    rulebookText
  });
  redirect(`/projects/${project.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLpjEditor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function str(raw: FormDataEntryValue | null) {
  const s = String(raw ?? "").trim();
  return s.length ? s : null;
}

export async function updateLpjSignatoriesAction(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  if (!projectId) redirect("/admin/lpj");
  await requireLpjEditor(projectId);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      lpjKepalaNama: str(formData.get("lpjKepalaNama")),
      lpjKepalaNip: str(formData.get("lpjKepalaNip")),
      lpjKetuaNama: str(formData.get("lpjKetuaNama")),
      lpjKetuaNip: str(formData.get("lpjKetuaNip")),
      lpjBendaharaNama: str(formData.get("lpjBendaharaNama")),
      lpjBendaharaNip: str(formData.get("lpjBendaharaNip")),
      lpjKabKota: str(formData.get("lpjKabKota")),
      lpjProvinsi: str(formData.get("lpjProvinsi")),
      lpjNpwp: str(formData.get("lpjNpwp")),
    },
  });

  revalidatePath(`/admin/lpj/${projectId}`);
  revalidatePath(`/admin/lpj/${projectId}/bank`);
  revalidatePath(`/admin/lpj/${projectId}/export`);
  revalidatePath(`/admin/lpj/${projectId}/spk`);
  revalidatePath(`/admin/lpj/${projectId}/pajak`);
  redirect(`/admin/lpj/${projectId}/bank`);
}

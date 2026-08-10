import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getAdminProyekProjectId,
  isAdminProyek,
  requireSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRupiah } from "@/lib/money";
import { getProjectCashBalance } from "@/lib/balance";
import { tidyCase } from "@/lib/text";
import { Alert, Card, PageHeader, btnPrimaryClass } from "@/components/ui";

export default async function AdminProyekHomePage() {
  const user = await requireSession();
  if (!isAdminProyek(user)) {
    redirect("/");
  }

  const projectId = await getAdminProyekProjectId(user);
  if (!projectId) {
    return (
      <div>
        <PageHeader
          title="Proyek Saya"
          description="Akun Admin Proyek belum ditugaskan ke proyek mandiri."
        />
        <Card>
          <Alert>
            Hubungi Owner untuk menugaskan Anda ke tepat satu proyek mandiri.
          </Alert>
        </Card>
      </div>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      standaloneBookkeeping: true,
      contractValue: true,
    },
  });
  if (!project) {
    return (
      <div>
        <PageHeader title="Proyek Saya" />
        <Card>
          <Alert>Proyek penugasan tidak ditemukan.</Alert>
        </Card>
      </div>
    );
  }

  const cash = await getProjectCashBalance(project.id);

  return (
    <div>
      <PageHeader
        title="Proyek Saya"
        description="Kas proyek ini terpisah permanen dari kas besar Owner."
      />
      <Card>
        <p className="text-xs tracking-wide text-[var(--ink-faint)] uppercase">
          Proyek mandiri
        </p>
        <h2 className="mt-1 font-medium text-[var(--ink)]">
          {tidyCase(project.name)}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-faint)]">
          {tidyCase(project.location)} · {project.status}
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--ink-faint)]">Saldo kas proyek</dt>
            <dd className="font-medium text-[var(--ink)]">
              {formatRupiah(cash)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--ink-faint)]">Nilai kontrak</dt>
            <dd className="font-medium text-[var(--ink)]">
              {formatRupiah(project.contractValue)}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/projects/${project.id}`} className={btnPrimaryClass}>
            Buka detail proyek
          </Link>
          <Link
            href="/transactions/project"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          >
            Kas proyek
          </Link>
          <Link
            href="/foto-proyek"
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
          >
            Foto proyek
          </Link>
        </div>
      </Card>
    </div>
  );
}

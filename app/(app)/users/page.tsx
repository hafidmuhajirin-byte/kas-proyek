import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roleLabels } from "@/lib/labels";
import { UserCreateForm, UserEditForm, DeleteUserButton } from "@/components/UserForms";
import { Card, PageHeader } from "@/components/ui";

export default async function UsersPage() {
  await requireOwner();

  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        projectAssignments: { select: { projectId: true } },
      },
    }),
    prisma.project.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        standaloneBookkeeping: true,
      },
    }),
  ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Kelola Owner, AdminOK, Admin Proyek, Mandor, dan ADM Foto. Admin Proyek = 1 proyek mandiri."
      />

      <Card className="mb-6">
        <h3 className="mb-3 font-medium text-[var(--ink)]">Tambah pengguna</h3>
        <UserCreateForm
          projects={activeProjects.map((p) => ({
            id: p.id,
            name: p.name,
            standalone: p.standaloneBookkeeping,
          }))}
        />
      </Card>

      <div className="space-y-4">
        {users.map((u) => {
          const assignedIds = new Set(
            u.projectAssignments.map((a) => a.projectId),
          );
          // Tampilkan ACTIVE + proyek yang sudah ditugaskan (meski selesai)
          const formProjects = projects.filter(
            (p) => p.status === "ACTIVE" || assignedIds.has(p.id),
          );
          return (
            <Card key={u.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--ink)]">{u.name}</p>
                  <p className="text-sm text-[var(--ink-faint)]">
                    @{u.username} · {roleLabels[u.role] ?? u.role}
                    {(u.role === "MANDOR" ||
                      u.role === "ADM_FOTO" ||
                      u.role === "ADMIN_PROYEK") &&
                    assignedIds.size === 0 ? (
                      <span className="ml-2 text-amber-700">
                        · belum ada proyek
                      </span>
                    ) : null}
                  </p>
                </div>
                <DeleteUserButton userId={u.id} username={u.username} />
              </div>
              <UserEditForm
                user={{
                  id: u.id,
                  username: u.username,
                  name: u.name,
                  role: u.role,
                  projectIds: u.projectAssignments.map((a) => a.projectId),
                }}
                projects={formProjects.map((p) => ({
                  id: p.id,
                  name:
                    p.status === "ACTIVE"
                      ? p.name
                      : `${p.name} (${p.status})`,
                  standalone: p.standaloneBookkeeping,
                }))}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

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
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Kelola Owner, Admin, dan Mandor. Mandor ditugaskan ke proyek."
      />

      <Card className="mb-6">
        <h3 className="mb-3 font-medium text-[var(--ink)]">Tambah pengguna</h3>
        <UserCreateForm projects={projects} />
      </Card>

      <div className="space-y-4">
        {users.map((u) => (
          <Card key={u.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[var(--ink)]">{u.name}</p>
                <p className="text-sm text-[var(--ink-faint)]">
                  @{u.username} · {roleLabels[u.role] ?? u.role}
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
              projects={projects}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}

import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import { isOwner, requireSession } from "@/lib/auth";
import { categoryTypeLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { ActionForm, Field, inputClass } from "@/components/ActionForm";
import {
  Alert,
  btnDangerClass,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireSession();
  const admin = isOwner(user);
  const categories = await prisma.category.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const params = await searchParams;

  return (
    <div>
      <PageHeader
        title="Kategori"
        description="Kelompokkan transaksi pemasukan dan pengeluaran agar laporan mudah dibaca."
      />

      {params.error ? (
        <div className="mb-4">
          <Alert>{params.error}</Alert>
        </div>
      ) : null}

      <div className={`grid gap-6 ${admin ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <Card className="overflow-x-auto">
          {categories.length === 0 ? (
            <EmptyState message="Belum ada kategori." />
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-teal-900/10 text-xs tracking-wide text-teal-900/55 uppercase">
                <tr>
                  <th className="pb-3 pr-3 font-medium">Nama</th>
                  <th className="pb-3 pr-3 font-medium">Jenis</th>
                  {admin ? <th className="pb-3 font-medium">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-teal-900/5 align-top"
                  >
                    <td className="py-3 pr-3 font-medium text-teal-950">
                      {category.name}
                      {admin ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-normal text-teal-700">
                            Edit
                          </summary>
                          <div className="mt-2 max-w-sm">
                            <ActionForm
                              action={updateCategoryAction}
                              submitLabel="Update"
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={category.id}
                              />
                              <Field label="Nama">
                                <input
                                  name="name"
                                  className={inputClass}
                                  defaultValue={category.name}
                                  required
                                />
                              </Field>
                              <Field label="Jenis">
                                <select
                                  name="type"
                                  className={inputClass}
                                  defaultValue={category.type}
                                >
                                  <option value="INCOME">Pemasukan</option>
                                  <option value="EXPENSE">Pengeluaran</option>
                                </select>
                              </Field>
                            </ActionForm>
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          category.type === "INCOME"
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-rose-50 text-rose-800"
                        }`}
                      >
                        {categoryTypeLabels[category.type]}
                      </span>
                    </td>
                    {admin ? (
                      <td className="py-3">
                        <form action={deleteCategoryAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <button type="submit" className={btnDangerClass}>
                            Hapus
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {admin ? (
          <Card>
            <h3 className="font-serif text-xl text-teal-950">Tambah kategori</h3>
            <div className="mt-4">
              <ActionForm
                action={createCategoryAction}
                submitLabel="Tambah kategori"
              >
                <Field label="Nama">
                  <input name="name" className={inputClass} required />
                </Field>
                <Field label="Jenis">
                  <select
                    name="type"
                    className={inputClass}
                    defaultValue="EXPENSE"
                  >
                    <option value="INCOME">Pemasukan</option>
                    <option value="EXPENSE">Pengeluaran</option>
                  </select>
                </Field>
              </ActionForm>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

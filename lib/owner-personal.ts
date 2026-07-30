/**
 * Pengeluaran pribadi owner (bukan transfer fee):
 * - Ambil dari kas besar
 * - Bukan pengeluaran operasional proyek
 * - Tidak mengubah saldo kas proyek
 * - Mengurangi sisa kuota fee proyek
 */
export function isOwnerPersonalDraw(tx: {
  type: string;
  isOwnerPersonal?: boolean | null;
  isFeeTransfer?: boolean | null;
}) {
  return (
    tx.type === "EXPENSE" &&
    Boolean(tx.isOwnerPersonal) &&
    !Boolean(tx.isFeeTransfer)
  );
}

import { format } from "date-fns";
import { formatRupiah } from "@/lib/money";
import { tidyCase } from "@/lib/text";

export type LinkedProofBrief = {
  id: string;
  date: Date;
  amount: number;
  description: string;
  proofUrl: string | null;
  mandorName: string;
};

/** Nested bukti di bawah baris pencairan Kas Besar (bukan kredit tambahan). */
export function DisbursementProofDetails({
  cairAmount,
  proofs,
}: {
  cairAmount: number;
  proofs: LinkedProofBrief[];
}) {
  const used = proofs.reduce((s, p) => s + p.amount, 0);
  const sisa = cairAmount - used;

  return (
    <details className="mt-1.5 text-sm">
      <summary className="cursor-pointer text-teal-700 underline-offset-2 hover:underline">
        Breakdown bukti ({proofs.length}) · terpakai {formatRupiah(used)} ·
        sisa {formatRupiah(sisa)}
      </summary>
      {proofs.length === 0 ? (
        <p className="mt-2 text-xs text-teal-900/55">
          Belum ada bukti Mandor tertaut.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 border-l-2 border-teal-900/15 pl-3">
          {proofs.map((p) => (
            <li key={p.id} className="text-teal-950">
              <span className="text-teal-900/55">
                {format(p.date, "dd/MM/yyyy")}
              </span>
              {" · "}
              {tidyCase(p.description)}
              {" · "}
              <span className="tabular-nums text-rose-800">
                {formatRupiah(p.amount)}
              </span>
              {" · "}
              {p.mandorName}
              {p.proofUrl ? (
                <>
                  {" · "}
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-teal-700 underline"
                  >
                    Lihat
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

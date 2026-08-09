import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type CashBookLine = {
  date: Date;
  description: string;
  category: string;
  source: string;
  type: "INCOME" | "EXPENSE";
  income: number;
  expense: number;
  balance: number;
  skipBalance?: boolean;
};

export function buildCashBookRows(
  txs: Array<{
    date: Date;
    description: string;
    type: "INCOME" | "EXPENSE";
    amount: number;
    isMandorExpense?: boolean;
    categoryName: string;
    cashSourceName: string;
  }>,
  openingBalance = 0,
): CashBookLine[] {
  let balance = openingBalance;
  const sorted = [...txs].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  return sorted.map((tx) => {
    const skip = Boolean(tx.isMandorExpense);
    const income = tx.type === "INCOME" ? tx.amount : 0;
    const expense = tx.type === "EXPENSE" ? tx.amount : 0;
    if (!skip) balance += income - expense;
    return {
      date: tx.date,
      description: tx.description,
      category: tx.categoryName,
      source: tx.cashSourceName,
      type: tx.type,
      income,
      expense,
      balance: skip ? balance : balance,
      skipBalance: skip,
    };
  });
}

function csvEscape(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** CSV UTF-8 (BOM) — langsung dibuka Excel. */
export function cashBookToCsv(
  rows: CashBookLine[],
  meta: { projectName: string; location: string },
) {
  const headers = [
    "Tanggal",
    "Keterangan",
    "Kategori",
    "Sumber kas",
    "Penerimaan",
    "Pengeluaran",
    "Saldo",
    "Catatan",
  ];
  const body = rows.map((r) =>
    [
      format(r.date, "yyyy-MM-dd"),
      r.description,
      r.category,
      r.source,
      r.income || "",
      r.expense || "",
      r.balance,
      r.skipBalance ? "Laporan Mandor (tidak potong saldo)" : "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const title = [
    csvEscape(`Buku Kas Tunai — ${meta.projectName}`),
    csvEscape(meta.location),
    "",
    "",
    "",
    "",
    "",
    "",
  ].join(",");
  return "\uFEFF" + [title, headers.join(","), ...body].join("\n");
}

/** SpreadsheetML (.xls) tanpa library — kompatibel Excel. */
export function cashBookToExcelXml(
  rows: CashBookLine[],
  meta: { projectName: string; location: string },
) {
  const cell = (v: string | number, type: "String" | "Number" = "String") =>
    `<Cell><Data ss:Type="${type}">${String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</Data></Cell>`;

  const header = [
    "Tanggal",
    "Keterangan",
    "Kategori",
    "Sumber kas",
    "Penerimaan",
    "Pengeluaran",
    "Saldo",
  ]
    .map((h) => cell(h))
    .join("");

  const dataRows = rows
    .map((r) => {
      const cols = [
        cell(format(r.date, "dd/MM/yyyy")),
        cell(r.description),
        cell(r.category),
        cell(r.source),
        cell(r.income || 0, "Number"),
        cell(r.expense || 0, "Number"),
        cell(r.balance, "Number"),
      ].join("");
      return `<Row>${cols}</Row>`;
    })
    .join("\n");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Buku Kas Tunai">
  <Table>
   <Row>${cell(`Buku Kas Tunai — ${meta.projectName}`)}</Row>
   <Row>${cell(meta.location)}</Row>
   <Row>${cell(`Cetak ${format(new Date(), "dd MMM yyyy HH:mm", { locale: localeId })}`)}</Row>
   <Row></Row>
   <Row>${header}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

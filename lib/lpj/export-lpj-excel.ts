/**
 * Export workbook LPJ (Bank / BKU / BKT) mirip template BUKU_KAS.xlsm.
 * Nilai diisi dari data sistem; saldo & jumlah memakai rumus Excel.
 */
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { BankMonthBlock } from "@/lib/buku-kas/bank";
import {
  BKU_COST_TYPE_NOTES,
  type BkuMonthBlock,
} from "@/lib/buku-kas/bku";
import type { BktMonthBlock } from "@/lib/buku-kas/bkt";
import { parseProjectLocation } from "@/lib/project-bkk-report";

const RP = '_("Rp"* #,##0.00_);_("Rp"* (#,##0.00);_("Rp"* "-"??_);_(@_)';
const BANK_DATA_ROWS = 11;
const BKU_MIN_ROWS = 10;
const BKT_MIN_ROWS = 11;

export type LpjExcelMeta = {
  schoolName: string;
  projectTitle: string;
  location: string;
  kabKota?: string | null;
  provinsi?: string | null;
  kepalaNama?: string | null;
  kepalaNip?: string | null;
  ketuaNama?: string | null;
  ketuaNip?: string | null;
  bendaharaNama?: string | null;
  bendaharaNip?: string | null;
};

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FF444444" },
  };
  return { top: s, left: s, bottom: s, right: s };
}

function styleHeader(cell: ExcelJS.Cell, bold = true) {
  cell.font = { name: "Arial", size: 10, bold };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder();
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8E4D8" },
  };
}

function styleCell(cell: ExcelJS.Cell, opts?: { bold?: boolean; align?: ExcelJS.Alignment["horizontal"] }) {
  cell.font = { name: "Arial", size: 9, bold: opts?.bold };
  cell.alignment = {
    vertical: "middle",
    horizontal: opts?.align ?? "left",
    wrapText: true,
  };
  cell.border = thinBorder();
}

function money(cell: ExcelJS.Cell, value?: number | string | null) {
  if (typeof value === "string") cell.value = { formula: value };
  else if (value == null || value === 0) cell.value = value === 0 ? 0 : null;
  else cell.value = value;
  cell.numFmt = RP;
  styleCell(cell, { align: "right" });
}

function setLandscape(ws: ExcelJS.Worksheet) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.35,
      bottom: 0.35,
      header: 0.2,
      footer: 0.2,
    },
  };
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return format(d, "d-MMM-yy", { locale: localeId });
}

function writeBankSheet(
  wb: ExcelJS.Workbook,
  blocks: BankMonthBlock[],
  meta: LpjExcelMeta,
) {
  const ws = wb.addWorksheet("BUKU BANK", {
    views: [{ showGridLines: false }],
  });
  setLandscape(ws);
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 5;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 36;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 16;
  ws.getColumn(8).width = 16;

  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = meta.schoolName.trim().toUpperCase();

  let row = 1;
  const blockStarts: number[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]!;
    const start = row;
    blockStarts.push(start);

    ws.mergeCells(row, 2, row, 8);
    const title = ws.getCell(row, 2);
    title.value = "BUKU BANK";
    title.font = { name: "Arial", size: 14, bold: true };
    title.alignment = { horizontal: "center" };
    row++;

    ws.mergeCells(row, 2, row, 8);
    ws.getCell(row, 2).value = b.title || `Bulan ${format(new Date(b.year, b.month - 1, 1), "MMMM yyyy", { locale: localeId })}`;
    ws.getCell(row, 2).font = { name: "Arial", size: 11, bold: true };
    ws.getCell(row, 2).alignment = { horizontal: "center" };
    row += 2;

    ws.getCell(row, 2).value = "Sekolah";
    ws.getCell(row, 3).value = `: ${school}`;
    ws.getCell(row, 6).value = "Kab/Kota";
    ws.getCell(row, 7).value = `: ${kab}`;
    row++;
    ws.getCell(row, 2).value = "Desa";
    ws.getCell(row, 3).value = `: ${loc.alamat}`;
    ws.getCell(row, 6).value = "Provinsi";
    ws.getCell(row, 7).value = `: ${prov}`;
    row++;
    ws.getCell(row, 2).value = "Kecamatan";
    ws.getCell(row, 3).value = `: ${loc.kecamatan}`;
    row += 2;

    const headerRow = row;
    const headers = [
      "No.",
      "Tanggal",
      "Uraian",
      "No. Bukti",
      "Debet / Penerimaan (Rp.)",
      "Kredit / Pengeluaran (Rp.)",
      "Saldo (Rp.)",
    ];
    headers.forEach((h, i) => styleHeader(ws.getCell(headerRow, i + 2)));
    headers.forEach((h, i) => {
      ws.getCell(headerRow, i + 2).value = h;
    });
    row++;

    const dataStart = row;
    const padded = [...b.rows];
    while (padded.length < BANK_DATA_ROWS) {
      padded.push({
        no: padded.length + 1,
        date: null,
        description: "",
        proofNo: "",
        debit: 0,
        credit: 0,
        balance: 0,
      });
    }
    const useRows = padded.slice(0, Math.max(BANK_DATA_ROWS, b.rows.length));

    for (let i = 0; i < useRows.length; i++) {
      const r = useRows[i]!;
      const excelRow = dataStart + i;
      const noCell = ws.getCell(excelRow, 2);
      noCell.value = r.no || i + 1;
      styleCell(noCell, { align: "center" });

      const dCell = ws.getCell(excelRow, 3);
      dCell.value = r.date ? fmtDate(r.date) : "";
      styleCell(dCell, { align: "center" });

      const uCell = ws.getCell(excelRow, 4);
      uCell.value = r.description || "";
      styleCell(uCell);

      const pCell = ws.getCell(excelRow, 5);
      pCell.value = r.proofNo || "";
      styleCell(pCell, { align: "center" });

      const gCell = ws.getCell(excelRow, 6);
      gCell.value = r.debit || null;
      gCell.numFmt = RP;
      styleCell(gCell, { align: "right" });

      const hCell = ws.getCell(excelRow, 7);
      hCell.value = r.credit || null;
      hCell.numFmt = RP;
      styleCell(hCell, { align: "right" });

      // Saldo: I = prev + Debet - Kredit
      const bal = ws.getCell(excelRow, 8);
      if (i === 0) {
        bal.value = { formula: `IF(F${excelRow}="",0,F${excelRow})-IF(G${excelRow}="",0,G${excelRow})` };
      } else {
        bal.value = {
          formula: `H${excelRow - 1}+IF(F${excelRow}="",0,F${excelRow})-IF(G${excelRow}="",0,G${excelRow})`,
        };
      }
      bal.numFmt = RP;
      styleCell(bal, { align: "right" });
    }

    const dataEnd = dataStart + useRows.length - 1;
    const totalRow = dataEnd + 1;
    ws.mergeCells(totalRow, 2, totalRow, 5);
    const jum = ws.getCell(totalRow, 2);
    jum.value = "JUMLAH";
    styleCell(jum, { bold: true, align: "center" });
    for (let c = 3; c <= 5; c++) styleCell(ws.getCell(totalRow, c));

    money(ws.getCell(totalRow, 6), `SUM(F${dataStart}:F${dataEnd})`);
    ws.getCell(totalRow, 6).font = { name: "Arial", size: 9, bold: true };
    money(ws.getCell(totalRow, 7), `SUM(G${dataStart}:G${dataEnd})`);
    ws.getCell(totalRow, 7).font = { name: "Arial", size: 9, bold: true };
    money(ws.getCell(totalRow, 8), `H${dataEnd}`);
    ws.getCell(totalRow, 8).font = { name: "Arial", size: 9, bold: true };

    row = totalRow + 3;
    // TTD
    ws.getCell(row, 2).value = "Mengetahui :";
    ws.getCell(row, 5).value = "";
    const placeDate = `${kab || "Malang"}, ${format(new Date(b.year, b.month, 0), "d MMMM yyyy", { locale: localeId })}`;
    ws.getCell(row, 7).value = placeDate;
    row += 1;
    ws.getCell(row, 2).value = "Kepala Sekolah";
    ws.getCell(row, 5).value = "Ketua P2SP";
    ws.getCell(row, 7).value = "Bendahara P2SP";
    row += 1;
    ws.getCell(row, 2).value = school;
    row += 3;
    ws.getCell(row, 2).value = meta.kepalaNama?.trim() || "(nama)";
    ws.getCell(row, 2).font = { underline: true, bold: true, name: "Arial", size: 9 };
    ws.getCell(row, 5).value = meta.ketuaNama?.trim() || "(nama)";
    ws.getCell(row, 5).font = { underline: true, bold: true, name: "Arial", size: 9 };
    ws.getCell(row, 7).value = meta.bendaharaNama?.trim() || "(nama)";
    ws.getCell(row, 7).font = { underline: true, bold: true, name: "Arial", size: 9 };
    row += 1;
    if (meta.kepalaNip?.trim())
      ws.getCell(row, 2).value = `NIP. ${meta.kepalaNip.trim()}`;
    if (meta.ketuaNip?.trim())
      ws.getCell(row, 5).value = `NIP. ${meta.ketuaNip.trim()}`;
    if (meta.bendaharaNip?.trim())
      ws.getCell(row, 7).value = `NIP. ${meta.bendaharaNip.trim()}`;

    row += 2; // gap before next month
    if (bi < blocks.length - 1) {
      ws.getRow(row).addPageBreak();
    }
    row += 1;
  }

  if (blockStarts.length) {
    ws.pageSetup.printArea = blockStarts
      .map((s, idx) => {
        const end =
          idx + 1 < blockStarts.length
            ? blockStarts[idx + 1]! - 2
            : row - 1;
        return `B${s}:H${end}`;
      })
      .join(",");
  }

  return ws;
}

function writeBkuSheet(
  wb: ExcelJS.Workbook,
  block: BkuMonthBlock,
  meta: LpjExcelMeta,
  bankSheetName: string,
  bankClosingCell: string | null,
) {
  const name = `BKU ${block.monthIndex}`;
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ showGridLines: false }],
  });
  setLandscape(ws);

  const widths = [3, 11, 10, 6, 6, 14, 11, 10, 6, 6, 18, 11, 8, 14];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = meta.schoolName.trim().toUpperCase();
  const title = meta.projectTitle.trim().toUpperCase() || school;

  let r = 1;
  ws.mergeCells(r, 2, r, 14);
  ws.getCell(r, 2).value = "BUKU KAS UMUM";
  ws.getCell(r, 2).font = { name: "Arial", size: 14, bold: true };
  ws.getCell(r, 2).alignment = { horizontal: "center" };
  r++;
  ws.mergeCells(r, 2, r, 14);
  ws.getCell(r, 2).value = title;
  ws.getCell(r, 2).font = { name: "Arial", size: 11, bold: true };
  ws.getCell(r, 2).alignment = { horizontal: "center" };
  r += 2;

  ws.getCell(r, 2).value = "Bulan ke";
  ws.getCell(r, 3).value = `: ${block.monthIndex}`;
  ws.getCell(r, 8).value = "Kecamatan";
  ws.getCell(r, 9).value = `: ${loc.kecamatan}`;
  ws.getCell(r, 12).value = "Awal Pembukuan";
  ws.getCell(r, 13).value = `: ${format(block.periodStart, "dd MMMM yyyy", { locale: localeId })}`;
  r++;
  ws.getCell(r, 2).value = "Sekolah";
  ws.getCell(r, 3).value = `: ${school}`;
  ws.getCell(r, 8).value = "Kabupaten";
  ws.getCell(r, 9).value = `: ${kab}`;
  ws.getCell(r, 12).value = "Akhir Pembukuan";
  ws.getCell(r, 13).value = `: ${format(block.periodEnd, "dd MMMM yyyy", { locale: localeId })}`;
  r++;
  ws.getCell(r, 2).value = "Alamat";
  ws.mergeCells(r, 3, r, 6);
  ws.getCell(r, 3).value = `: ${loc.alamat}`;
  ws.getCell(r, 8).value = "Propinsi";
  ws.getCell(r, 9).value = `: ${prov}`;
  r += 2;

  // Section headers
  ws.mergeCells(r, 2, r, 6);
  styleHeader(ws.getCell(r, 2));
  ws.getCell(r, 2).value = "Pemasukan";
  for (let c = 3; c <= 6; c++) styleHeader(ws.getCell(r, c));
  ws.mergeCells(r, 7, r, 14);
  styleHeader(ws.getCell(r, 7));
  ws.getCell(r, 7).value = "Pengeluaran";
  for (let c = 8; c <= 14; c++) styleHeader(ws.getCell(r, c));
  r++;

  const colHeaders = [
    "Tanggal",
    "Uraian",
    "",
    "",
    "Jumlah (Rp.)",
    "Tanggal",
    "Status",
    "Qty",
    "Sat",
    "Keterangan",
    "No. Bukti",
    "Jenis Biaya",
    "Jumlah (Rp.)",
  ];
  colHeaders.forEach((h, i) => {
    const cell = ws.getCell(r, i + 2);
    cell.value = h;
    styleHeader(cell);
  });
  ws.mergeCells(r, 3, r, 5);
  r++;

  const incomes = [...block.incomes];
  const expenses = [...block.expenses];
  const n = Math.max(incomes.length, expenses.length, BKU_MIN_ROWS);
  while (incomes.length < n) {
    incomes.push({ date: null, description: "", amount: 0 });
  }
  while (expenses.length < n) {
    expenses.push({ date: null, description: "", amount: 0 });
  }

  const dataStart = r;
  for (let i = 0; i < n; i++) {
    const inc = incomes[i]!;
    const exp = expenses[i]!;
    const er = dataStart + i;

    styleCell(ws.getCell(er, 2), { align: "center" });
    ws.getCell(er, 2).value = inc.date ? fmtDate(inc.date) : "";
    ws.mergeCells(er, 3, er, 5);
    styleCell(ws.getCell(er, 3));
    ws.getCell(er, 3).value = inc.description || "";
    for (let c = 4; c <= 5; c++) styleCell(ws.getCell(er, c));
    money(ws.getCell(er, 6), inc.amount || null);

    styleCell(ws.getCell(er, 7), { align: "center" });
    ws.getCell(er, 7).value = exp.date ? fmtDate(exp.date) : "";
    styleCell(ws.getCell(er, 8));
    ws.getCell(er, 8).value = exp.status || "";
    styleCell(ws.getCell(er, 9), { align: "center" });
    ws.getCell(er, 9).value = exp.quantity ?? "";
    styleCell(ws.getCell(er, 10), { align: "center" });
    ws.getCell(er, 10).value = exp.unit || "";
    styleCell(ws.getCell(er, 11));
    ws.getCell(er, 11).value = exp.description || "";
    styleCell(ws.getCell(er, 12), { align: "center" });
    ws.getCell(er, 12).value = exp.proofNo || "";
    styleCell(ws.getCell(er, 13), { align: "center" });
    ws.getCell(er, 13).value = exp.costType || "";
    money(ws.getCell(er, 14), exp.amount || null);
  }
  const dataEnd = dataStart + n - 1;

  const tot = dataEnd + 1;
  ws.mergeCells(tot, 2, tot, 5);
  styleCell(ws.getCell(tot, 2), { bold: true });
  ws.getCell(tot, 2).value = "Jumlah penerimaan bulan ini";
  for (let c = 3; c <= 5; c++) styleCell(ws.getCell(tot, c));
  money(ws.getCell(tot, 6), `SUM(F${dataStart}:F${dataEnd})`);
  ws.getCell(tot, 6).font = { name: "Arial", size: 9, bold: true };

  ws.mergeCells(tot, 7, tot, 13);
  styleCell(ws.getCell(tot, 7), { bold: true });
  ws.getCell(tot, 7).value = "Jumlah pengeluaran bulan ini";
  for (let c = 8; c <= 13; c++) styleCell(ws.getCell(tot, c));
  money(ws.getCell(tot, 14), `SUM(N${dataStart}:N${dataEnd})`);
  ws.getCell(tot, 14).font = { name: "Arial", size: 9, bold: true };

  let fr = tot + 2;
  const dayName = format(block.periodEnd, "EEEE", { locale: localeId });
  const endLong = format(block.periodEnd, "d MMMM yyyy", { locale: localeId });
  ws.mergeCells(fr, 2, fr, 8);
  ws.getCell(fr, 2).value =
    `Buku ini ditutup pada hari ${dayName} tanggal ${endLong} dengan posisi :`;
  fr += 2;
  ws.getCell(fr, 2).value = "Saldo Buku Kas Umum";
  ws.getCell(fr, 2).font = { bold: true, name: "Arial", size: 10 };
  ws.getCell(fr, 10).value = "Catatan :";
  ws.getCell(fr, 10).font = { bold: true, name: "Arial", size: 9 };
  fr++;
  ws.getCell(fr, 2).value = "Saldo Bank";
  ws.getCell(fr, 3).value = ":";
  if (bankClosingCell) {
    money(ws.getCell(fr, 4), `'${bankSheetName}'!${bankClosingCell}`);
  } else {
    money(ws.getCell(fr, 4), block.bankBalance);
  }
  const bankCellRef = `D${fr}`;
  ws.getCell(fr, 10).value = "Jenis Biaya :";
  fr++;
  ws.getCell(fr, 2).value = "Saldo Kas Tunai";
  ws.getCell(fr, 3).value = ":";
  money(ws.getCell(fr, 4), `F${tot}-N${tot}`);
  const cashCellRef = `D${fr}`;
  BKU_COST_TYPE_NOTES.forEach((n, idx) => {
    ws.getCell(fr - 1 + idx, 10).value = `${n.code} : ${n.label}`;
  });
  fr++;
  ws.getCell(fr, 2).value = "Jumlah";
  ws.getCell(fr, 2).font = { bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 3).value = ":";
  money(ws.getCell(fr, 4), `${bankCellRef}+${cashCellRef}`);
  ws.getCell(fr, 4).font = { name: "Arial", size: 9, bold: true };

  fr += 3;
  const placeDate = `${(loc.kecamatan !== "—" ? loc.kecamatan : kab) || "Malang"} ${endLong}`;
  ws.getCell(fr, 2).value = "Mengetahui,";
  ws.getCell(fr, 7).value = "Menyetujui,";
  ws.getCell(fr, 11).value = placeDate;
  fr++;
  ws.getCell(fr, 11).value = "Dibuat Oleh";
  fr++;
  ws.getCell(fr, 2).value = `Kepala Sekolah ${school}`;
  ws.getCell(fr, 2).font = { bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 7).value = "Ketua Tim Pelaksana";
  ws.getCell(fr, 7).font = { bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 11).value = "Bendahara Pembangunan";
  ws.getCell(fr, 11).font = { bold: true, name: "Arial", size: 9 };
  fr += 4;
  ws.getCell(fr, 2).value = meta.kepalaNama?.trim() || "(nama)";
  ws.getCell(fr, 2).font = { underline: true, bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 7).value = meta.ketuaNama?.trim() || "(nama)";
  ws.getCell(fr, 7).font = { underline: true, bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 11).value = meta.bendaharaNama?.trim() || "(nama)";
  ws.getCell(fr, 11).font = { underline: true, bold: true, name: "Arial", size: 9 };

  ws.pageSetup.printArea = `B1:N${fr + 2}`;
  return { sheetName: name.slice(0, 31), totalIncomeCell: `F${tot}`, totalExpenseCell: `N${tot}` };
}

function writeBktSheet(
  wb: ExcelJS.Workbook,
  block: BktMonthBlock,
  meta: LpjExcelMeta,
) {
  const name = `BKT ${block.monthIndex}`;
  const ws = wb.addWorksheet(name.slice(0, 31), {
    views: [{ showGridLines: false }],
  });
  setLandscape(ws);

  [3, 11, 12, 10, 6, 6, 22, 12, 14, 14, 12, 12].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const loc = parseProjectLocation(meta.location);
  const kab = meta.kabKota?.trim() || loc.kabupaten;
  const prov = meta.provinsi?.trim() || loc.propinsi;
  const school = meta.schoolName.trim().toUpperCase();
  const title = meta.projectTitle.trim().toUpperCase() || school;

  let r = 1;
  ws.mergeCells(r, 1, r, 12);
  ws.getCell(r, 1).value = "BUKU KAS TUNAI";
  ws.getCell(r, 1).font = { name: "Arial", size: 14, bold: true };
  ws.getCell(r, 1).alignment = { horizontal: "center" };
  r++;
  ws.mergeCells(r, 1, r, 12);
  ws.getCell(r, 1).value = title;
  ws.getCell(r, 1).font = { name: "Arial", size: 11, bold: true };
  ws.getCell(r, 1).alignment = { horizontal: "center" };
  r += 2;

  ws.getCell(r, 1).value = "Bulan ke";
  ws.getCell(r, 2).value = `: ${block.monthIndex}`;
  ws.getCell(r, 7).value = "Kecamatan";
  ws.getCell(r, 8).value = `: ${loc.kecamatan}`;
  r++;
  ws.getCell(r, 1).value = "Sekolah";
  ws.getCell(r, 2).value = `: ${school}`;
  ws.getCell(r, 7).value = "Kabupaten";
  ws.getCell(r, 8).value = `: ${kab}`;
  r++;
  ws.getCell(r, 1).value = "Alamat";
  ws.mergeCells(r, 2, r, 5);
  ws.getCell(r, 2).value = `: ${loc.alamat}`;
  ws.getCell(r, 7).value = "Propinsi";
  ws.getCell(r, 8).value = `: ${prov}`;
  r += 2;

  // Header 2 rows
  const h1 = r;
  [
    [1, 1, "Tanggal"],
    [2, 2, "No. Bukti"],
    [3, 7, "Uraian"],
    [8, 9, "Jenis Transaksi"],
    [10, 11, "Saldo"],
  ].forEach(([c1, c2, label]) => {
    if (c1 !== c2) ws.mergeCells(h1, c1 as number, h1, c2 as number);
    styleHeader(ws.getCell(h1, c1 as number));
    ws.getCell(h1, c1 as number).value = label as string;
    for (let c = (c1 as number) + 1; c <= (c2 as number); c++)
      styleHeader(ws.getCell(h1, c));
  });
  // rowspan visual: merge tanggal/bukti down
  ws.mergeCells(h1, 1, h1 + 1, 1);
  ws.mergeCells(h1, 2, h1 + 1, 2);
  r++;
  ["", "", "Status", "Qty", "Sat", "Keterangan", "Harga Satuan", "Penerimaan", "Pengeluaran", "Debet", "Kredit"].forEach(
    (h, i) => {
      if (i < 2) return;
      styleHeader(ws.getCell(r, i + 1));
      ws.getCell(r, i + 1).value = h;
    },
  );
  styleHeader(ws.getCell(r, 1));
  styleHeader(ws.getCell(r, 2));
  r++;

  const rows = [...block.rows];
  while (rows.length < BKT_MIN_ROWS) {
    rows.push({
      date: null,
      proofNo: "",
      status: "",
      quantity: null,
      unit: null,
      description: "",
      unitPrice: null,
      income: 0,
      expense: 0,
      saldoDebet: 0,
      saldoKredit: 0,
    });
  }

  const dataStart = r;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const er = dataStart + i;
    const vals: Array<string | number | null> = [
      row.date ? fmtDate(row.date) : "",
      row.proofNo || "",
      row.status || "",
      row.quantity,
      row.unit || "",
      row.description || "",
      row.unitPrice,
      row.income || null,
      row.expense || null,
    ];
    vals.forEach((v, idx) => {
      const cell = ws.getCell(er, idx + 1);
      cell.value = v ?? "";
      if (idx >= 6) {
        cell.numFmt = RP;
        styleCell(cell, { align: "right" });
      } else {
        styleCell(cell, {
          align: idx === 0 || idx === 1 || idx === 3 || idx === 4 ? "center" : "left",
        });
      }
    });

    // Helper running balance in col 12 (hidden logic via Debet/Kredit display)
    // O style: use col 12 for running, 10/11 show sides
    const run = ws.getCell(er, 12);
    if (i === 0) {
      run.value = {
        formula: `IF(H${er}="",0,H${er})-IF(I${er}="",0,I${er})`,
      };
    } else {
      run.value = {
        formula: `L${er - 1}+IF(H${er}="",0,H${er})-IF(I${er}="",0,I${er})`,
      };
    }
    run.numFmt = RP;
    // Don't show helper - actually show in J/K
    // Simpler: put running in J/K directly
    const debet = ws.getCell(er, 10);
    debet.value = { formula: `IF(L${er}>=0,L${er},0)` };
    debet.numFmt = RP;
    styleCell(debet, { align: "right" });
    const kredit = ws.getCell(er, 11);
    kredit.value = { formula: `IF(L${er}<0,-L${er},0)` };
    kredit.numFmt = RP;
    styleCell(kredit, { align: "right" });
    styleCell(run, { align: "right" });
    run.font = { name: "Arial", size: 8, color: { argb: "FFAAAAAA" } };
  }
  const dataEnd = dataStart + rows.length - 1;

  // Hide helper col visually by narrow width - keep for formulas
  ws.getColumn(12).width = 3;

  const tot = dataEnd + 1;
  ws.mergeCells(tot, 1, tot, 7);
  styleCell(ws.getCell(tot, 1), { bold: true, align: "center" });
  ws.getCell(tot, 1).value = "JUMLAH";
  for (let c = 2; c <= 7; c++) styleCell(ws.getCell(tot, c));
  money(ws.getCell(tot, 8), `SUM(H${dataStart}:H${dataEnd})`);
  money(ws.getCell(tot, 9), `SUM(I${dataStart}:I${dataEnd})`);
  money(ws.getCell(tot, 10), `J${dataEnd}`);
  money(ws.getCell(tot, 11), `K${dataEnd}`);
  for (let c = 8; c <= 11; c++) {
    ws.getCell(tot, c).font = { name: "Arial", size: 9, bold: true };
  }

  let fr = tot + 3;
  const placeDate = `${(loc.kecamatan !== "—" ? loc.kecamatan : kab) || "Malang"} ${format(block.periodEnd, "d MMMM yyyy", { locale: localeId })}`;
  ws.getCell(fr, 1).value = "Mengetahui,";
  ws.getCell(fr, 5).value = "Menyetujui,";
  ws.getCell(fr, 9).value = placeDate;
  fr++;
  ws.getCell(fr, 9).value = "Dibuat Oleh";
  fr++;
  ws.getCell(fr, 1).value = `Kepala Sekolah ${school}`;
  ws.getCell(fr, 1).font = { bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 5).value = "Ketua Tim Pelaksana";
  ws.getCell(fr, 5).font = { bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 9).value = "Bendahara Pembangunan";
  ws.getCell(fr, 9).font = { bold: true, name: "Arial", size: 9 };
  fr += 4;
  ws.getCell(fr, 1).value = meta.kepalaNama?.trim() || "(nama)";
  ws.getCell(fr, 1).font = { underline: true, bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 5).value = meta.ketuaNama?.trim() || "(nama)";
  ws.getCell(fr, 5).font = { underline: true, bold: true, name: "Arial", size: 9 };
  ws.getCell(fr, 9).value = meta.bendaharaNama?.trim() || "(nama)";
  ws.getCell(fr, 9).font = { underline: true, bold: true, name: "Arial", size: 9 };

  ws.pageSetup.printArea = `A1:K${fr + 2}`;
}

export async function buildLpjExcelWorkbook(input: {
  meta: LpjExcelMeta;
  bankBlocks: BankMonthBlock[];
  bkuBlocks: BkuMonthBlock[];
  bktBlocks: BktMonthBlock[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kas Proyek — LPJ";
  wb.created = new Date();

  if (input.bankBlocks.length > 0) {
    writeBankSheet(wb, input.bankBlocks, input.meta);
  }
  for (const bku of input.bkuBlocks) {
    writeBkuSheet(wb, bku, input.meta, "BUKU BANK", null);
  }
  for (const bkt of input.bktBlocks) {
    writeBktSheet(wb, bkt, input.meta);
  }

  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet("Kosong");
    ws.getCell(1, 1).value = "Belum ada data buku kas untuk diekspor.";
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

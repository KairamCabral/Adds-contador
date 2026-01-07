import ExcelJS from "exceljs";

import { reports, ReportView } from "@/app/relatorios/config";
import { serializeValue } from "./format";

export async function buildXlsx(
  view: ReportView,
  rows: Record<string, unknown>[],
) {
  const config = reports[view];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(config.title);

  sheet.columns = config.columns.map((col) => ({
    header: col.label,
    key: col.key,
  }));

  rows.forEach((row) => {
    const record: Record<string, unknown> = {};
    config.columns.forEach((col) => {
      record[col.key] = serializeValue(row[col.key]);
    });
    sheet.addRow(record);
  });

  return workbook.xlsx.writeBuffer();
}


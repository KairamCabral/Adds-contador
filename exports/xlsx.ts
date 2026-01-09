import ExcelJS from "exceljs";

import { reports, ReportView } from "@/app/relatorios/config";
import { serializeValueForExcel } from "./format";

export async function buildXlsx(
  view: ReportView,
  rows: Record<string, unknown>[],
) {
  const config = reports[view];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(config.title);

  // Configurar colunas com largura automática
  sheet.columns = config.columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: 20, // Largura padrão
  }));

  // Estilo do cabeçalho
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Adicionar dados
  rows.forEach((row) => {
    const record: Record<string, unknown> = {};
    config.columns.forEach((col) => {
      const value = serializeValueForExcel(row[col.key]);
      record[col.key] = value;
    });
    sheet.addRow(record);
  });

  // Formatar células de data e número
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Pular cabeçalho
    
    config.columns.forEach((col, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      
      // Se é data, aplicar formato brasileiro
      if (cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
      }
      // Se é número, aplicar formato brasileiro
      else if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // Ajustar largura das colunas automaticamente
  sheet.columns.forEach((column) => {
    if (!column) return;
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 10;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50); // Max 50 caracteres
  });

  return workbook.xlsx.writeBuffer();
}


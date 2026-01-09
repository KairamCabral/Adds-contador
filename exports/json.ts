import { reports, ReportView } from "@/app/relatorios/config";
import { serializeValue } from "./format";

/**
 * Converte dados do relatório para JSON formatado
 * @param view - Tipo de relatório
 * @param rows - Linhas de dados
 * @returns Buffer com JSON formatado
 */
export async function buildJson(
  view: ReportView,
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const config = reports[view];

  // Estrutura do JSON de exportação
  const exportData = {
    metadata: {
      report: config.title,
      view: view,
      exportedAt: new Date().toISOString(),
      totalRecords: rows.length,
      columns: config.columns.map((col) => ({
        key: col.key,
        label: col.label,
      })),
    },
    data: rows.map((row) => {
      const record: Record<string, unknown> = {};
      config.columns.forEach((col) => {
        record[col.key] = serializeValue(row[col.key]);
      });
      return record;
    }),
  };

  // Gerar JSON formatado (com indentação para legibilidade)
  const jsonString = JSON.stringify(exportData, null, 2);

  return Buffer.from(jsonString, "utf-8");
}


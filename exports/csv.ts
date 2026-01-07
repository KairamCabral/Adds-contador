import { format } from "@fast-csv/format";

import { reports, ReportView } from "@/app/relatorios/config";
import { serializeValue } from "./format";

export async function buildCsv(view: ReportView, rows: Record<string, unknown>[]) {
  const config = reports[view];
  const headers = config.columns.map((c) => c.label);

  const stream = format({ headers, delimiter: ";" });
  const chunks: Buffer[] = [];

  stream.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    config.columns.forEach((col) => {
      record[col.label] = serializeValue(row[col.key]);
    });
    stream.write(record);
  }

  stream.end();

  await new Promise((resolve) => stream.on("end", resolve));

  return Buffer.concat(chunks);
}


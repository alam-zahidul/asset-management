import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { getActiveFields, FieldDefinition } from './fieldService';
import db from '../config/database';

interface ExportOptions {
  format: 'xlsx' | 'csv' | 'pdf';
  fieldIds?: string[];
  filters?: Record<string, unknown>;
  search?: string;
}

export async function exportAssets(options: ExportOptions): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  // Get fields to export
  let fields: FieldDefinition[];
  if (options.fieldIds?.length) {
    const allFields = await getActiveFields();
    fields = allFields.filter((f) => options.fieldIds!.includes(f.id));
    // Maintain the requested order
    fields.sort((a, b) => options.fieldIds!.indexOf(a.id) - options.fieldIds!.indexOf(b.id));
  } else {
    fields = (await getActiveFields()).filter((f) => f.is_exportable);
  }

  // Query assets
  const query = db('app.assets').where('is_active', true);

  if (options.search) {
    query.whereRaw("asset_tag ILIKE ? OR field_values::text ILIKE ?", [`%${options.search}%`, `%${options.search}%`]);
  }

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (key === 'asset_tag') {
        query.where('asset_tag', 'ILIKE', `%${value}%`);
      } else if (value !== undefined && value !== null && value !== '') {
        query.whereRaw("field_values->>? ILIKE ?", [key, `%${value}%`]);
      }
    }
  }

  const assets = await query.orderBy('created_at', 'desc').select('*');

  // Build column headers and data rows
  const headers = ['Asset Tag', ...fields.map((f) => f.display_name)];
  const rows = assets.map((asset) => {
    const values = typeof asset.field_values === 'string' ? JSON.parse(asset.field_values) : asset.field_values;
    return [asset.asset_tag, ...fields.map((f) => values[f.field_key] ?? '')];
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

  switch (options.format) {
    case 'csv':
      return exportCsv(headers, rows, timestamp);
    case 'pdf':
      return exportPdf(headers, rows, fields, timestamp);
    case 'xlsx':
    default:
      return exportExcel(headers, rows, timestamp);
  }
}

function exportCsv(headers: string[], rows: unknown[][], timestamp: string): { buffer: Buffer; contentType: string; fileName: string } {
  const output = stringify([headers, ...rows]);
  return {
    buffer: Buffer.from(output, 'utf-8'),
    contentType: 'text/csv',
    fileName: `asset-export-${timestamp}.csv`,
  };
}

async function exportExcel(headers: string[], rows: unknown[][], timestamp: string): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Asset Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Assets');

  // Header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Data rows
  for (const row of rows) {
    const dataRow = worksheet.addRow(row);
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  }

  // Auto-fit columns
  worksheet.columns.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = Math.min(len, 50);
    });
    col.width = maxLen + 2;
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `asset-export-${timestamp}.xlsx`,
  };
}

function exportPdf(headers: string[], rows: unknown[][], fields: FieldDefinition[], timestamp: string): { buffer: Buffer; contentType: string; fileName: string } {
  // Using pdfmake for table-based PDF generation
  const pdfMake = require('pdfmake/build/pdfmake');
  const pdfFonts = require('pdfmake/build/vfs_fonts');
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

  const body = [
    headers.map((h) => ({ text: h, style: 'tableHeader' })),
    ...rows.map((row) => (row as unknown[]).map((cell) => String(cell ?? ''))),
  ];

  const docDefinition = {
    pageOrientation: 'landscape' as const,
    pageSize: 'A3' as const,
    pageMargins: [20, 40, 20, 40] as [number, number, number, number],
    header: {
      text: 'Asset Inventory Report',
      style: 'header',
      margin: [20, 10] as [number, number],
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount} | Generated: ${new Date().toLocaleString()}`,
      alignment: 'center' as const,
      margin: [0, 10] as [number, number],
      fontSize: 8,
    }),
    content: [
      {
        table: {
          headerRows: 1,
          widths: headers.map(() => '*'),
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#2563EB' : rowIndex % 2 === 0 ? '#F3F4F6' : null),
        },
      },
      { text: `\nTotal Records: ${rows.length}`, style: 'summary' },
    ],
    styles: {
      header: { fontSize: 16, bold: true },
      tableHeader: { fontSize: 9, bold: true, color: 'white' },
      summary: { fontSize: 10, italics: true, margin: [0, 10] as [number, number] },
    },
    defaultStyle: { fontSize: 8 },
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);

  return new Promise((resolve, reject) => {
    pdfDoc.getBuffer((buffer: Buffer) => {
      resolve({
        buffer,
        contentType: 'application/pdf',
        fileName: `asset-export-${timestamp}.pdf`,
      });
    });
  }) as unknown as { buffer: Buffer; contentType: string; fileName: string };
}

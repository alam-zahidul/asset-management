import { Readable } from 'stream';
import csvParser from 'csv-parser';
import * as XLSX from 'xlsx';
import { createObjectCsvStringifier } from 'csv-writer';
import PDFDocument from 'pdfkit';
import { query } from '../config/database';
import { fieldService } from './field.service';
import { assetService } from './asset.service';
import { sanitizeObject, sanitizeString } from '../utils/sanitize';
import { authService } from './auth.service';
import { logger } from '../utils/logger';

interface ImportResult {
  importId: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: { row: number; errors: string[] }[];
}

interface ExportParams {
  format: 'xlsx' | 'csv' | 'pdf';
  fields: string[];
  filters?: Record<string, string>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ImportExportService {
  async importFromBuffer(
    buffer: Buffer,
    fileType: 'csv' | 'xlsx',
    fileName: string,
    userId: string,
    ip: string,
    userAgent: string
  ): Promise<ImportResult> {
    // Create import log entry
    const logResult = await query(
      `INSERT INTO inventory.import_logs (file_name, file_type, imported_by, status, started_at)
       VALUES ($1, $2, $3, 'processing', NOW()) RETURNING id`,
      [sanitizeString(fileName), fileType, userId]
    );
    const importId = logResult.rows[0].id;

    try {
      // Parse file
      let rows: Record<string, string>[];
      if (fileType === 'csv') {
        rows = await this.parseCsv(buffer);
      } else {
        rows = this.parseXlsx(buffer);
      }

      const fieldDefs = await fieldService.getActiveFields();
      const fieldKeyMap = new Map(fieldDefs.map((f) => [f.display_name.toLowerCase(), f.field_key]));
      // Also map by field key directly
      fieldDefs.forEach((f) => fieldKeyMap.set(f.field_key.toLowerCase(), f.field_key));

      let successCount = 0;
      let failCount = 0;
      const errors: { row: number; errors: string[] }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Map column headers to field keys
          const mappedData: Record<string, unknown> = {};
          let assetTag: string | undefined;

          for (const [header, value] of Object.entries(row)) {
            const cleanHeader = header.trim().toLowerCase();
            const fieldKey = fieldKeyMap.get(cleanHeader);

            if (cleanHeader === 'asset_tag' || cleanHeader === 'asset tag') {
              assetTag = sanitizeString(String(value));
              continue;
            }

            if (fieldKey && value !== undefined && value !== '') {
              mappedData[fieldKey] = sanitizeString(String(value));
            }
          }

          // Validate data
          const validation = await fieldService.validateAssetData(mappedData);
          if (!validation.valid) {
            errors.push({ row: i + 2, errors: validation.errors }); // +2 for header row + 0-index
            failCount++;
            continue;
          }

          // Check if asset with same tag exists - update
          if (assetTag) {
            const existing = await query(
              'SELECT id FROM inventory.assets WHERE asset_tag = $1',
              [assetTag]
            );

            if (existing.rows.length > 0) {
              await assetService.update(
                existing.rows[0].id,
                { data: mappedData },
                userId,
                ip,
                userAgent
              );
              successCount++;
              continue;
            }
          }

          // Create new asset
          await assetService.create(
            { asset_tag: assetTag, data: mappedData, status: 'active' },
            userId,
            ip,
            userAgent
          );
          successCount++;
        } catch (err) {
          errors.push({ row: i + 2, errors: [(err as Error).message] });
          failCount++;
        }
      }

      // Update import log
      await query(
        `UPDATE inventory.import_logs SET
          total_rows = $1, successful_rows = $2, failed_rows = $3,
          errors = $4, status = 'completed', completed_at = NOW()
         WHERE id = $5`,
        [rows.length, successCount, failCount, JSON.stringify(errors), importId]
      );

      await authService.auditLog(
        userId, 'asset.import', 'import', importId,
        { fileName, totalRows: rows.length, successCount, failCount },
        ip, userAgent
      );

      return { importId, totalRows: rows.length, successfulRows: successCount, failedRows: failCount, errors };
    } catch (err) {
      await query(
        `UPDATE inventory.import_logs SET status = 'failed', errors = $1, completed_at = NOW() WHERE id = $2`,
        [JSON.stringify([{ row: 0, errors: [(err as Error).message] }]), importId]
      );
      throw err;
    }
  }

  async exportAssets(params: ExportParams, userId: string, ip: string, userAgent: string): Promise<Buffer> {
    const { format, fields, filters, sortBy, sortOrder } = params;

    // Get field definitions for display names
    const fieldDefs = await fieldService.getActiveFields();
    const exportFields = fieldDefs.filter(
      (f) => fields.includes(f.field_key) && f.is_exportable
    );

    if (exportFields.length === 0) {
      throw new Error('No valid exportable fields selected');
    }

    // Fetch assets
    const assets = await assetService.list({
      page: 1,
      limit: 100000, // Export all matching
      sortBy,
      sortOrder: sortOrder || 'asc',
      fields: filters,
    });

    // Prepare rows
    const rows = assets.data.map((asset) => {
      const row: Record<string, unknown> = {};
      if (fields.includes('asset_tag')) row['Asset Tag'] = asset.asset_tag;
      if (fields.includes('status')) row['Status'] = asset.status;

      for (const field of exportFields) {
        row[field.display_name] = (asset.data as Record<string, unknown>)?.[field.field_key] ?? '';
      }
      return row;
    });

    await authService.auditLog(
      userId, 'asset.export', 'export', '',
      { format, fieldCount: fields.length, rowCount: rows.length },
      ip, userAgent
    );

    switch (format) {
      case 'xlsx':
        return this.generateXlsx(rows);
      case 'csv':
        return this.generateCsv(rows, exportFields);
      case 'pdf':
        return this.generatePdf(rows, exportFields);
      default:
        throw new Error('Unsupported export format');
    }
  }

  async getImportLogs(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const result = await query(
      `SELECT il.*, u.display_name as imported_by_name FROM inventory.import_logs il
       LEFT JOIN auth.users u ON u.id = il.imported_by
       ORDER BY il.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM inventory.import_logs');

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  private parseCsv(buffer: Buffer): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const results: Record<string, string>[] = [];
      const stream = Readable.from(buffer.toString('utf-8'));

      stream
        .pipe(csvParser({ strict: true, skipLines: 0 }))
        .on('data', (row: Record<string, string>) => {
          results.push(row);
        })
        .on('end', () => resolve(results))
        .on('error', (err: Error) => reject(err));
    });
  }

  private parseXlsx(buffer: Buffer): Record<string, string>[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('No sheets found in Excel file');

    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  private generateXlsx(rows: Record<string, unknown>[]): Buffer {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const maxWidths: number[] = [];
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      headers.forEach((h, i) => {
        maxWidths[i] = Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length));
      });
      worksheet['!cols'] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 50) }));
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  private generateCsv(rows: Record<string, unknown>[], fields: { field_key: string; display_name: string }[]): Buffer {
    if (rows.length === 0) return Buffer.from('');

    const headers = Object.keys(rows[0]);
    const csvStringifier = createObjectCsvStringifier({
      header: headers.map((h) => ({ id: h, title: h })),
    });

    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
    return Buffer.from(csv, 'utf-8');
  }

  private generatePdf(rows: Record<string, unknown>[], fields: { field_key: string; display_name: string }[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Title
      doc.fontSize(16).text('Asset Inventory Report', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
      doc.moveDown();

      if (rows.length === 0) {
        doc.fontSize(12).text('No data to display.');
        doc.end();
        return;
      }

      const headers = Object.keys(rows[0]);
      const colWidth = Math.min((doc.page.width - 60) / headers.length, 120);
      const startX = 30;
      let y = doc.y;

      // Header
      doc.fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, startX + i * colWidth, y, { width: colWidth - 4, lineBreak: false });
      });
      y += 15;
      doc.moveTo(startX, y).lineTo(startX + headers.length * colWidth, y).stroke();
      y += 5;

      // Data rows
      doc.font('Helvetica').fontSize(7);
      for (const row of rows) {
        if (y > doc.page.height - 50) {
          doc.addPage();
          y = 30;
        }

        headers.forEach((h, i) => {
          const val = String(row[h] ?? '');
          doc.text(val.substring(0, 30), startX + i * colWidth, y, { width: colWidth - 4, lineBreak: false });
        });
        y += 12;
      }

      doc.end();
    });
  }
}

export const importExportService = new ImportExportService();

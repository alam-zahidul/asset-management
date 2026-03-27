import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { getActiveFields } from './fieldService';
import { sanitizeString } from '../utils/sanitizer';
import { BadRequestError } from '../utils/errors';

interface ParsedRecord {
  asset_tag: string;
  field_values: Record<string, unknown>;
}

export async function parseUploadedFile(filePath: string, mimeType: string): Promise<ParsedRecord[]> {
  try {
    if (mimeType === 'text/csv' || filePath.endsWith('.csv')) {
      return parseCsvFile(filePath);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      filePath.endsWith('.xlsx') ||
      filePath.endsWith('.xls')
    ) {
      return parseExcelFile(filePath);
    }
    throw new BadRequestError('Unsupported file format. Use CSV or Excel (.xlsx/.xls)');
  } finally {
    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
}

async function parseCsvFile(filePath: string): Promise<ParsedRecord[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  return mapToAssetRecords(records);
}

async function parseExcelFile(filePath: string): Promise<ParsedRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new BadRequestError('Excel file has no worksheets');

  const headers: string[] = [];
  const firstRow = worksheet.getRow(1);
  firstRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase();
  });

  const records: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const record: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        record[header] = cell.value;
      }
    });
    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  });

  return mapToAssetRecords(records);
}

async function mapToAssetRecords(records: Record<string, unknown>[]): Promise<ParsedRecord[]> {
  const fields = await getActiveFields();
  const fieldKeyMap = new Map<string, string>();

  // Build lookup: lowercase display name -> field_key, and field_key -> field_key
  for (const f of fields) {
    fieldKeyMap.set(f.field_key.toLowerCase(), f.field_key);
    fieldKeyMap.set(f.display_name.toLowerCase(), f.field_key);
  }

  return records.map((record) => {
    const fieldValues: Record<string, unknown> = {};
    let assetTag = '';

    for (const [rawKey, value] of Object.entries(record)) {
      const key = rawKey.trim().toLowerCase();

      if (key === 'asset_tag' || key === 'asset tag' || key === 'assettag') {
        assetTag = sanitizeString(String(value || ''));
        continue;
      }

      const mappedKey = fieldKeyMap.get(key);
      if (mappedKey) {
        fieldValues[mappedKey] = typeof value === 'string' ? sanitizeString(value) : value;
      }
    }

    if (!assetTag) {
      // Try to generate from hostname or first unique field
      assetTag = `ASSET-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }

    return { asset_tag: assetTag, field_values: fieldValues };
  });
}

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

/**
 * Sanitize a string value to prevent XSS attacks.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  // Strip HTML tags and sanitize
  let clean = purify.sanitize(value, { ALLOWED_TAGS: [] });
  // Remove null bytes
  clean = clean.replace(/\0/g, '');
  // Trim whitespace
  clean = clean.trim();
  return clean;
}

/**
 * Recursively sanitize all string values in an object.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Sanitize SQL-like inputs - removes common SQL injection patterns.
 * Note: Always use parameterized queries. This is an additional defense layer.
 */
export function sanitizeSqlInput(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim();
}

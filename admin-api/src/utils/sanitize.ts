import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as unknown as Window);

export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  return purify.sanitize(value, { ALLOWED_TAGS: [] }).replace(/\0/g, '').trim();
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item)) as unknown as T;
  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized as T;
  }
  return obj;
}

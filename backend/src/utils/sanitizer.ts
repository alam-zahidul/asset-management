import xss from 'xss';

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return xss(input.trim(), xssOptions);
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : item !== null && typeof item === 'object'
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

import DOMPurify from 'dompurify';

export function sanitize(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
}

export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) => (typeof v === 'string' ? sanitize(v) : v));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

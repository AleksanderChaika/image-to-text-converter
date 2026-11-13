export const PORT = Number(process.env['PORT'] ?? 3000);

export const EXTRA_ALLOWED_ORIGINS = (process.env['CORS_ORIGINS'] ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
export const UPLOAD_FIELD_NAME = 'image';

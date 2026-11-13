export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png'];

export const UNSUPPORTED_FORMAT_ERROR = 'Unsupported file format. Please upload a JPG or PNG image.';
export const FILE_TOO_LARGE_ERROR = 'File is too large. Maximum size is 2 MB.';

function hasAllowedFormat(file: File): boolean {
  if (file.type) {
    return ALLOWED_IMAGE_TYPES.includes(file.type);
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.includes(extension);
}

export function validateImageFile(file: File): string | null {
  if (!hasAllowedFormat(file)) {
    return UNSUPPORTED_FORMAT_ERROR;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return FILE_TOO_LARGE_ERROR;
  }
  return null;
}

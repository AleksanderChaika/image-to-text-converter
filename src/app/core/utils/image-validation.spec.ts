import {
  FILE_TOO_LARGE_ERROR,
  MAX_IMAGE_SIZE_BYTES,
  UNSUPPORTED_FORMAT_ERROR,
  validateImageFile,
} from './image-validation';

function makeFile(name: string, type: string, size = 100): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validateImageFile', () => {
  it('accepts PNG and JPEG', () => {
    expect(validateImageFile(makeFile('a.png', 'image/png'))).toBeNull();
    expect(validateImageFile(makeFile('a.jpg', 'image/jpeg'))).toBeNull();
  });

  it('falls back to the extension when MIME type is empty', () => {
    expect(validateImageFile(makeFile('a.JPEG', ''))).toBeNull();
    expect(validateImageFile(makeFile('a.gif', ''))).toBe(UNSUPPORTED_FORMAT_ERROR);
  });

  it('rejects unsupported formats', () => {
    expect(validateImageFile(makeFile('a.gif', 'image/gif'))).toBe(UNSUPPORTED_FORMAT_ERROR);
    expect(validateImageFile(makeFile('a.pdf', 'application/pdf'))).toBe(UNSUPPORTED_FORMAT_ERROR);
  });

  it('accepts exactly 2 MB and rejects larger files', () => {
    expect(validateImageFile(makeFile('a.png', 'image/png', MAX_IMAGE_SIZE_BYTES))).toBeNull();
    expect(validateImageFile(makeFile('a.png', 'image/png', MAX_IMAGE_SIZE_BYTES + 1))).toBe(
      FILE_TOO_LARGE_ERROR,
    );
  });
});

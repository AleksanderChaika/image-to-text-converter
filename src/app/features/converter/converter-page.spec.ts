import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FILE_TOO_LARGE_ERROR, MAX_IMAGE_SIZE_BYTES } from '../../core/utils/image-validation';
import { ConverterPage } from './converter-page';

describe('ConverterPage', () => {
  let fixture: ComponentFixture<ConverterPage>;
  let el: HTMLElement;
  let counter: number;
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;

  const png = (size = 100, name = 'a.png') =>
    new File([new Uint8Array(size)], name, { type: 'image/png' });

  const select = async (file: File) => {
    const input = el.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  const extractButton = () =>
    [...el.querySelectorAll('button')].find((b) => /Extract/.test(b.textContent ?? ''))!;

  beforeEach(async () => {
    counter = 0;
    createUrl = vi.fn(() => `blob:mock-${++counter}`);
    revokeUrl = vi.fn();
    URL.createObjectURL = createUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeUrl as unknown as typeof URL.revokeObjectURL;

    await TestBed.configureTestingModule({
      imports: [ConverterPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ConverterPage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('keeps Extract Text disabled until an image is selected', async () => {
    expect(extractButton().disabled).toBe(true);
    await select(png());
    expect(extractButton().disabled).toBe(false);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('blob:mock-1');
  });

  it('shows an error and keeps the previous image when a file is invalid', async () => {
    await select(png());
    await select(png(MAX_IMAGE_SIZE_BYTES + 1, 'big.png'));

    expect(el.querySelector('[role=alert]')?.textContent).toContain(FILE_TOO_LARGE_ERROR);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('blob:mock-1');
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it('clears the error and revokes the old URL after a valid replacement', async () => {
    await select(png());
    await select(png(MAX_IMAGE_SIZE_BYTES + 1));
    await select(png(200, 'b.png'));

    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(revokeUrl).toHaveBeenCalledWith('blob:mock-1');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('blob:mock-2');
  });

  it('removes the image, revokes the URL and restores the empty state', async () => {
    await select(png());
    el.querySelector<HTMLButtonElement>('.preview__remove')!.click();
    await fixture.whenStable();

    expect(revokeUrl).toHaveBeenCalledWith('blob:mock-1');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('Image preview will appear here');
    expect(extractButton().disabled).toBe(true);
  });

  it('revokes the URL on destroy', async () => {
    await select(png());
    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledWith('blob:mock-1');
  });

  describe('text extraction', () => {
    const extract = async () => {
      extractButton().click();
      await fixture.whenStable();
    };

    it('sends the image, shows loading, then shows the recognized text', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());
      await extract();

      const req = http.expectOne('http://localhost:3000/api/ocr');
      expect(req.request.method).toBe('POST');
      expect((req.request.body as FormData).get('image')).toBeInstanceOf(File);
      expect(extractButton().disabled).toBe(true);
      expect(extractButton().textContent).toContain('Extracting');

      extractButton().click();
      http.expectNone('http://localhost:3000/api/ocr');

      req.flush({ text: 'Hello world' });
      await fixture.whenStable();

      expect(el.querySelector('textarea')!.value).toBe('Hello world');
      expect(extractButton().disabled).toBe(false);
      http.verify();
    });

    it('shows the server error message and allows retrying', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());
      await extract();

      http
        .expectOne('http://localhost:3000/api/ocr')
        .flush({ error: { message: 'Quota exceeded' } }, { status: 429, statusText: 'Too Many' });
      await fixture.whenStable();

      expect(el.querySelector('.converter__error')?.textContent).toContain('Quota exceeded');
      expect(extractButton().disabled).toBe(false);
    });

    it('shows a network error when the backend is unreachable', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());
      await extract();

      http.expectOne('http://localhost:3000/api/ocr').error(new ProgressEvent('error'));
      await fixture.whenStable();

      expect(el.querySelector('.converter__error')?.textContent).toContain('Cannot reach the server');
    });

    it('cancels the request and clears the result when the image is removed', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());
      await extract();
      const req = http.expectOne('http://localhost:3000/api/ocr');

      el.querySelector<HTMLButtonElement>('.preview__remove')!.click();
      await fixture.whenStable();

      expect(req.cancelled).toBe(true);
      expect(extractButton().disabled).toBe(true);
    });

    it('recovers from a client timeout: shows the message, hides loading, allows retry', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());

      vi.useFakeTimers();
      try {
        extractButton().click();
        http.expectOne('http://localhost:3000/api/ocr');
        vi.advanceTimersByTime(35_000);
      } finally {
        vi.useRealTimers();
      }
      await fixture.whenStable();

      expect(el.querySelector('.converter__error')?.textContent).toContain('took too long');
      expect(extractButton().disabled).toBe(false);
      expect(extractButton().textContent).not.toContain('Extracting');
    });

    it('tells the user when no text was found', async () => {
      const http = TestBed.inject(HttpTestingController);
      await select(png());
      await extract();
      http.expectOne('http://localhost:3000/api/ocr').flush({ text: '' });
      await fixture.whenStable();

      expect(el.textContent).toContain('No text was found in this image.');
    });
  });
});

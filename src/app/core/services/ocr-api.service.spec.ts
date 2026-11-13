import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OCR_REQUEST_TIMEOUT_MS, OcrApiService } from './ocr-api.service';

describe('OcrApiService', () => {
  let service: OcrApiService;
  let http: HttpTestingController;
  const file = new File(['x'], 'a.png', { type: 'image/png' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OcrApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('posts multipart form data and maps the response to text', () => {
    let result: string | undefined;
    service.extractText(file).subscribe((text) => (result = text));

    const req = http.expectOne('http://localhost:3000/api/ocr');
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).get('image')).toBeInstanceOf(File);
    req.flush({ text: 'abc' });

    expect(result).toBe('abc');
  });

  it('uses the backend error message when available', () => {
    let message = '';
    service.extractText(file).subscribe({ error: (e: Error) => (message = e.message) });
    http
      .expectOne('http://localhost:3000/api/ocr')
      .flush({ error: { message: 'Too big' } }, { status: 413, statusText: 'Payload' });
    expect(message).toBe('Too big');
  });

  it('falls back to a generic message for unexpected responses', () => {
    let message = '';
    service.extractText(file).subscribe({ error: (e: Error) => (message = e.message) });
    http.expectOne('http://localhost:3000/api/ocr').flush('oops', { status: 500, statusText: 'Err' });
    expect(message).toContain('Something went wrong');
  });

  describe('timeout', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('uses a 35 second timeout', () => {
      expect(OCR_REQUEST_TIMEOUT_MS).toBe(35_000);
    });

    it('fails with a friendly message and cancels the request after 35 seconds', () => {
      let message = '';
      service.extractText(file).subscribe({ error: (e: Error) => (message = e.message) });
      const req = http.expectOne('http://localhost:3000/api/ocr');

      vi.advanceTimersByTime(OCR_REQUEST_TIMEOUT_MS - 1);
      expect(message).toBe('');
      expect(req.cancelled).toBe(false);

      vi.advanceTimersByTime(1);
      expect(message).toBe('The request took too long. Please try again.');
      expect(req.cancelled).toBe(true);
    });

    it('does not time out when the response arrives in time', () => {
      let result: string | undefined;
      let failed = false;
      service.extractText(file).subscribe({
        next: (text) => (result = text),
        error: () => (failed = true),
      });

      vi.advanceTimersByTime(OCR_REQUEST_TIMEOUT_MS - 1000);
      http.expectOne('http://localhost:3000/api/ocr').flush({ text: 'late but fine' });
      vi.advanceTimersByTime(OCR_REQUEST_TIMEOUT_MS * 2);

      expect(result).toBe('late but fine');
      expect(failed).toBe(false);
    });
  });
});

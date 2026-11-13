import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, map, throwError, timeout } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiErrorResponse, OcrResponse } from '../models/ocr-response.model';

const NETWORK_ERROR = 'Cannot reach the server. Make sure the backend is running and try again.';
const TIMEOUT_ERROR = 'The request took too long. Please try again.';
const GENERIC_ERROR = 'Something went wrong while extracting text. Please try again.';

export const OCR_REQUEST_TIMEOUT_MS = 35_000;

@Injectable({ providedIn: 'root' })
export class OcrApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  extractText(file: File): Observable<string> {
    const body = new FormData();
    body.append('image', file, file.name);

    return this.http.post<OcrResponse>(`${this.baseUrl}/api/ocr`, body).pipe(
      timeout(OCR_REQUEST_TIMEOUT_MS),
      map((response) => response.text),
      catchError((error: unknown) => throwError(() => new Error(this.toMessage(error)))),
    );
  }

  private toMessage(error: unknown): string {
    if (error instanceof TimeoutError) {
      return TIMEOUT_ERROR;
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return NETWORK_ERROR;
      }
      const body = error.error as ApiErrorResponse | null;
      return body?.error?.message ?? GENERIC_ERROR;
    }
    return GENERIC_ERROR;
  }
}

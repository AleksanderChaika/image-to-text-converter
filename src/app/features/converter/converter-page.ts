import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { OcrApiService } from '../../core/services/ocr-api.service';
import { validateImageFile } from '../../core/utils/image-validation';
import { ImagePreview } from './components/image-preview/image-preview';
import { ResultPanel } from './components/result-panel/result-panel';
import { UploadArea } from './components/upload-area/upload-area';

@Component({
  selector: 'app-converter-page',
  imports: [UploadArea, ImagePreview, ResultPanel],
  templateUrl: './converter-page.html',
  styleUrl: './converter-page.scss',
})
export class ConverterPage {
  private readonly ocrApi = inject(OcrApiService);
  private extraction?: Subscription;

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly isExtracting = signal(false);
  protected readonly extractedText = signal<string | null>(null);
  protected readonly extractError = signal<string | null>(null);

  protected readonly hasImage = computed(() => this.selectedFile() !== null);
  protected readonly canExtract = computed(() => this.hasImage() && !this.isExtracting());

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.extraction?.unsubscribe();
      this.revokePreviewUrl();
    });
  }

  protected onFileSelected(file: File): void {
    const validationError = validateImageFile(file);
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    this.error.set(null);
    this.resetExtraction();
    this.revokePreviewUrl();
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  protected onRemoveImage(): void {
    this.resetExtraction();
    this.revokePreviewUrl();
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.error.set(null);
  }

  protected onExtractText(): void {
    const file = this.selectedFile();
    if (!file || this.isExtracting()) {
      return;
    }

    this.isExtracting.set(true);
    this.extractError.set(null);
    this.extractedText.set(null);

    this.extraction = this.ocrApi.extractText(file).subscribe({
      next: (text) => {
        this.extractedText.set(text);
        this.isExtracting.set(false);
      },
      error: (error: Error) => {
        this.extractError.set(error.message);
        this.isExtracting.set(false);
      },
    });
  }

  private resetExtraction(): void {
    this.extraction?.unsubscribe();
    this.isExtracting.set(false);
    this.extractedText.set(null);
    this.extractError.set(null);
  }

  private revokePreviewUrl(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

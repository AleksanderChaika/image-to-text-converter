import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-upload-area',
  templateUrl: './upload-area.html',
  styleUrl: './upload-area.scss',
})
export class UploadArea {
  readonly error = input<string | null>(null);
  readonly fileSelected = output<File>();

  protected readonly dragging = signal(false);

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}

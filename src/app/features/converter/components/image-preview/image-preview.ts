import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-image-preview',
  templateUrl: './image-preview.html',
  styleUrl: './image-preview.scss',
})
export class ImagePreview {
  readonly src = input<string | null>(null);
  readonly fileName = input<string | null>(null);
  readonly remove = output<void>();
}

import { Component, DestroyRef, inject, input, signal } from '@angular/core';

type CopyState = 'idle' | 'copied' | 'failed';

const FEEDBACK_DURATION_MS = 2000;

@Component({
  selector: 'app-result-panel',
  templateUrl: './result-panel.html',
  styleUrl: './result-panel.scss',
})
export class ResultPanel {
  readonly text = input<string | null>(null);
  readonly loading = input(false);

  protected readonly copyState = signal<CopyState>('idle');
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.feedbackTimer));
  }

  protected async copyText(): Promise<void> {
    const text = this.text();
    if (!text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.showFeedback('copied');
    } catch {
      this.showFeedback('failed');
    }
  }

  private showFeedback(state: CopyState): void {
    this.copyState.set(state);
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.copyState.set('idle'), FEEDBACK_DURATION_MS);
  }
}

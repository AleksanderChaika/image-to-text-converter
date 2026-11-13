import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultPanel } from './result-panel';

describe('ResultPanel', () => {
  let fixture: ComponentFixture<ResultPanel>;
  let el: HTMLElement;
  let writeText: ReturnType<typeof vi.fn>;

  const copyButton = () =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.match(/Copy|Copied/))!;

  beforeEach(async () => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await TestBed.configureTestingModule({ imports: [ResultPanel] }).compileComponents();
    fixture = TestBed.createComponent(ResultPanel);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('disables Copy Text when there is no text', () => {
    expect(copyButton().disabled).toBe(true);
  });

  it('shows the text and copies it with the Clipboard API', async () => {
    fixture.componentRef.setInput('text', 'Hello world');
    await fixture.whenStable();

    expect(el.querySelector('textarea')!.value).toBe('Hello world');
    copyButton().click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith('Hello world');
    expect(copyButton().textContent).toContain('Copied!');
    expect(el.querySelector('[role=status]')?.textContent).toContain('copied to clipboard');
  });

  it('reports a failed copy', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    fixture.componentRef.setInput('text', 'Hello');
    await fixture.whenStable();

    copyButton().click();
    await fixture.whenStable();

    expect(copyButton().textContent).toContain('Copy failed');
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvFloatingContainer } from './floating-container';

/**
 * Angular does not attach component styles in the test environment, so the
 * stylesheet source is read directly. The backdrop and safe-area rules are now
 * shared with `mlv-page-dock[appearance="floating"]` through
 * `floating-container.mixins.scss`, so this asserts the recipe is still sourced
 * from that single definition rather than re-inlined here.
 *
 * `new URL(…, import.meta.url)` is rewritten by Vite into an asset URL, so the
 * sibling stylesheet is resolved from this file's own path instead.
 */
const containerScss = readFileSync(
  fileURLToPath(import.meta.url).replace(/\.spec\.ts$/, '.scss'),
  'utf8',
);

@Component({
  template: `
    <footer mlvFloatingContainer="#101014">
      <small>Draft is stored locally.</small>
      <button type="button">Save</button>
    </footer>
  `,
  imports: [MlvFloatingContainer],
})
class FloatingContainerTestHost {}

describe('MlvFloatingContainer', () => {
  it('enhances the host element and applies the backdrop background', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [FloatingContainerTestHost],
    }).createComponent(FloatingContainerTestHost);
    await fixture.whenStable();

    const footer = fixture.nativeElement.querySelector('footer') as HTMLElement;
    expect(footer.classList).toContain('mlv-floating-container');
    expect(
      footer.style.getPropertyValue('--mlv-floating-container-background'),
    ).toBe('#101014');
    expect(footer.querySelector('button')?.textContent).toBe('Save');
  });

  it('leaves the backdrop background unset by default', async () => {
    @Component({
      template: `<div mlvFloatingContainer>
        <button type="button">Ok</button>
      </div>`,
      imports: [MlvFloatingContainer],
    })
    class DefaultHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [DefaultHost],
    }).createComponent(DefaultHost);
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector(
      '.mlv-floating-container',
    ) as HTMLElement;
    expect(
      host.style.getPropertyValue('--mlv-floating-container-background'),
    ).toBe('');
  });

  it('sources the backdrop and safe-area rules from the shared mixins', () => {
    expect(containerScss).toContain(
      "@use './floating-container.mixins' as floating",
    );
    expect(containerScss).toContain('@include floating.backdrop(');
    expect(containerScss).toContain(
      'var(--mlv-floating-container-background, var(--mlv-background-raised))',
    );
    expect(containerScss).toContain('@include floating.safe-area-block-end(');
  });
});

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvChromeColor } from './chrome-color';

@Component({
  template: `
    <div
      class="host"
      [mlvChromeColor]="color()"
      [chromeForeground]="foreground()"
      [style.--brand]="brand()"
    >
      Chrome
    </div>
  `,
  imports: [MlvChromeColor],
})
class ChromeColorTestHost {
  readonly color = signal<string | null>(null);
  readonly foreground = signal<string | null>(null);
  readonly brand = signal<string | null>(null);
}

/** The directive coalesces its CSS reads into one animation frame. */
function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function setup() {
  const fixture = TestBed.configureTestingModule({
    imports: [ChromeColorTestHost],
  }).createComponent(ChromeColorTestHost);
  fixture.detectChanges();
  const host = fixture.nativeElement.querySelector('.host') as HTMLElement;
  return { fixture, host };
}

/** Runs the pending resolution frame and lets its signal writes render. */
async function resolve(
  fixture: Awaited<ReturnType<typeof setup>>['fixture'],
): Promise<void> {
  fixture.detectChanges();
  await waitForAnimationFrame();
  fixture.detectChanges();
}

describe('MlvChromeColor', () => {
  it('resolves a literal background and picks its contrast foreground', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.color.set('#fafafa');
    await resolve(fixture);

    expect(host.style.getPropertyValue('--mlv-chrome-background')).toBe(
      'rgb(250, 250, 250)',
    );
    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(0, 0, 0)',
    );
    // The element is painted too, so the directive is useful on its own —
    // a stylesheet reading the two properties is the *extra*, not the point.
    expect(host.style.backgroundColor).toBe('rgb(250, 250, 250)');
    expect(host.style.color).toBe('rgb(0, 0, 0)');
  });

  it('resolves a colour supplied through a custom property', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.brand.set('#171717');
    fixture.componentInstance.color.set('var(--brand)');
    await resolve(fixture);

    // Resolution happens in the host's own cascade, which is the whole reason
    // a token map cannot do this: nothing but the browser knows what
    // `var(--brand)` is here.
    expect(host.style.getPropertyValue('--mlv-chrome-background')).toBe(
      'rgb(23, 23, 23)',
    );
    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(255, 255, 255)',
    );
  });

  it('resolves a custom-property fallback value', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.color.set('var(--missing, #fafafa)');
    await resolve(fixture);

    expect(host.style.getPropertyValue('--mlv-chrome-background')).toBe(
      'rgb(250, 250, 250)',
    );
  });

  it('recomputes when a referenced custom property changes', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.brand.set('#171717');
    fixture.componentInstance.color.set('var(--brand)');
    await resolve(fixture);

    // Nothing the directive binds to has changed — only what the `var()`
    // resolves to. That is what the ancestor mutation observer is for, and it
    // is the case a theme flip produces.
    fixture.componentInstance.brand.set('#fafafa');
    fixture.detectChanges();
    await fixture.whenStable();
    await resolve(fixture);

    expect(host.style.getPropertyValue('--mlv-chrome-background')).toBe(
      'rgb(250, 250, 250)',
    );
    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(0, 0, 0)',
    );
  });

  it('measures a translucent colour over what is actually behind it', async () => {
    const { fixture, host } = await setup();
    (fixture.nativeElement as HTMLElement).style.backgroundColor = '#ffffff';
    fixture.componentInstance.color.set('rgba(0, 0, 0, 0.1)');
    await resolve(fixture);

    // 10% black on white is nearly white, so the readable foreground is black
    // — judging the colour against itself would have picked white.
    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(0, 0, 0)',
    );
  });

  it('uses an explicit foreground instead of the contrast pick', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.color.set('#171717');
    fixture.componentInstance.foreground.set('#00ff00');
    await resolve(fixture);

    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe(
      'rgb(0, 255, 0)',
    );
  });

  it('writes nothing at all for an unresolvable colour', async () => {
    const { fixture, host } = await setup();
    fixture.componentInstance.color.set('var(--nothing-declares-this)');
    await resolve(fixture);

    // Absent, not empty: a stylesheet's `var(--mlv-chrome-background, …)`
    // fallback is what must apply, and an empty value is still a value.
    expect(host.style.getPropertyValue('--mlv-chrome-background')).toBe('');
    expect(host.style.getPropertyValue('--mlv-chrome-foreground')).toBe('');
    expect(host.style.backgroundColor).toBe('');
  });

  it('exposes the resolved pair as signals', async () => {
    const { fixture } = await setup();
    const directive = fixture.debugElement.children[0] as unknown as {
      injector: { get: typeof TestBed.inject };
    };
    fixture.componentInstance.color.set('#171717');
    await resolve(fixture);

    const chrome = (
      directive.injector as unknown as {
        get: (t: typeof MlvChromeColor) => MlvChromeColor;
      }
    ).get(MlvChromeColor);
    expect(chrome.background()).toBe('rgb(23, 23, 23)');
    expect(chrome.foreground()).toBe('rgb(255, 255, 255)');
  });

  it('has no axe violations', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.color.set('#171717');
    await resolve(fixture);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

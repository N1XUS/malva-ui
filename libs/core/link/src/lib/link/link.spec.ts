import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvLink } from './link';
import { MlvLinkAfter, MlvLinkBefore } from './link.directives';

@Component({
  template: `<a mlvLink href="/test">Test Link</a>`,
  imports: [MlvLink],
})
class TestHostComponent {}

describe('MlvLink', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    await fixture.whenStable();
  });

  it('should create', () => {
    const link = fixture.nativeElement.querySelector('a[mlvLink], a.mlv-link');
    expect(link).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a')).toBeTruthy();
  });
});

/**
 * Accessibility sweep.
 *
 * `a[mlvLink]` keeps the native anchor, so the interesting states are the two
 * it adds on top of it: the `disabled` variant, which is still an `<a href>`
 * but carries `aria-disabled="true"` and `tabindex="-1"` (activation is only
 * suppressed by a `preventDefault`, so the element has to keep announcing that
 * it is off), and the before/after slots from
 * `apps/docs/src/app/pages/link/examples/2`, which wrap the text in extra
 * elements and are where a glyph could steal or dilute the link's name.
 */
describe('MlvLink accessibility', () => {
  @Component({
    imports: [MlvLink, MlvLinkBefore, MlvLinkAfter],
    template: `
      <a mlvLink href="#">Default Link</a>
      <a mlvLink href="#" variant="subtle">Subtle Link</a>
      <a mlvLink href="#" variant="emphasized">Emphasized Link</a>
      <a mlvLink href="#" [disabled]="true" id="off">Disabled Link</a>

      <a mlvLink href="#">
        <svg *mlvLinkBefore aria-hidden="true"></svg>
        Previous
      </a>
      <a mlvLink href="#">
        Next
        <svg *mlvLinkAfter aria-hidden="true"></svg>
      </a>
    `,
  })
  class LinkA11yHost {}

  it('has no axe violations across variants, slots and the disabled state', async () => {
    await TestBed.configureTestingModule({
      imports: [LinkA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(LinkA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: six anchors, each with discernible text; the disabled one is out
    // of the tab order and says so, and both slot wrappers rendered.
    const links = [...host.querySelectorAll('a.mlv-link')];
    expect(links).toHaveLength(6);
    expect(links.every((a) => (a.textContent ?? '').trim().length > 0)).toBe(
      true,
    );
    const off = host.querySelector('#off') as HTMLAnchorElement;
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(off.getAttribute('tabindex')).toBe('-1');
    expect(host.querySelectorAll('.mlv-link__side')).toHaveLength(2);

    await expectNoAxeViolations(host);
  });
});

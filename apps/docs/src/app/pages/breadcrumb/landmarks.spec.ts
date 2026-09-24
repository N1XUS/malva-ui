import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import BreadcrumbBasicExampleComponent from './examples/1';
import BreadcrumbSeparatorExampleComponent from './examples/2';
import BreadcrumbOverflowExampleComponent from './examples/3';
import BreadcrumbProjectedExampleComponent from './examples/4';

/** Every example the `/breadcrumb` page renders, on one page as the route does. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbBasicExampleComponent,
    BreadcrumbSeparatorExampleComponent,
    BreadcrumbOverflowExampleComponent,
    BreadcrumbProjectedExampleComponent,
  ],
  template: `
    <docs-breadcrumb-basic-example />
    <docs-breadcrumb-separator-example />
    <docs-breadcrumb-overflow-example />
    <docs-breadcrumb-projected-example />
  `,
})
class BreadcrumbPageHostComponent {}

/**
 * Every trail is a `navigation` landmark, and the page puts eleven of them on
 * one screen. With the i18n default each was "Breadcrumb", so `landmark-unique`
 * fired on the component's own documentation page — the failure #326 fixes.
 */
describe('/breadcrumb page landmarks', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.configureTestingModule({
      imports: [BreadcrumbPageHostComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).createComponent(BreadcrumbPageHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('names every trail distinctly', async () => {
    const names = Array.from((await render()).querySelectorAll('nav')).map(
      (nav) => nav.getAttribute('aria-label'),
    );

    expect(names).toHaveLength(11);
    expect(names.includes('Breadcrumb')).toBe(false);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no axe violations across all examples', async () => {
    // Unnarrowed: `landmark-unique` passes only because every trail carries
    // its own `ariaLabel`.
    await expectNoAxeViolations(await render());
  });
});

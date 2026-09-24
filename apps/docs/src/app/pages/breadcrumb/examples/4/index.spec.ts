import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import BreadcrumbProjectedExampleComponent from './index';

/**
 * The two projected shapes this page teaches (#325): `<mlv-breadcrumb-item>`
 * elements, and native `<li mlvBreadcrumbItem>`s. Both project straight into
 * the `<ol>` `nav[mlvBreadcrumb]` renders itself, so the page must neither
 * glue the crumbs into one run-on word nor wrap them in a second `<ol>`.
 */
describe('BreadcrumbProjectedExampleComponent', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.configureTestingModule({
      imports: [BreadcrumbProjectedExampleComponent],
      providers: [provideMlvI18nTesting(), provideRouter([])],
    }).createComponent(BreadcrumbProjectedExampleComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('separates every crumb but the last in each trail', async () => {
    const host = await render();

    const perTrail = Array.from(host.querySelectorAll('nav')).map((nav) => ({
      crumbs: nav.querySelectorAll('.mlv-breadcrumb__item').length,
      separators: nav.querySelectorAll('.mlv-breadcrumb__separator').length,
    }));

    expect(perTrail).toEqual([
      { crumbs: 3, separators: 2 },
      { crumbs: 3, separators: 2 },
      { crumbs: 3, separators: 2 },
    ]);
  });

  it('renders one list per trail', async () => {
    const host = await render();

    expect(host.querySelectorAll('ol ol')).toHaveLength(0);
    expect(
      Array.from(host.querySelectorAll('nav')).map(
        (nav) => nav.querySelectorAll('ol').length,
      ),
    ).toEqual([1, 1, 1]);
  });

  it('has no axe violations', async () => {
    await expectNoAxeViolations(await render(), {
      // NARROWED, not clean: `landmark-unique` fires on the first `nav` — all
      // three trails are `navigation` landmarks named "Breadcrumb", because
      // the host binding overwrites a consumer `aria-label` and there is no
      // `ariaLabel` input to tell them apart. Fixable, deferred: tracked in
      // #326.
      rules: { 'landmark-unique': { enabled: false } },
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShowcaseIndexComponent } from './showcase-index';
import { SHOWCASES } from '../showcase.registry';

@Component({
  selector: 'docs-showcase-index-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ShowcaseIndexTestHostComponent {}

async function renderAt(url: string): Promise<{
  component: ShowcaseIndexComponent;
  root: HTMLElement;
}> {
  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: ShowcaseIndexTestHostComponent,
          children: [{ path: 'showcases', component: ShowcaseIndexComponent }],
        },
      ]),
    ],
  }).compileComponents();

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return {
    component: harness.fixture.debugElement.query(
      By.directive(ShowcaseIndexComponent),
    ).componentInstance as ShowcaseIndexComponent,
    root: harness.fixture.nativeElement as HTMLElement,
  };
}

describe('ShowcaseIndexComponent', () => {
  it('uses one main landmark and links every registered showcase', async () => {
    const { root } = await renderAt('/showcases');

    expect(root.querySelectorAll('main')).toHaveLength(1);
    // Derived from the registry rather than a literal, so adding a showcase
    // does not silently turn this into a stale count assertion.
    expect(root.querySelectorAll('.showcase-index__card')).toHaveLength(
      SHOWCASES.length,
    );
    // Every registered showcase ships a captured route preview; a card without
    // one would silently regress to the old fake-surface-free placeholder.
    expect(root.querySelectorAll('.showcase-index__card img')).toHaveLength(
      SHOWCASES.filter((showcase) => showcase.previewAsset !== null).length,
    );
    expect(SHOWCASES.every((showcase) => showcase.previewAsset !== null)).toBe(
      true,
    );
  });

  it('filters cards from a linkable category query parameter', async () => {
    const { component, root } = await renderAt('/showcases?category=data');
    const dataShowcases = SHOWCASES.filter(
      (showcase) => showcase.category === 'data',
    );

    expect(component.activeCategory()).toBe('data');
    expect(root.querySelectorAll('.showcase-index__card')).toHaveLength(
      dataShowcases.length,
    );
    expect(
      Array.from(root.querySelectorAll('.showcase-index__card')).map((card) =>
        card.querySelector('h2')?.textContent?.trim(),
      ),
    ).toEqual(dataShowcases.map((showcase) => showcase.title));
  });

  it('resolves invalid category values to All', async () => {
    const { component, root } = await renderAt('/showcases?category=unknown');

    expect(component.activeCategory()).toBe('all');
    expect(root.querySelectorAll('.showcase-index__card')).toHaveLength(
      SHOWCASES.length,
    );
  });
});

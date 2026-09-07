import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { Observable } from 'rxjs';
import { MlvResizeObserverService } from '../observers/resize-observer.service';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvFade } from './fade';

describe('MlvFade', () => {
  let component: MlvFade;
  let fixture: ComponentFixture<MlvFade>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvFade],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvFade);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not subscribe to resize observation during server rendering', async () => {
    let subscriptions = 0;

    @Component({
      selector: 'mlv-fade-ssr-host',
      imports: [MlvFade],
      template: '<div mlvFade>Overflowing content</div>',
    })
    class FadeSsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          FadeSsrHost,
          {
            providers: [
              {
                provide: MlvResizeObserverService,
                useValue: {
                  observe: () =>
                    new Observable(() => {
                      subscriptions += 1;
                    }),
                },
              },
            ],
          },
          context,
        ),
      {
        document: '<mlv-fade-ssr-host></mlv-fade-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('mlv-fade');
    expect(subscriptions).toBe(0);
  });
});

@Component({
  selector: 'mlv-fade-a11y-host',
  imports: [MlvFade],
  template: `
    <div mlvFade class="bare">
      <button type="button">First</button>
      <button type="button">Second</button>
    </div>

    <div mlvFade="horizontal" class="horizontal">
      <button type="button">First</button>
      <button type="button">Second</button>
    </div>

    <div mlvFade="vertical" mlvFadeSize="2em" class="vertical">
      <ul>
        <li><a href="#one">One</a></li>
        <li><a href="#two">Two</a></li>
      </ul>
    </div>
  `,
})
class FadeA11yHost {}

/**
 * Accessibility sweep — `[mlvFade]`.
 *
 * The component contributes a wrapper element, BEM classes, a
 * `data-orientation` attribute and four inline custom properties — no role, no
 * name, no tab stop of its own. What a sweep is actually asking, then, is
 * whether wrapping projected content in that element changes how the content
 * is exposed: the wrapper sits between a consumer's container and its
 * children, so it is the shape that could break an owned-children contract or
 * hide a control. Every value `mlvFade` renders is swept, because it is the one
 * input that reaches the DOM as an attribute.
 */
describe('MlvFade accessibility', () => {
  it('has no axe violations in any orientation', async () => {
    await TestBed.configureTestingModule({
      imports: [FadeA11yHost],
    }).compileComponents();
    const fixture = TestBed.createComponent(FadeA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const bare = host.querySelector('.bare') as HTMLElement;
    const horizontal = host.querySelector('.horizontal') as HTMLElement;
    const vertical = host.querySelector('.vertical') as HTMLElement;
    // State: every value `mlvFade` reaches the DOM with. A bare attribute binds
    // the empty string (which is why `''` is in the input's type) rather than
    // the `'horizontal'` default, so it renders a third `data-orientation`.
    expect(bare.getAttribute('data-orientation')).toBe('');
    expect(horizontal.getAttribute('data-orientation')).toBe('horizontal');
    expect(vertical.getAttribute('data-orientation')).toBe('vertical');
    // The wrapper stays roleless, so it never becomes an owner of its children.
    expect(bare.getAttribute('role')).toBeNull();
    expect(horizontal.getAttribute('role')).toBeNull();
    expect(vertical.getAttribute('role')).toBeNull();

    await expectNoAxeViolations(host);
  });
});

import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvButton } from '@malva-ui/core/button';
import { vi } from 'vitest';

import { MlvDrawer } from './drawer/drawer';
import { MlvDrawerBody } from './drawer-body';
import { MlvDrawerContent } from './drawer-content';
import type { MlvDrawerTitleLevel } from './drawer-header';
import { MlvDrawerHeader } from './drawer-header';
import { MlvDrawerService } from './drawer.service';

@Component({
  imports: [
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer [(opened)]="open" [ariaLabelledBy]="ariaLabelledBy()">
      <ng-template mlvDrawerContent>
        <mlv-drawer-header
          [title]="title()"
          [level]="level()"
          [closable]="closable()"
        >
          <button mlvButton class="action" type="button">Create</button>
        </mlv-drawer-header>
        <div mlvDrawerBody>
          <button class="inside" type="button">Inside</button>
        </div>
      </ng-template>
    </mlv-drawer>
  `,
})
class ElementHostComponent {
  readonly open = signal(false);
  readonly title = signal<string | undefined>('Edit product');
  readonly level = signal<MlvDrawerTitleLevel>(2);
  readonly closable = signal(true);
  readonly ariaLabelledBy = signal<string | undefined>(undefined);
}

@Component({
  imports: [MlvDrawer, MlvDrawerContent, MlvDrawerHeader, MlvDrawerBody],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer [(opened)]="open">
      <ng-template mlvDrawerContent>
        <div mlvDrawerHeader class="custom-head">
          <h4>Member access</h4>
          <span class="byline">Joined 2024</span>
        </div>
        <div mlvDrawerBody>Body</div>
      </ng-template>
    </mlv-drawer>
  `,
})
class AttributeHostComponent {
  readonly open = signal(false);
}

@Component({
  imports: [MlvDrawerHeader, MlvDrawerBody],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer-header title="Details" />
    <div mlvDrawerBody>
      <button class="inside" type="button">Inside</button>
    </div>
  `,
})
class ServiceContentComponent {}

/** Shared with {@link AsyncTitleContentComponent}: the ref exposes no component instance. */
const asyncTitle = signal<string | undefined>('Details');

@Component({
  imports: [MlvDrawerHeader, MlvDrawerBody],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer-header [title]="title()" />
    <div mlvDrawerBody>Body</div>
  `,
})
class AsyncTitleContentComponent {
  readonly title = asyncTitle;
}

@Component({
  imports: [MlvDrawerBody],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div mlvDrawerBody>Body</div>`,
})
class BareContentComponent {}

/** The injector of the last component rendered inside a declarative drawer. */
let lastOpenerInjector: Injector | null = null;

@Component({
  selector: 'test-opener',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ``,
})
class OpenerComponent {
  constructor() {
    lastOpenerInjector = inject(Injector);
  }
}

@Component({
  imports: [MlvDrawer, MlvDrawerContent, MlvDrawerBody, OpenerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mlv-drawer [(opened)]="open">
      <ng-template mlvDrawerContent>
        <div mlvDrawerBody><test-opener /></div>
      </ng-template>
    </mlv-drawer>
  `,
})
class NestedHostComponent {
  readonly open = signal(true);
}

function panels(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.mlv-drawer[role="dialog"]'),
  );
}

function panel(): HTMLElement | null {
  return panels()[0] ?? null;
}

function titleEl(): HTMLElement | null {
  return panel()?.querySelector<HTMLElement>('.mlv-drawer__title') ?? null;
}

function closeButton(): HTMLButtonElement | null {
  return (
    panel()?.querySelector<HTMLButtonElement>(
      '.mlv-drawer__close button.mlv-button--close',
    ) ?? null
  );
}

afterEach(() => {
  document
    .querySelectorAll('.cdk-overlay-container')
    .forEach((element) => element.remove());
});

describe('MlvDrawerHeader — element form', () => {
  let fixture: ComponentFixture<ElementHostComponent>;
  let host: ElementHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElementHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ElementHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    host.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('names the drawer by its rendered title', () => {
    const title = titleEl();

    expect(title?.textContent?.trim()).toBe('Edit product');
    expect(title?.id).toBeTruthy();
    expect(panel()?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(panel()?.getAttribute('aria-label')).toBeNull();
  });

  it('renders the title at the requested heading level under one id', async () => {
    expect(titleEl()?.tagName).toBe('H2');
    const id = titleEl()?.id;

    // Above `[mlvDrawerSection]` headings (`<h5>`) the outline must not skip.
    host.level.set(4);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(titleEl()?.tagName).toBe('H4');
    expect(titleEl()?.id).toBe(id);
    expect(panel()?.getAttribute('aria-labelledby')).toBe(id);
  });

  /**
   * The header band as rendered: the title heading that names the dialog, the
   * projected action, and the trailing close button. Swept from
   * `document.body` — the panel is portaled into the CDK overlay container.
   */
  it('has no axe violations with a title, an action and a close button', async () => {
    expect(titleEl()?.textContent?.trim()).toBe('Edit product');
    expect(closeButton()).not.toBeNull();

    await expectNoAxeViolations(document.body);
  });

  /**
   * `closable="false"` removes the close button and an empty `title` renders
   * no heading text, so the drawer falls back to its localized `aria-label`.
   * The rendered markup differs, so it gets its own sweep — in particular the
   * title element survives as an empty, still-`id`'d `<div>`, which is exactly
   * the shape a dangling `aria-labelledby` would hide in.
   */
  it('has no axe violations without a title or a close button', async () => {
    host.title.set(undefined);
    host.closable.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(titleEl()?.textContent?.trim()).toBe('');
    expect(closeButton()).toBeNull();
    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();

    await expectNoAxeViolations(document.body);
  });

  it('renders the library close button last, labelled from i18n', () => {
    const header = panel()?.querySelector('.mlv-drawer__header');
    const close = header?.querySelector<HTMLElement>('.mlv-drawer__close');
    const action = header?.querySelector('.action');

    expect(close?.tagName.toLowerCase()).toBe('mlv-button-close');
    expect(header?.lastElementChild).toBe(close);
    expect(closeButton()?.getAttribute('aria-label')).toBe('Close drawer');
    // Projected content (the navigator, actions) sits between the title and
    // the close: title → content → close is the row's reading order.
    expect(
      action && close
        ? action.compareDocumentPosition(close) &
            Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
  });

  it('closes the drawer from the close button', () => {
    closeButton()?.click();
    fixture.detectChanges();

    expect(host.open()).toBe(false);
  });

  it('omits the close button when closable is false', async () => {
    host.closable.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()?.querySelector('.mlv-drawer__close')).toBeNull();
  });

  it('puts projected buttons and the close button on the same 36px row', () => {
    // A compact `mlvButton` and a comfortable `mlv-button--close` both resolve
    // `--mlv-btn-height: var(--mlv-height-s)` — the close component sits one
    // density step below the plain button at every level, so pinning it at
    // its default is what keeps the two flush. The header projects `compact`
    // to its content and leaves the close at `comfortable`.
    const action = panel()?.querySelector('.action');
    const close = closeButton();

    expect(action?.classList.contains('mlv-button--compact')).toBe(true);
    expect(close?.classList.contains('mlv-button--comfortable')).toBe(true);
    expect(close?.classList.contains('mlv-button--close')).toBe(true);
  });

  it('drops the label when the title empties and falls back to aria-label', async () => {
    host.title.set(undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();
    expect(panel()?.getAttribute('aria-label')).toBe('Drawer');
  });

  it("lets the drawer's own ariaLabelledBy win over the header title", async () => {
    host.ariaLabelledBy.set('external-label');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBe('external-label');
  });
});

describe('MlvDrawerHeader — attribute form', () => {
  let fixture: ComponentFixture<AttributeHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttributeHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AttributeHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('wraps a projected heading as the title and keeps the rest in the row', () => {
    const header = panel()?.querySelector('.custom-head');
    const title = titleEl();

    expect(header?.classList.contains('mlv-drawer__header')).toBe(true);
    expect(title?.querySelector('h4')?.textContent).toBe('Member access');
    expect(title?.querySelector('.byline')).toBeNull();
    expect(header?.querySelector('.byline')).toBeTruthy();
    expect(panel()?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(closeButton()).toBeTruthy();
  });
});

describe('MlvDrawerHeader — service-opened drawer', () => {
  let service: MlvDrawerService;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18nTesting()],
    });
    service = TestBed.inject(MlvDrawerService);
    appRef = TestBed.inject(ApplicationRef);
    asyncTitle.set('Details');
  });

  it('labels the pane by the title and closes through the drawer ref', async () => {
    const ref = service.open(ServiceContentComponent);
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    await appRef.whenStable();

    const title = titleEl();
    expect(title?.textContent?.trim()).toBe('Details');
    expect(panel()?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(panel()?.getAttribute('aria-label')).toBeNull();

    closeButton()?.click();
    // The ref disposes the overlay on the panel's leave `animationend`.
    panel()?.dispatchEvent(new Event('animationend'));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('strips the native title attribute the element form leaves behind', async () => {
    service.open(ServiceContentComponent);
    await appRef.whenStable();

    const header = panel()?.querySelector('.mlv-drawer__header');

    expect(titleEl()?.textContent?.trim()).toBe('Details');
    expect(header?.hasAttribute('title')).toBe(false);
  });

  it('names a pane without a header from i18n', async () => {
    service.open(BareContentComponent);
    await appRef.whenStable();

    expect(panel()?.getAttribute('aria-label')).toBe('Drawer');
    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();
  });

  it('hands the i18n name back when the title withdraws', async () => {
    service.open(AsyncTitleContentComponent);
    await appRef.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBe(titleEl()?.id);
    expect(panel()?.getAttribute('aria-label')).toBeNull();

    asyncTitle.set(undefined);
    await appRef.whenStable();

    expect(panel()?.getAttribute('aria-labelledby')).toBeNull();
    expect(panel()?.getAttribute('aria-label')).toBe('Drawer');
  });
});

describe('MlvDrawerHeader — service drawer opened from inside a declarative drawer', () => {
  let fixture: ComponentFixture<NestedHostComponent>;

  beforeEach(async () => {
    lastOpenerInjector = null;
    await TestBed.configureTestingModule({
      imports: [NestedHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(NestedHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('labels and closes the drawer it renders in, not the outer one', async () => {
    // A routable drawer passes the route's injector, which sits inside the
    // outer drawer's content when the route renders there — so the inner
    // header can reach the outer `MlvDrawer` as well as its own ref.
    expect(lastOpenerInjector).not.toBeNull();
    const ref = TestBed.inject(MlvDrawerService).open(ServiceContentComponent, {
      injector: lastOpenerInjector ?? undefined,
    });
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    await TestBed.inject(ApplicationRef).whenStable();

    const [outer, inner] = panels();
    const innerTitle = inner.querySelector<HTMLElement>('.mlv-drawer__title');

    expect(innerTitle?.textContent?.trim()).toBe('Details');
    expect(inner.getAttribute('aria-labelledby')).toBe(innerTitle?.id);
    expect(outer.getAttribute('aria-labelledby')).toBeNull();
    expect(outer.getAttribute('aria-label')).toBe('Drawer');

    inner
      .querySelector<HTMLButtonElement>('.mlv-drawer__close button')
      ?.click();
    inner.dispatchEvent(new Event('animationend'));

    expect(closed).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.open()).toBe(true);
  });
});

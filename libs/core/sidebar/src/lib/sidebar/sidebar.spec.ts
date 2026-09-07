import type { ComponentFixture } from '@angular/core/testing';
import {
  Component,
  inject,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';
import { OverlayContainer } from '@angular/cdk/overlay';
import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import type { MlvBreakpoint } from '@malva-ui/cdk/utils';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvSidebar } from './sidebar';
import type { MlvSidebarAppearance } from '../sidebar-appearance';
import type { MlvSidebarMode } from '../sidebar-mode';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvSidebarGroup } from '../sidebar-group/sidebar-group';
import { MlvSidebarItem } from '../sidebar-item/sidebar-item';
import { MlvSidebarHeader } from '../sidebar-header';
import { MlvSidebarFooter } from '../sidebar-footer';
import { SidebarContentDirective } from '../sidebar-content';
import { MlvSidebarItemIcon } from '../sidebar-item-icon';
import { MlvSidebarRail } from '../sidebar-rail/sidebar-rail';
import { MlvSidebarTrigger } from '../sidebar-trigger/sidebar-trigger';
import { MlvSidebarItemTitle } from '../sidebar-item-host';
import { provideRouter, RouterLink } from '@angular/router';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogHeader,
  MlvDialogService,
  type MlvDialogRole,
  type MlvDialogTemplateContext,
} from '@malva-ui/core/dialog';
import { vi } from 'vitest';

/** Waits for a `requestAnimationFrame` callback to run (flyout focus is rAF-deferred). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const SIDEBAR_DIR = dirname(fileURLToPath(import.meta.url));

/** Reads one compiled Sidebar CSS rule, preserving the stylesheet as the public contract. */
function declarationsFor(selector: string): string {
  const ruleStart = `${selector} {`;
  const css = sass.compile(join(SIDEBAR_DIR, 'sidebar.scss'), {
    style: 'expanded',
  }).css;
  const index = css.indexOf(ruleStart);

  return index === -1
    ? ''
    : css.slice(index + ruleStart.length, css.indexOf('}', index));
}

@Component({
  imports: [MlvSidebar],
  template: `<mlv-sidebar [appearance]="appearance()">Views</mlv-sidebar>`,
})
class AppearanceHost {
  readonly appearance = signal<MlvSidebarAppearance>('raised');
}

@Component({
  template: `
    <mlv-sidebar mode="floating">
      <mlv-sidebar-group label="Group">
        <mlv-sidebar-item label="Nested" />
      </mlv-sidebar-group>
    </mlv-sidebar>
  `,
  imports: [MlvSidebar, MlvSidebarGroup, MlvSidebarItem],
})
class GroupContextTestHost {}

describe('MlvSidebar', () => {
  let component: MlvSidebar;
  let fixture: ComponentFixture<MlvSidebar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvSidebar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvSidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default mode to icon', () => {
    expect(component.mode()).toBe('icon');
  });

  it('should default fullHeight to false', () => {
    expect(component.fullHeight()).toBe(false);
  });

  it('should default minWidth to 200', () => {
    expect(component.minWidth()).toBe(200);
  });

  it('should default maxWidth to 480', () => {
    expect(component.maxWidth()).toBe(480);
  });

  it('should have width as a model with default 260px', () => {
    expect(component.width()).toBe('260px');
  });

  it('exposes total expanded and collapsed widths as CSS variables', () => {
    fixture.componentRef.setInput('width', '320px');
    fixture.componentRef.setInput('collapsedWidth', '64px');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--mlv-sidebar-expanded-width')).toBe(
      '320px',
    );
    expect(host.style.getPropertyValue('--mlv-sidebar-collapsed-width')).toBe(
      '64px',
    );
  });

  it('should toggle collapsed state', () => {
    expect(component.collapsed()).toBe(false);
    component.toggle();
    expect(component.collapsed()).toBe(true);
    component.toggle();
    expect(component.collapsed()).toBe(false);
  });

  it('should set width via setWidth', () => {
    component.setWidth(300);
    expect(component.width()).toBe('300px');
  });

  it('should apply mode modifier class', () => {
    fixture.componentRef.setInput('mode', 'floating');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-sidebar--floating'),
    ).toBe(true);
  });

  it('should apply full-height modifier class', () => {
    fixture.componentRef.setInput('fullHeight', true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-sidebar--full-height'),
    ).toBe(true);
  });

  it('should ignore collapsed in fixed mode', () => {
    fixture.componentRef.setInput('mode', 'fixed');
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.classList.contains('mlv-sidebar--collapsed'),
    ).toBe(false);
  });

  it('should have collapsed as a model with default false', () => {
    expect(component.collapsed()).toBe(false);
  });

  it('labels the navigation landmark with the i18n default when no ariaLabel is set', () => {
    expect(component.ariaLabel()).toBeUndefined();
    expect(
      (fixture.nativeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Sidebar navigation');
  });

  it('lets an explicit ariaLabel win over the i18n default', () => {
    fixture.componentRef.setInput('ariaLabel', 'Admin sections');
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Admin sections');
  });

  it('falls back to the i18n default again when ariaLabel is cleared', () => {
    fixture.componentRef.setInput('ariaLabel', 'Admin sections');
    fixture.detectChanges();
    fixture.componentRef.setInput('ariaLabel', undefined);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).getAttribute('aria-label'),
    ).toBe('Sidebar navigation');
  });
});

describe('MlvSidebar appearance', () => {
  let fixture: ComponentFixture<AppearanceHost>;
  let host: AppearanceHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppearanceHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AppearanceHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('keeps the raised appearance as the default', () => {
    const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
    expect(sidebar.classList).toContain('mlv-sidebar--raised');
    expect(sidebar.classList).not.toContain('mlv-sidebar--flat');
  });

  it('applies the flat modifier without changing mode', () => {
    host.appearance.set('flat');
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
    expect(sidebar.classList).toContain('mlv-sidebar--flat');
    expect(sidebar.classList).toContain('mlv-sidebar--icon');
  });

  it('defines the flat surface with real zero-elevation tokens', () => {
    const flat = declarationsFor('.mlv-sidebar--flat');
    expect(flat).toContain('border-radius: 0');
    // SL-R3 (visual language spec): every elevation shadow is expressed as a
    // named alias, never a raw numbered step. `--mlv-shadow-flat` resolves to
    // the same `--mlv-shadow-0` value — this is a rename, not a value change.
    expect(flat).toContain('box-shadow: var(--mlv-shadow-flat)');
    expect(flat).not.toContain('background: transparent');
  });
});

describe('MlvSidebarGroup context proxy', () => {
  it('should proxy mode from parent context to children', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [GroupContextTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(GroupContextTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
    expect(sidebar.classList.contains('mlv-sidebar--floating')).toBe(true);
  });
});

@Component({
  template: `
    <mlv-sidebar>
      <div mlvSidebarHeader>Header</div>
      <div mlvSidebarContent>Content</div>
      <div mlvSidebarFooter>Footer</div>
    </mlv-sidebar>
  `,
  imports: [
    MlvSidebar,
    MlvSidebarHeader,
    MlvSidebarFooter,
    SidebarContentDirective,
  ],
})
class SlotDirectivesTestHost {}

describe('Structural slot directives', () => {
  it('should apply host classes', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [SlotDirectivesTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(SlotDirectivesTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__header'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__content'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__footer'),
    ).toBeTruthy();
  });
});

describe('Sidebar slot layout', () => {
  @Component({
    template: `
      <mlv-sidebar>
        <div mlvSidebarHeader>H</div>
        <div mlvSidebarContent>C</div>
        <div mlvSidebarFooter>F</div>
      </mlv-sidebar>
    `,
    imports: [
      MlvSidebar,
      MlvSidebarHeader,
      SidebarContentDirective,
      MlvSidebarFooter,
    ],
  })
  class SlotLayoutTestHost {}

  it('should render all three slot regions', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [SlotLayoutTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(SlotLayoutTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector(
      '.mlv-sidebar__container',
    );
    expect(container).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__header'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__footer'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar__content'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '.mlv-sidebar__content-scrollbar.mlv-scrollbar',
      ),
    ).toBeTruthy();
  });
});

describe('Sidebar collapse presentation', () => {
  @Component({
    template: `
      <mlv-sidebar [collapsed]="collapsed()">
        <mlv-sidebar-item label="Jane Cooper">
          <ng-template mlvSidebarItemIcon
            ><span class="avatar">JC</span></ng-template
          >
          <ng-template mlvSidebarItemTitle>
            <span class="profile-title">Jane Cooper</span>
          </ng-template>
        </mlv-sidebar-item>
      </mlv-sidebar>
    `,
    imports: [
      MlvSidebar,
      MlvSidebarItem,
      MlvSidebarItemIcon,
      MlvSidebarItemTitle,
    ],
  })
  class CollapsePresentationHost {
    readonly collapsed = signal(false);
  }

  it('keeps the label mounted for its CSS fade but makes it inert when collapsed', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [CollapsePresentationHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(CollapsePresentationHost);
    await fixture.whenStable();

    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    const label = item.querySelector('.mlv-sidebar-item__label');
    expect(label?.textContent).toContain('Jane Cooper');
    expect(label?.getAttribute('aria-hidden')).toBe('true');
    expect(label?.hasAttribute('inert')).toBe(true);
    expect(item.classList).toContain('mlv-sidebar-item--collapsed');
  });

  it('uses a fixed icon column in both expanded and collapsed states', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [CollapsePresentationHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(CollapsePresentationHost);
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    expect(item.querySelector('.mlv-sidebar-item__icon .avatar')).toBeTruthy();

    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    expect(item.querySelector('.mlv-sidebar-item__icon .avatar')).toBeTruthy();
  });

  it('keeps group heading text mounted while switching to its icon trigger', async () => {
    @Component({
      template: `
        <mlv-sidebar [collapsed]="collapsed()">
          <mlv-sidebar-group label="Projects">
            <ng-template mlvSidebarItemIcon><span>PR</span></ng-template>
            <mlv-sidebar-item label="Overview" />
          </mlv-sidebar-group>
        </mlv-sidebar>
      `,
      imports: [
        MlvSidebar,
        MlvSidebarGroup,
        MlvSidebarItem,
        MlvSidebarItemIcon,
      ],
    })
    class GroupCollapseHost {
      readonly collapsed = signal(false);
    }

    const fixture = TestBed.configureTestingModule({
      imports: [GroupCollapseHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(GroupCollapseHost);
    await fixture.whenStable();

    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();

    const group = fixture.nativeElement.querySelector('.mlv-sidebar-group');
    expect(group.querySelector('.mlv-sidebar-group__label')?.textContent).toBe(
      'Projects',
    );
    expect(group.getAttribute('aria-hidden')).toBe('true');
    expect(group.hasAttribute('inert')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.mlv-sidebar-group__icon-btn'),
    ).toBeTruthy();
  });
});

@Component({
  template: `
    <mlv-sidebar [(width)]="sidebarWidth" [collapsed]="collapsed()">
      <div mlvSidebarContent>Items</div>
      <mlv-sidebar-rail />
    </mlv-sidebar>
  `,
  imports: [MlvSidebar, SidebarContentDirective, MlvSidebarRail],
})
class RailTestHost {
  readonly collapsed = signal(false);
  sidebarWidth = '260px';
}

describe('MlvSidebarRail', () => {
  it('should render rail element', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [RailTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(RailTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const rail = fixture.nativeElement.querySelector('.mlv-sidebar-rail');
    expect(rail).toBeTruthy();
  });

  it('should have correct ARIA attributes', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [RailTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(RailTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const rail = fixture.nativeElement.querySelector('.mlv-sidebar-rail');
    expect(rail.getAttribute('role')).toBe('separator');
    expect(rail.getAttribute('aria-orientation')).toBe('vertical');
    expect(rail.getAttribute('tabindex')).toBe('0');
    expect(rail.getAttribute('aria-label')).toBe('Resize sidebar');
  });

  it('should toggle collapsed on double-click', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [RailTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(RailTestHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('.mlv-sidebar');
    expect(sidebar.classList.contains('mlv-sidebar--collapsed')).toBe(false);

    const rail = fixture.nativeElement.querySelector('.mlv-sidebar-rail');
    rail.dispatchEvent(new MouseEvent('dblclick'));
    fixture.detectChanges();

    expect(sidebar.classList.contains('mlv-sidebar--collapsed')).toBe(true);
  });
});

describe('MlvSidebarTrigger', () => {
  @Component({
    template: `
      <mlv-sidebar [mode]="mode()">
        <mlv-sidebar-item
          mlvSidebarTrigger
          #collapseTrigger="mlvSidebarTrigger"
          [label]="collapseTrigger.label()"
        />
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarItem, MlvSidebarTrigger],
  })
  class TriggerTestHost {
    readonly mode = signal<MlvSidebarMode>('icon');
  }

  async function renderTrigger(
    mode: MlvSidebarMode = 'icon',
  ): Promise<ComponentFixture<TriggerTestHost>> {
    const fixture = TestBed.configureTestingModule({
      imports: [TriggerTestHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(TriggerTestHost);
    fixture.componentInstance.mode.set(mode);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function triggerRow(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement.querySelector(
      'mlv-sidebar-item',
    ) as HTMLElement;
  }

  it('turns its host row into a named, expanded-state toggle', async () => {
    const fixture = await renderTrigger();
    const row = triggerRow(fixture);

    // The directive renders no chrome of its own — the row is an ordinary
    // `mlv-sidebar-item`, which is exactly the point of the refactor.
    expect(
      fixture.nativeElement.querySelector('mlv-sidebar-trigger'),
    ).toBeNull();
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.getAttribute('aria-label')).toBe('Collapse sidebar');
    expect(row.textContent?.trim()).toBe('Collapse sidebar');
  });

  it('toggles the sidebar on click and re-labels itself', async () => {
    const fixture = await renderTrigger();
    const sidebar = fixture.debugElement.children[0]
      .componentInstance as MlvSidebar;
    const row = triggerRow(fixture);
    expect(sidebar.collapsed()).toBe(false);

    row.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sidebar.collapsed()).toBe(true);
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.getAttribute('aria-label')).toBe('Expand sidebar');

    row.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sidebar.collapsed()).toBe(false);
  });

  it('toggles from the keyboard, which the row turns into a click', async () => {
    const fixture = await renderTrigger();
    const sidebar = fixture.debugElement.children[0]
      .componentInstance as MlvSidebar;

    triggerRow(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sidebar.collapsed()).toBe(true);
  });

  it('names itself for the drawer while the sidebar is offcanvas', async () => {
    await renderTrigger('offcanvas');

    // The drawer projects its content only while open, so the row is in the
    // overlay rather than in the fixture host.
    const row = document.querySelector('mlv-sidebar-item') as HTMLElement;
    expect(row.getAttribute('aria-label')).toBe('Close navigation menu');
  });

  it('hides its host in fixed mode, where the sidebar cannot collapse', async () => {
    const fixture = await renderTrigger('fixed');

    expect(triggerRow(fixture).style.display).toBe('none');

    fixture.componentInstance.mode.set('icon');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggerRow(fixture).style.display).toBe('');
  });

  it('drives a sidebar it is not nested in through the sidebar input', async () => {
    @Component({
      template: `
        <mlv-sidebar #nav mode="icon" />
        <button
          mlvSidebarTrigger
          #navTrigger="mlvSidebarTrigger"
          type="button"
          [sidebar]="nav"
          [attr.aria-label]="navTrigger.label()"
        ></button>
      `,
      imports: [MlvSidebar, MlvSidebarTrigger],
    })
    class ExternalTriggerHost {
      readonly nav = viewChild.required(MlvSidebar);
    }

    const fixture = TestBed.configureTestingModule({
      imports: [ExternalTriggerHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(ExternalTriggerHost);
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Collapse sidebar');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.nav().collapsed()).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Expand sidebar');
  });

  it('has no axe violations in either state', async () => {
    const fixture = await renderTrigger();
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    triggerRow(fixture).click();
    await fixture.whenStable();
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

describe('MlvSidebarItem accessibility roles', () => {
  @Component({
    template: `
      <mlv-sidebar>
        <mlv-sidebar-item label="Dashboard" />
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarItem],
  })
  class ButtonRowHost {}

  @Component({
    template: `
      <mlv-sidebar>
        <mlv-sidebar-item label="Home">
          <ng-template mlvSidebarItemTitle>
            <a routerLink="/home">Home</a>
          </ng-template>
        </mlv-sidebar-item>
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarItem, MlvSidebarItemTitle, RouterLink],
  })
  class LinkRowHost {}

  it('renders a button-style row (role=button, tabindex 0) when no title link is projected', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ButtonRowHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(ButtonRowHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector(
      'mlv-sidebar-item',
    ) as HTMLElement;
    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.getAttribute('aria-label')).toBe('Dashboard');
  });

  it('defers to the projected link (no invalid listitem role, host not focusable) when a title link is present', async () => {
    const fixture = TestBed.configureTestingModule({
      imports: [LinkRowHost],
      providers: [provideRouter([]), provideMlvI18nTesting()],
    }).createComponent(LinkRowHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector(
      'mlv-sidebar-item',
    ) as HTMLElement;
    // No invalid role="listitem" (which requires a role="list" ancestor).
    expect(item.getAttribute('role')).toBeNull();
    // Host is not a second focusable control nesting the anchor.
    expect(item.getAttribute('tabindex')).toBeNull();
    expect(item.getAttribute('aria-label')).toBeNull();
    // The projected anchor is the interactive element.
    expect(item.querySelector('a')).toBeTruthy();
  });

  it('keeps a text/badge-only title row interactive (role=button, named, clickable)', async () => {
    @Component({
      template: `
        <mlv-sidebar>
          <mlv-sidebar-item label="Inbox" (click)="clicks = clicks + 1">
            <ng-template mlvSidebarItemTitle>
              <span class="row">
                <span>Inbox</span>
                <span class="badge">128</span>
              </span>
            </ng-template>
          </mlv-sidebar-item>
        </mlv-sidebar>
      `,
      imports: [MlvSidebar, MlvSidebarItem, MlvSidebarItemTitle],
    })
    class BadgeTitleHost {
      clicks = 0;
    }

    const fixture = TestBed.configureTestingModule({
      imports: [BadgeTitleHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(BadgeTitleHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector(
      'mlv-sidebar-item',
    ) as HTMLElement;
    // No focusable control was projected (text + badge only) → host stays interactive.
    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('tabindex')).toBe('0');
    expect(item.getAttribute('aria-label')).toBe('Inbox');
    // Keyboard activation (Enter) clicks the host.
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('sets aria-current="page" only when active', async () => {
    @Component({
      template: `
        <mlv-sidebar>
          <mlv-sidebar-item label="Home" [active]="active()" />
          <mlv-sidebar-item label="Away" />
        </mlv-sidebar>
      `,
      imports: [MlvSidebar, MlvSidebarItem],
    })
    class AriaCurrentHost {
      readonly active = signal(true);
    }

    const fixture = TestBed.configureTestingModule({
      imports: [AriaCurrentHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(AriaCurrentHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const items = fixture.nativeElement.querySelectorAll('mlv-sidebar-item');
    expect(items[0].getAttribute('aria-current')).toBe('page');
    expect(items[1].getAttribute('aria-current')).toBeNull();

    fixture.componentInstance.active.set(false);
    fixture.detectChanges();
    expect(items[0].getAttribute('aria-current')).toBeNull();
  });
});

describe('MlvSidebar offcanvas mode', () => {
  @Component({
    template: `
      <mlv-sidebar mode="offcanvas" [collapsed]="collapsed()">
        <div mlvSidebarContent>
          <mlv-sidebar-item label="Dashboard" />
        </div>
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, SidebarContentDirective, MlvSidebarItem],
  })
  class OffcanvasHost {
    readonly collapsed = signal(false);
  }

  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OffcanvasHost],
      providers: [provideMlvI18nTesting()],
    });
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('projects the sidebar content into the open drawer (not an empty drawer)', async () => {
    const fixture = TestBed.createComponent(OffcanvasHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The drawer dialog surface exists and actually contains the projected
    // container + item (regression: previously the drawer rendered empty).
    const dialog = overlayContainerEl.querySelector(
      '.mlv-drawer[role="dialog"]',
    );
    expect(dialog).toBeTruthy();
    const container = dialog?.querySelector('.mlv-sidebar__container');
    expect(container).toBeTruthy();
    const item = container?.querySelector('mlv-sidebar-item');
    expect(item).toBeTruthy();
    expect(item?.getAttribute('aria-label')).toBe('Dashboard');
  });

  it('does not render an overlay drawer while collapsed', async () => {
    const fixture = TestBed.createComponent(OffcanvasHost);
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      overlayContainerEl.querySelector('.mlv-sidebar__container'),
    ).toBeNull();
  });
});

describe('MlvSidebarGroup collapsed flyout (menu)', () => {
  @Component({
    template: `
      <mlv-sidebar [collapsed]="true">
        <div mlvSidebarContent>
          <mlv-sidebar-group label="Projects">
            <ng-template mlvSidebarItemIcon><span>ic</span></ng-template>
            <mlv-sidebar-item label="Design System" />
            <mlv-sidebar-item label="Marketing Site" />
          </mlv-sidebar-group>
        </div>
      </mlv-sidebar>
    `,
    imports: [
      MlvSidebar,
      SidebarContentDirective,
      MlvSidebarGroup,
      MlvSidebarItem,
      MlvSidebarItemIcon,
    ],
  })
  class CollapsedGroupHost {}

  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CollapsedGroupHost],
      providers: [provideMlvI18nTesting()],
    });
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
    // `setDirection` is global state (it writes `dir` onto <html>) — reset both
    // the service and the attribute so a direction never leaks into the next test.
    TestBed.inject(MlvRtlService).setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** Dispatches a bubbling keydown, the way a real key press arrives. */
  function keydown(target: HTMLElement, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  function triggerEl(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
  }

  function group(fixture: ComponentFixture<unknown>): MlvSidebarGroup {
    return fixture.debugElement.query(
      (de) => de.componentInstance instanceof MlvSidebarGroup,
    ).componentInstance as MlvSidebarGroup;
  }

  async function openFlyout(
    fixture: ComponentFixture<unknown>,
  ): Promise<HTMLElement> {
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await nextFrame();
    return overlayContainerEl.querySelector(
      '.mlv-sidebar-group__flyout',
    ) as HTMLElement;
  }

  it('advertises a menu on the collapsed trigger', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('renders the flyout as role=menu with role=menuitem items and moves focus to the first item', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('role')).toBe('menu');

    const menuItems = panel.querySelectorAll(
      'mlv-sidebar-item[role="menuitem"]',
    );
    expect(menuItems.length).toBe(2);
    // Focus was moved into the flyout (menu-button pattern), not left on the trigger.
    expect(document.activeElement).toBe(menuItems[0]);
    expect(group(fixture).flyoutOpen()).toBe(true);
  });

  it('closes the flyout and restores focus to the trigger on Escape', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    expect(group(fixture).flyoutOpen()).toBe(true);

    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(group(fixture).flyoutOpen()).toBe(false);
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the flyout when focus leaves it entirely', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    expect(group(fixture).flyoutOpen()).toBe(true);

    // Focus moves to an element outside both the panel and the trigger.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    panel.dispatchEvent(
      new FocusEvent('focusout', { relatedTarget: outside, bubbles: true }),
    );
    fixture.detectChanges();

    expect(group(fixture).flyoutOpen()).toBe(false);
    outside.remove();
  });

  it('closes the flyout and restores focus to the trigger when a child item is clicked', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    const item = panel.querySelector(
      'mlv-sidebar-item[role="menuitem"]',
    ) as HTMLElement;

    item.click();
    fixture.detectChanges();

    expect(group(fixture).flyoutOpen()).toBe(false);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.mlv-sidebar-group__icon-btn'),
    );
  });

  it('closes the flyout on Enter, which the item turns into a click', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    const item = panel.querySelector(
      'mlv-sidebar-item[role="menuitem"]',
    ) as HTMLElement;

    item.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();

    expect(group(fixture).flyoutOpen()).toBe(false);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.mlv-sidebar-group__icon-btn'),
    );
  });

  it('keeps the flyout open when its header (not an item) is clicked', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = await openFlyout(fixture);
    (
      panel.querySelector('.mlv-sidebar-group__flyout-header') as HTMLElement
    ).click();
    fixture.detectChanges();

    expect(group(fixture).flyoutOpen()).toBe(true);
  });

  it('mirrors the open/close arrows inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'rtl');

    expect(TestBed.inject(MlvRtlService).direction()).toBe('ltr');

    // The flyout hangs off the inline-end edge, so ArrowLeft opens it in RTL.
    keydown(triggerEl(fixture), 'ArrowLeft');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await nextFrame();
    expect(group(fixture).flyoutOpen()).toBe(true);

    const panel = overlayContainerEl.querySelector(
      '.mlv-sidebar-group__flyout',
    ) as HTMLElement;

    // Vertical arrows never mirror — ArrowDown still walks the menu.
    keydown(panel, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement?.textContent).toContain('Marketing Site');

    // …and ArrowRight is "back out" once mirrored.
    keydown(panel, 'ArrowRight');
    fixture.detectChanges();
    expect(group(fixture).flyoutOpen()).toBe(false);

    scope.removeAttribute('dir');
  });

  it('leaves a scoped [dir="ltr"] island unmirrored while the document is RTL', async () => {
    TestBed.inject(MlvRtlService).setDirection('rtl');
    const fixture = TestBed.createComponent(CollapsedGroupHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const scope = fixture.nativeElement as HTMLElement;
    scope.setAttribute('dir', 'ltr');

    keydown(triggerEl(fixture), 'ArrowLeft');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(group(fixture).flyoutOpen()).toBe(false);

    keydown(triggerEl(fixture), 'ArrowRight');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(group(fixture).flyoutOpen()).toBe(true);

    scope.removeAttribute('dir');
  });
});

describe('MlvSidebarGroup accordion in the collapsed rail', () => {
  @Component({
    template: `
      <mlv-sidebar [collapsed]="collapsed()">
        <mlv-sidebar-group label="Projects">
          <ng-template mlvSidebarItemIcon><span>ic</span></ng-template>
          <mlv-sidebar-item label="Design System" />
        </mlv-sidebar-group>
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarGroup, MlvSidebarItem, MlvSidebarItemIcon],
  })
  class CollapsedAccordionHost {
    readonly collapsed = signal(true);
  }

  async function render(): Promise<ComponentFixture<CollapsedAccordionHost>> {
    const fixture = TestBed.configureTestingModule({
      imports: [CollapsedAccordionHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(CollapsedAccordionHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function group(fixture: ComponentFixture<unknown>): MlvSidebarGroup {
    return fixture.debugElement.query(
      (de) => de.componentInstance instanceof MlvSidebarGroup,
    ).componentInstance as MlvSidebarGroup;
  }

  function panel(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__content',
    ) as HTMLElement;
  }

  it('does not open the accordion when `expanded` is written from outside while collapsed', async () => {
    const fixture = await render();

    group(fixture).expanded.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // An empty accordion inside the icon rail would show a ghost tree line and
    // steal the projected children from the open flyout.
    expect(panel(fixture).classList.contains('mlv-expand--open')).toBe(false);
    expect(panel(fixture).querySelector('.mlv-expand__body')).toBeNull();
  });

  it('honours the pending expanded state once the sidebar expands again', async () => {
    const fixture = await render();

    group(fixture).expanded.set(true);
    fixture.detectChanges();
    fixture.componentInstance.collapsed.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(panel(fixture).classList.contains('mlv-expand--open')).toBe(true);
    expect(panel(fixture).querySelector('.mlv-expand__body')).toBeTruthy();
  });
});

describe('MlvSidebarItem badge / status indicator', () => {
  @Component({
    template: `
      <mlv-sidebar [collapsed]="collapsed()">
        <mlv-sidebar-item
          label="Inbox"
          [badge]="badge()"
          [badgeTone]="tone()"
        />
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarItem],
  })
  class ItemBadgeHost {
    readonly collapsed = signal(false);
    readonly badge = signal<string | number | null>(128);
    readonly tone = signal<'info' | 'success'>('info');
  }

  function build(): ComponentFixture<ItemBadgeHost> {
    const fixture = TestBed.configureTestingModule({
      imports: [ItemBadgeHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(ItemBadgeHost);
    return fixture;
  }

  it('renders a mlv-badge (not a status dot) when expanded', async () => {
    const fixture = build();
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    expect(item.querySelector('mlv-badge')?.textContent?.trim()).toBe('128');
    expect(item.querySelector('mlv-status-indicator')).toBeNull();
  });

  it('folds a numeric badge into the host aria-label as a pluralised count', async () => {
    const fixture = build();
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    expect(item.getAttribute('aria-label')).toBe('Inbox, 128 notifications');
  });

  it('announces a non-numeric badge verbatim in the aria-label', async () => {
    const fixture = build();
    fixture.componentInstance.badge.set('New');
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    expect(item.getAttribute('aria-label')).toBe('Inbox, New');
  });

  it('renders a decorative status dot with the badge tone when collapsed', async () => {
    const fixture = build();
    fixture.componentInstance.collapsed.set(true);
    fixture.componentInstance.tone.set('success');
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    const dot = item.querySelector('mlv-status-indicator');
    expect(dot).toBeTruthy();
    // Tone modifier reflected, and decorative (no accessible name of its own —
    // the count lives on the host aria-label instead).
    expect(dot.classList).toContain('mlv-status-indicator--tone-success');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(item.getAttribute('aria-label')).toBe('Inbox, 128 notifications');
  });

  it('renders nothing extra when no badge is set', async () => {
    const fixture = build();
    fixture.componentInstance.badge.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    expect(item.querySelector('mlv-badge')).toBeNull();
    expect(item.querySelector('mlv-status-indicator')).toBeNull();
    expect(item.getAttribute('aria-label')).toBe('Inbox');
  });

  it('keeps a projected title working while composing the badge input', async () => {
    @Component({
      template: `
        <mlv-sidebar>
          <mlv-sidebar-item label="Inbox" badge="9" badgeTone="warning">
            <ng-template mlvSidebarItemTitle>
              <span class="custom-title">Custom Inbox</span>
            </ng-template>
          </mlv-sidebar-item>
        </mlv-sidebar>
      `,
      imports: [MlvSidebar, MlvSidebarItem, MlvSidebarItemTitle],
    })
    class ProjectedTitleBadgeHost {}

    const fixture = TestBed.configureTestingModule({
      imports: [ProjectedTitleBadgeHost],
      providers: [provideMlvI18nTesting()],
    }).createComponent(ProjectedTitleBadgeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const item = fixture.nativeElement.querySelector('mlv-sidebar-item');
    // Projected custom title still renders …
    expect(item.querySelector('.custom-title')?.textContent).toBe(
      'Custom Inbox',
    );
    // … and the badge input renders alongside it.
    expect(item.querySelector('mlv-badge')?.textContent?.trim()).toBe('9');
    // Text/badge-only title keeps the host interactive with the composed name.
    expect(item.getAttribute('role')).toBe('button');
    expect(item.getAttribute('aria-label')).toBe('Inbox, 9 notifications');
  });
});

describe('MlvSidebarGroup badge / status indicator', () => {
  @Component({
    template: `
      <mlv-sidebar [collapsed]="collapsed()">
        <mlv-sidebar-group label="Projects" badge="3" badgeTone="warning">
          <ng-template mlvSidebarItemIcon><span>ic</span></ng-template>
          <mlv-sidebar-item label="Design System" />
        </mlv-sidebar-group>
      </mlv-sidebar>
    `,
    imports: [MlvSidebar, MlvSidebarGroup, MlvSidebarItem, MlvSidebarItemIcon],
  })
  class GroupBadgeHost {
    readonly collapsed = signal(false);
  }

  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [GroupBadgeHost],
      providers: [provideMlvI18nTesting()],
    });
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('renders the badge in the expanded accordion header', async () => {
    const fixture = TestBed.createComponent(GroupBadgeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const header = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__header',
    );
    expect(header.querySelector('mlv-badge')?.textContent?.trim()).toBe('3');
  });

  it('shows a status dot and folds the count into the collapsed trigger aria-label', async () => {
    const fixture = TestBed.createComponent(GroupBadgeHost);
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
    expect(trigger.querySelector('mlv-status-indicator')).toBeTruthy();
    expect(trigger.getAttribute('aria-label')).toBe(
      'Projects, 3 notifications',
    );
  });

  it('shows the badge next to the flyout title when collapsed', async () => {
    const fixture = TestBed.createComponent(GroupBadgeHost);
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-group__icon-btn',
    ) as HTMLElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const header = overlayContainerEl.querySelector(
      '.mlv-sidebar-group__flyout-header',
    );
    expect(header?.querySelector('mlv-badge')?.textContent?.trim()).toBe('3');
  });
});

describe('MlvSidebar responsive collapseBelow', () => {
  const MD_QUERY = '(min-width: 768px)';
  const LG_QUERY = '(min-width: 1200px)';

  /** Emulates the media-query layer the CDK `BreakpointObserver` sits on. */
  let matches: BehaviorSubject<BreakpointState>;

  function setViewport(tier: 'sm' | 'md' | 'lg'): void {
    matches.next({
      matches: tier !== 'sm',
      breakpoints: {
        [MD_QUERY]: tier !== 'sm',
        [LG_QUERY]: tier === 'lg',
      },
    });
  }

  @Component({
    template: `
      <mlv-sidebar
        #nav
        [mode]="mode()"
        [collapseBelow]="collapseBelow()"
        [closeOnActivation]="closeOnActivation()"
        [(collapsed)]="collapsed"
      >
        <div mlvSidebarContent>
          <mlv-sidebar-item label="Dashboard" />
          <mlv-sidebar-item
            label="Open modal"
            (click)="openActivationDialog()"
          />
        </div>
      </mlv-sidebar>
      <button
        mlvSidebarTrigger
        #externalTrigger="mlvSidebarTrigger"
        type="button"
        [sidebar]="nav"
        [attr.aria-label]="externalTrigger.label()"
      ></button>

      <ng-template #activationDialog>
        <mlv-dialog>
          <mlv-dialog-header title="Activation dialog" />
          <mlv-dialog-body>
            <button class="activation-dialog-close" mlvDialogClose>
              Close modal
            </button>
          </mlv-dialog-body>
        </mlv-dialog>
      </ng-template>
    `,
    imports: [
      MlvSidebar,
      SidebarContentDirective,
      MlvSidebarItem,
      MlvSidebarTrigger,
      MlvDialog,
      MlvDialogHeader,
      MlvDialogBody,
      MlvDialogClose,
    ],
  })
  class ResponsiveHost {
    private readonly dialogs = inject(MlvDialogService);
    private readonly activationDialog =
      viewChild.required<TemplateRef<MlvDialogTemplateContext>>(
        'activationDialog',
      );
    readonly externalTrigger =
      viewChild.required<MlvSidebarTrigger>('externalTrigger');
    readonly mode = signal<MlvSidebarMode>('icon');
    readonly collapseBelow = signal<MlvBreakpoint | null>('md');
    readonly closeOnActivation = signal(false);
    readonly collapsed = signal(false);
    readonly dynamicRestoreFocus = signal(false);
    readonly modalRole = signal<MlvDialogRole>('dialog');
    readonly sidebar = viewChild.required(MlvSidebar);

    openActivationDialog(): void {
      const restoreTarget = this.externalTrigger().focusTarget();
      if (!restoreTarget) throw new Error('Expected external Sidebar trigger');

      this.dialogs.open(this.activationDialog(), {
        ariaLabel: 'Activation dialog',
        role: this.modalRole(),
        restoreFocus: this.dynamicRestoreFocus()
          ? this.externalTrigger().restoreFocusResolver
          : restoreTarget,
      });
    }
  }

  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(() => {
    matches = new BehaviorSubject<BreakpointState>({
      matches: true,
      breakpoints: { [MD_QUERY]: true, [LG_QUERY]: true },
    });

    TestBed.configureTestingModule({
      imports: [ResponsiveHost],
      providers: [
        provideMlvI18nTesting(),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => matches.asObservable() },
        },
      ],
    });
    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  async function render(): Promise<ComponentFixture<ResponsiveHost>> {
    const fixture = TestBed.createComponent(ResponsiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function triggerButton(
    fixture: ComponentFixture<ResponsiveHost>,
  ): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'button[mlvSidebarTrigger]',
    ) as HTMLButtonElement;
  }

  async function finishDrawerClose(
    fixture: ComponentFixture<ResponsiveHost>,
  ): Promise<void> {
    overlayContainerEl
      .querySelector<HTMLElement>('.mlv-drawer--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function finishDialogClose(
    fixture: ComponentFixture<ResponsiveHost>,
  ): Promise<void> {
    overlayContainerEl
      .querySelector<HTMLElement>('.mlv-dialog--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('defaults collapseBelow to null and keeps effectiveMode on the authored mode', async () => {
    const fixture = await render();
    fixture.componentInstance.collapseBelow.set(null);
    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();

    const sidebar = fixture.componentInstance.sidebar();
    expect(sidebar.collapseBelow()).toBeNull();
    expect(sidebar.effectiveMode()).toBe('icon');
    expect(sidebar.collapsed()).toBe(false);
  });

  it('switches to offcanvas and closes itself below the breakpoint', async () => {
    const fixture = await render();
    const sidebar = fixture.componentInstance.sidebar();
    expect(sidebar.effectiveMode()).toBe('icon');

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sidebar.effectiveMode()).toBe('offcanvas');
    expect(sidebar.collapsed()).toBe(true);
    expect(
      fixture.nativeElement
        .querySelector('.mlv-sidebar')
        .classList.contains('mlv-sidebar--offcanvas'),
    ).toBe(true);
    // A closed drawer renders nothing into the overlay.
    expect(
      overlayContainerEl.querySelector('.mlv-sidebar__container'),
    ).toBeNull();
  });

  it('opens the drawer from a trigger rendered outside the sidebar', async () => {
    const fixture = await render();
    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    triggerButton(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.sidebar().collapsed()).toBe(false);
    const dialog = overlayContainerEl.querySelector(
      '.mlv-drawer[role="dialog"]',
    );
    expect(
      dialog?.querySelector('mlv-sidebar-item')?.getAttribute('aria-label'),
    ).toBe('Dashboard');
  });

  it('keeps responsive activation open by default', async () => {
    const fixture = await render();
    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    triggerButton(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    overlayContainerEl.querySelector<HTMLElement>('mlv-sidebar-item')?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sidebar().collapsed()).toBe(false);
    expect(
      overlayContainerEl.querySelector('.mlv-drawer[role="dialog"]'),
    ).not.toBeNull();
  });

  it('closes responsive navigation on activation only when opted in and restores trigger focus', async () => {
    const fixture = await render();
    fixture.componentInstance.closeOnActivation.set(true);
    fixture.detectChanges();

    const desktopItem = fixture.nativeElement.querySelector(
      'mlv-sidebar-item',
    ) as HTMLElement;
    desktopItem.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebar().collapsed()).toBe(false);

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const trigger = triggerButton(fixture);
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compactItem =
      overlayContainerEl.querySelector<HTMLElement>('mlv-sidebar-item');
    compactItem?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sidebar().collapsed()).toBe(true);
    expect(
      overlayContainerEl.querySelector('.mlv-drawer--leave'),
    ).not.toBeNull();
    await finishDrawerClose(fixture);
    expect(
      overlayContainerEl.querySelector('.mlv-drawer[role="dialog"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);

    setViewport('lg');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.sidebar().collapsed()).toBe(false);

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.sidebar().collapsed()).toBe(true);
  });

  it('exposes a connected fallback only while the trigger controls an offcanvas Sidebar', async () => {
    const fixture = await render();
    const trigger = fixture.componentInstance.externalTrigger();
    const target = trigger.focusTarget();
    const conditionalTarget = () => trigger.offcanvasFocusTarget();

    expect(target).toBe(triggerButton(fixture));
    expect(conditionalTarget()).toBeNull();

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(conditionalTarget()).toBe(target);

    setViewport('lg');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(conditionalTarget()).toBeNull();

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(conditionalTarget()).toBe(target);

    fixture.destroy();
    fixture.nativeElement.remove();
    expect(target?.isConnected).toBe(false);
    expect(conditionalTarget()).toBeNull();
  });

  it('resolves composed Dialog restoration at disposal across both responsive directions and cleans up', async () => {
    const fixture = await render();
    fixture.componentInstance.closeOnActivation.set(true);
    fixture.componentInstance.dynamicRestoreFocus.set(true);
    fixture.detectChanges();

    const trigger = triggerButton(fixture);
    const triggerFocus = vi.spyOn(trigger, 'focus');
    const desktopOpener = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('mlv-sidebar-item'),
    ).find((item) => item.getAttribute('aria-label') === 'Open modal');
    if (!desktopOpener) throw new Error('Expected desktop modal opener');
    desktopOpener.focus();
    const desktopOpenerFocus = vi.spyOn(desktopOpener, 'focus');
    desktopOpener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      overlayContainerEl.querySelector('.mlv-dialog-container[role="dialog"]'),
    ).not.toBeNull();

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(desktopOpener.isConnected).toBe(false);
    overlayContainerEl
      .querySelector<HTMLButtonElement>('.activation-dialog-close')
      ?.click();
    fixture.detectChanges();
    await finishDialogClose(fixture);

    expect(desktopOpenerFocus).not.toHaveBeenCalled();
    expect(triggerFocus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    expect(
      overlayContainerEl.querySelector('.mlv-dialog-container'),
    ).toBeNull();

    triggerFocus.mockClear();
    setViewport('lg');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compactOpener = Array.from(
      overlayContainerEl.querySelectorAll<HTMLElement>('mlv-sidebar-item'),
    ).find((item) => item.getAttribute('aria-label') === 'Open modal');
    if (!compactOpener) throw new Error('Expected compact modal opener');
    expect(compactOpener).toBe(desktopOpener);
    compactOpener.focus();
    desktopOpenerFocus.mockClear();
    const compactOpenerFocus = desktopOpenerFocus;
    fixture.componentInstance.modalRole.set('alertdialog');
    compactOpener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await finishDrawerClose(fixture);
    expect(compactOpener.isConnected).toBe(false);
    expect(
      overlayContainerEl.querySelector(
        '.mlv-dialog-container[role="alertdialog"]',
      ),
    ).not.toBeNull();
    expect(
      document.activeElement?.closest('.mlv-dialog-container'),
    ).not.toBeNull();
    triggerFocus.mockClear();

    setViewport('lg');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(compactOpener.isConnected).toBe(true);
    expect(fixture.componentInstance.sidebar().effectiveMode()).toBe('icon');
    expect(triggerFocus).not.toHaveBeenCalled();
    overlayContainerEl
      .querySelector<HTMLButtonElement>('.activation-dialog-close')
      ?.click();
    fixture.detectChanges();
    await finishDialogClose(fixture);

    expect(compactOpenerFocus).toHaveBeenCalledTimes(1);
    expect(triggerFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(compactOpener);
    expect(
      overlayContainerEl.querySelector('.mlv-dialog-container'),
    ).toBeNull();

    const dialogs = TestBed.inject(MlvDialogService);
    expect(dialogs.openDialogs).toEqual([]);
    fixture.destroy();
    fixture.nativeElement.remove();
    expect(trigger.isConnected).toBe(false);
    expect(compactOpener.isConnected).toBe(false);
    expect(overlayContainerEl.children).toHaveLength(0);
  });

  it.each<MlvDialogRole>(['dialog', 'alertdialog'])(
    'does not steal focus from an activation-opened %s and restores the connected fallback after it closes',
    async (role) => {
      const fixture = await render();
      fixture.componentInstance.closeOnActivation.set(true);
      fixture.componentInstance.modalRole.set(role);
      setViewport('sm');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const trigger = triggerButton(fixture);
      trigger.focus();
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const opener = Array.from(
        overlayContainerEl.querySelectorAll<HTMLElement>('mlv-sidebar-item'),
      ).find((item) => item.getAttribute('aria-label') === 'Open modal');
      if (!opener) throw new Error('Expected compact modal opener');
      opener.focus();
      const openerFocus = vi.spyOn(opener, 'focus');
      opener.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const modal = overlayContainerEl.querySelector<HTMLElement>(
        `.mlv-dialog-container[role="${role}"]`,
      );
      if (!modal) throw new Error(`Expected activation-opened ${role}`);
      expect(document.activeElement?.closest('.mlv-dialog-container')).toBe(
        modal,
      );
      const modalFocusTarget = document.activeElement as HTMLElement;
      const modalTargetFocus = vi.spyOn(modal, 'focus');
      const initialTargetFocus = vi.spyOn(modalFocusTarget, 'focus');
      await finishDrawerClose(fixture);

      expect(opener.isConnected).toBe(false);
      expect(openerFocus).not.toHaveBeenCalled();
      expect(
        modalTargetFocus.mock.calls.length +
          initialTargetFocus.mock.calls.length,
      ).toBe(1);
      expect(document.activeElement?.closest('.mlv-dialog-container')).toBe(
        modal,
      );

      overlayContainerEl
        .querySelector<HTMLButtonElement>('.activation-dialog-close')
        ?.click();
      fixture.detectChanges();
      expect(
        overlayContainerEl.querySelectorAll('.mlv-dialog-container'),
      ).toHaveLength(1);
      await finishDialogClose(fixture);

      expect(openerFocus).not.toHaveBeenCalled();
      expect(trigger.isConnected).toBe(true);
      expect(document.activeElement).toBe(trigger);
      expect(
        overlayContainerEl.querySelector('.mlv-dialog-container'),
      ).toBeNull();

      // A later plain activation follows the default Drawer restoration path,
      // proving the activation/modal coordination left no stale state behind.
      trigger.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      overlayContainerEl
        .querySelector<HTMLElement>('mlv-sidebar-item[aria-label="Dashboard"]')
        ?.click();
      fixture.detectChanges();
      await finishDrawerClose(fixture);
      expect(document.activeElement).toBe(trigger);
    },
  );

  it('renders the trigger as a labelled menu button while the drawer is in play', async () => {
    const fixture = await render();
    const trigger = fixture.componentInstance.externalTrigger();
    expect(trigger.isDrawerTrigger()).toBe(false);
    expect(triggerButton(fixture).getAttribute('aria-label')).toBe(
      'Collapse sidebar',
    );

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(trigger.isDrawerTrigger()).toBe(true);
    expect(triggerButton(fixture).getAttribute('aria-label')).toBe(
      'Open navigation menu',
    );
    expect(triggerButton(fixture).getAttribute('aria-expanded')).toBe('false');

    triggerButton(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(triggerButton(fixture).getAttribute('aria-label')).toBe(
      'Close navigation menu',
    );
    expect(triggerButton(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('restores the pre-override collapsed state when the viewport grows back', async () => {
    const fixture = await render();
    const sidebar = fixture.componentInstance.sidebar();

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(sidebar.collapsed()).toBe(true);

    setViewport('lg');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sidebar.effectiveMode()).toBe('icon');
    expect(sidebar.collapsed()).toBe(false);
  });

  it('overrides fixed mode below the breakpoint and unhides the trigger', async () => {
    const fixture = await render();
    fixture.componentInstance.mode.set('fixed');
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = triggerButton(fixture);
    expect(trigger.style.display).toBe('none');

    setViewport('sm');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const sidebar = fixture.componentInstance.sidebar();
    expect(sidebar.effectiveMode()).toBe('offcanvas');
    expect(trigger.style.display).toBe('');
    // Collapse is no longer suppressed, so the drawer really is closed.
    expect(sidebar.collapsed()).toBe(true);
  });
});

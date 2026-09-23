import type { BreakpointState } from '@angular/cdk/layout';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ApplicationInitStatus,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { BehaviorSubject } from 'rxjs';
import { provideMlvDensity } from '@malva-ui/cdk/density';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { ProjectWorkspaceShowcaseComponent } from './project-workspace';

const MD_QUERY = '(min-width: 768px)';
const LG_QUERY = '(min-width: 1200px)';

@Component({
  selector: 'docs-project-workspace-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ProjectWorkspaceTestHostComponent {}

interface RenderedShowcase {
  readonly component: ProjectWorkspaceShowcaseComponent;
  readonly root: HTMLElement;
  readonly harness: RouterTestingHarness;
  readonly viewport: BehaviorSubject<BreakpointState>;
}

function viewportState(tier: 'compact' | 'desktop'): BreakpointState {
  const desktop = tier === 'desktop';
  return {
    matches: desktop,
    breakpoints: {
      [MD_QUERY]: desktop,
      [LG_QUERY]: desktop,
    },
  };
}

async function settle(rendered: RenderedShowcase, delay = 0): Promise<void> {
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  rendered.harness.fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
}

async function renderAt(
  tier: 'compact' | 'desktop' = 'desktop',
): Promise<RenderedShowcase> {
  const viewport = new BehaviorSubject<BreakpointState>(viewportState(tier));

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: ProjectWorkspaceTestHostComponent,
          children: [
            {
              path: 'showcases/project-workspace',
              component: ProjectWorkspaceShowcaseComponent,
            },
          ],
        },
      ]),
      provideMlvDensity('comfortable'),
      provideMlvI18n(() => import('@malva-ui/i18n/en')),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => viewport.asObservable() },
      },
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;

  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/showcases/project-workspace');
  const rendered: RenderedShowcase = {
    component: harness.fixture.debugElement.query(
      By.directive(ProjectWorkspaceShowcaseComponent),
    ).componentInstance as ProjectWorkspaceShowcaseComponent,
    root: harness.fixture.nativeElement as HTMLElement,
    harness,
    viewport,
  };
  await settle(rendered);
  return rendered;
}

function buttonsNamed(
  label: string,
  parent: ParentNode = document,
): HTMLButtonElement[] {
  return Array.from(
    parent.querySelectorAll<HTMLButtonElement>('button'),
  ).filter(
    (button) =>
      button.getAttribute('aria-label')?.trim() === label ||
      button.textContent?.trim() === label,
  );
}

function buttonNamed(
  label: string,
  parent: ParentNode = document,
): HTMLButtonElement {
  const button = buttonsNamed(label, parent)[0];
  if (!button) {
    throw new Error(`Expected button named “${label}”`);
  }
  return button;
}

async function clickButton(
  rendered: RenderedShowcase,
  label: string,
  parent: ParentNode = document,
): Promise<HTMLButtonElement> {
  const button = buttonNamed(label, parent);
  button.click();
  await settle(rendered);
  return button;
}

function menuItem(label: string, parent: ParentNode = document): HTMLElement {
  const item = Array.from(
    parent.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((candidate) => candidate.textContent?.trim() === label);
  if (!item) {
    throw new Error(`Expected menu item named “${label}”`);
  }
  return item;
}

async function clickMenuItem(
  rendered: RenderedShowcase,
  label: string,
  parent: ParentNode = document,
): Promise<void> {
  menuItem(label, parent).click();
  await settle(rendered);
}

async function setViewport(
  rendered: RenderedShowcase,
  tier: 'compact' | 'desktop',
): Promise<void> {
  rendered.viewport.next(viewportState(tier));
  await settle(rendered);
}

async function clickTab(
  rendered: RenderedShowcase,
  label: string,
): Promise<void> {
  const tab = Array.from(
    rendered.root.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).find((candidate) => candidate.textContent?.trim() === label);
  if (!tab) {
    throw new Error(`Expected tab named “${label}”`);
  }
  tab.click();
  await settle(rendered);
}

function groupToggle(
  label: string,
  parent: ParentNode = document,
): HTMLButtonElement {
  const toggle = Array.from(
    parent.querySelectorAll<HTMLButtonElement>(
      '.project-workspace-showcase__group-toggle',
    ),
  ).find((button) => button.textContent?.includes(label));
  if (!toggle) {
    throw new Error(`Expected group toggle for “${label}”`);
  }
  return toggle;
}

function tableRows(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('.mlv-data-table__row--data'),
  );
}

function sidebarItemNamed(
  label: string,
  parent: ParentNode = document,
): HTMLElement {
  const item = Array.from(
    parent.querySelectorAll<HTMLElement>('mlv-sidebar-item'),
  ).find((candidate) => candidate.getAttribute('aria-label') === label);
  if (!item) {
    throw new Error(`Expected sidebar item named “${label}”`);
  }
  return item;
}

function finishOverlayAnimations(): void {
  document
    .querySelectorAll<HTMLElement>(
      '.mlv-dialog--leave, .mlv-drawer--leave, .mlv-popup--leave',
    )
    .forEach((element) =>
      element.dispatchEvent(new Event('animationend', { bubbles: true })),
    );
}

async function finishClosing(rendered: RenderedShowcase): Promise<void> {
  await settle(rendered);
  finishOverlayAnimations();
  await settle(rendered);
}

describe('ProjectWorkspaceShowcaseComponent', () => {
  afterEach(() => {
    finishOverlayAnimations();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('orders rail, project navigation, content, and inspector', async () => {
    const rendered = await renderAt();
    const body = rendered.root.querySelector('.mlv-page-shell__body');
    expect(body).not.toBeNull();
    expect(
      [...(body as Element).children].map((node: Element) =>
        node.getAttribute('data-region'),
      ),
    ).toEqual(['rail', 'project-navigation', null, 'inspector']);
  });

  it('changes task status and updates summary progress', async () => {
    const rendered = await renderAt();
    const before = rendered.component.progress();
    rendered.component.setTaskStatus('responsive-shell', 'done');
    expect(rendered.component.progress()).toBeGreaterThan(before);
  });

  it('keeps the main landmark targetable by the app-bar skip link', async () => {
    const rendered = await renderAt();
    expect(rendered.root.querySelector('main#main-content')).not.toBeNull();
  });

  it('switches Summary, Activity, and Files tab panels', async () => {
    const rendered = await renderAt();
    expect(rendered.root.querySelector('mlv-data-table')).not.toBeNull();

    await clickTab(rendered, 'Activity');
    expect(rendered.root.querySelector('mlv-data-table')).toBeNull();
    expect(
      rendered.root.querySelector('[aria-label="Recent activity"]'),
    ).not.toBeNull();

    await clickTab(rendered, 'Files');
    expect(
      rendered.root.querySelector('[aria-label="Recent activity"]'),
    ).toBeNull();
    expect(
      rendered.root.querySelector('[aria-label="Project files"]'),
    ).not.toBeNull();
    expect(rendered.root.textContent).toContain('design-spec.pdf');

    await clickTab(rendered, 'Summary');
    expect(rendered.root.querySelector('mlv-data-table')).not.toBeNull();
  });

  it('collapses and re-expands a task group in place', async () => {
    const rendered = await renderAt();
    expect(tableRows(rendered.root)).toHaveLength(10);
    expect(rendered.root.textContent).toContain('Project brief sign-off');

    const toggle = groupToggle('Planning', rendered.root);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    await settle(rendered);

    expect(tableRows(rendered.root)).toHaveLength(8);
    expect(rendered.root.textContent).not.toContain('Project brief sign-off');
    expect(
      groupToggle('Planning', rendered.root).getAttribute('aria-expanded'),
    ).toBe('false');

    groupToggle('Planning', rendered.root).click();
    await settle(rendered);
    expect(tableRows(rendered.root)).toHaveLength(10);
    expect(rendered.root.textContent).toContain('Project brief sign-off');
  });

  it('changes a task status through the row menu and notifies politely', async () => {
    const rendered = await renderAt();
    const before = rendered.component.progress();
    await clickButton(
      rendered,
      'Change status for Responsive shell',
      rendered.root,
    );
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    expect(menu).not.toBeNull();

    await clickMenuItem(rendered, 'Done', menu ?? document);

    const task = rendered.component
      .tasks()
      .find((candidate) => candidate.id === 'responsive-shell');
    expect(task?.status).toBe('done');
    expect(task?.progress).toBe(100);
    expect(rendered.component.progress()).toBeGreaterThan(before);

    const notification = document.querySelector('.mlv-notification-item');
    expect(notification).not.toBeNull();
    expect(notification?.textContent).toContain('Responsive shell');
    expect(notification?.textContent).toContain('Done');
  });

  it('changes the active project navigation item', async () => {
    const rendered = await renderAt();
    expect(rendered.component.activeNavId()).toBe('overview');
    expect(
      sidebarItemNamed('Overview', rendered.root).getAttribute('aria-current'),
    ).toBe('page');

    sidebarItemNamed('Tasks', rendered.root).click();
    await settle(rendered);

    expect(rendered.component.activeNavId()).toBe('tasks');
    expect(
      sidebarItemNamed('Tasks', rendered.root).getAttribute('aria-current'),
    ).toBe('page');
    expect(
      sidebarItemNamed('Overview', rendered.root).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('collapses and reopens the project navigation from the header trigger', async () => {
    const rendered = await renderAt();
    expect(rendered.component.projectNavCollapsed()).toBe(false);

    await clickButton(rendered, 'Collapse sidebar', rendered.root);
    expect(rendered.component.projectNavCollapsed()).toBe(true);

    await clickButton(rendered, 'Expand sidebar', rendered.root);
    expect(rendered.component.projectNavCollapsed()).toBe(false);
  });

  it('closes and reopens the inspector and restores focus to the trigger', async () => {
    const rendered = await renderAt();
    expect(
      rendered.root.querySelector('[data-project-details]'),
    ).not.toBeNull();

    const trigger = buttonNamed('Details', rendered.root);
    trigger.focus();
    trigger.click();
    await settle(rendered);
    expect(rendered.component.inspectorOpened()).toBe(false);
    expect(rendered.root.querySelector('[data-project-details]')).toBeNull();

    trigger.click();
    await settle(rendered);
    expect(rendered.component.inspectorOpened()).toBe(true);
    expect(
      rendered.root.querySelector('[data-project-details]'),
    ).not.toBeNull();

    await clickButton(rendered, 'Close project details', rendered.root);
    expect(rendered.component.inspectorOpened()).toBe(false);
    expect(rendered.root.querySelector('[data-project-details]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the rail inline and moves project navigation off-canvas below lg', async () => {
    const rendered = await renderAt('compact');
    expect(rendered.root.querySelectorAll('mlv-sidebar')).toHaveLength(2);
    expect(
      rendered.root
        .querySelector('[data-region="rail"]')
        ?.classList.contains('mlv-sidebar--icon'),
    ).toBe(true);
    expect(
      rendered.root
        .querySelector('[data-region="project-navigation"]')
        ?.classList.contains('mlv-sidebar--offcanvas'),
    ).toBe(true);

    await clickButton(rendered, 'Open navigation menu', rendered.root);
    const drawer = document.querySelector<HTMLElement>(
      '.mlv-drawer[role="dialog"]',
    );
    expect(drawer).not.toBeNull();
    expect(drawer?.textContent).toContain('Overview');
    drawer?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishClosing(rendered);
    expect(document.querySelector('.mlv-drawer[role="dialog"]')).toBeNull();
  });

  it('starts with a closed inspector below lg and opens it as a drawer', async () => {
    const rendered = await renderAt('compact');
    expect(rendered.component.inspectorOpened()).toBe(false);
    expect(document.querySelector('[data-project-details]')).toBeNull();

    await clickButton(rendered, 'Details', rendered.root);
    expect(rendered.component.inspectorOpened()).toBe(true);
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Project details"]',
    );
    expect(dialog).not.toBeNull();
    expect(document.querySelectorAll('[data-project-details]')).toHaveLength(1);

    dialog?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await finishClosing(rendered);
    expect(rendered.component.inspectorOpened()).toBe(false);
    expect(document.querySelector('[data-project-details]')).toBeNull();
  });

  it('keeps one inspector content instance across breakpoint migration', async () => {
    const rendered = await renderAt();
    expect(
      rendered.root.querySelectorAll('[data-project-details]'),
    ).toHaveLength(1);

    await setViewport(rendered, 'compact');
    expect(document.querySelectorAll('[data-project-details]')).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"][aria-label="Project details"]'),
    ).not.toBeNull();

    await setViewport(rendered, 'desktop');
    expect(document.querySelectorAll('[data-project-details]')).toHaveLength(1);
    expect(
      document.querySelector('[role="dialog"][aria-label="Project details"]'),
    ).toBeNull();
    expect(
      rendered.root.querySelector('aside[aria-label="Project details"]'),
    ).not.toBeNull();
  });

  it('adds a deterministic task through the rendered primary action', async () => {
    const rendered = await renderAt();
    const initialCount = rendered.component.tasks().length;
    const before = rendered.component.progress();

    await clickButton(rendered, 'New task', rendered.root);

    expect(rendered.component.tasks()).toHaveLength(initialCount + 1);
    expect(rendered.component.tasks().at(-1)?.id).toBe('new-task-8');
    expect(rendered.component.progress()).toBeLessThan(before);
    expect(rendered.component.openTaskCount()).toBe(6);
  });

  it('keeps the default desktop state axe-clean', async () => {
    const rendered = await renderAt();
    await expectNoAxeViolations(rendered.root);
  });
});

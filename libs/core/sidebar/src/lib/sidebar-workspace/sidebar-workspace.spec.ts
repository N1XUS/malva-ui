import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import axe from 'axe-core';
import { MlvSidebar } from '../sidebar/sidebar';
import {
  MlvSidebarWorkspaceLogo,
  MlvSidebarWorkspaceText,
} from './sidebar-workspace.directives';
import { MlvSidebarWorkspace } from './sidebar-workspace';
import type { MlvSidebarWorkspaceOption } from './sidebar-workspace.types';

const WORKSPACES: readonly MlvSidebarWorkspaceOption[] = [
  { id: 'acme', label: 'Acme Inc', description: 'Enterprise' },
  { id: 'malva', label: 'Malva Labs', description: 'Design' },
];

@Component({
  imports: [
    MlvSidebar,
    MlvSidebarWorkspace,
    MlvSidebarWorkspaceLogo,
    MlvSidebarWorkspaceText,
  ],
  template: `
    <mlv-sidebar [collapsed]="collapsed()">
      <mlv-sidebar-workspace
        [workspaces]="workspaces()"
        [(workspace)]="workspace"
      >
        <ng-template mlvSidebarWorkspaceLogo let-option>
          <span class="custom-logo">{{ option.id }}</span>
        </ng-template>
        <ng-template mlvSidebarWorkspaceText let-option let-selected="selected">
          <span class="custom-label">{{ option.label }}</span>
          <span class="custom-description">
            {{ option.description }}{{ selected ? ' active' : '' }}
          </span>
        </ng-template>
      </mlv-sidebar-workspace>
    </mlv-sidebar>
  `,
})
class WorkspaceHost {
  readonly collapsed = signal(false);
  readonly workspaces =
    signal<readonly MlvSidebarWorkspaceOption[]>(WORKSPACES);
  readonly workspace = signal<MlvSidebarWorkspaceOption>(WORKSPACES[0]);
}

describe('MlvSidebarWorkspace', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerElement = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  it('renders the selected workspace through the logo and text templates', () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.custom-logo')?.textContent.trim(),
    ).toBe('acme');
    expect(
      fixture.nativeElement.querySelector('.custom-label')?.textContent.trim(),
    ).toBe('Acme Inc');
    expect(
      fixture.nativeElement
        .querySelector('.custom-description')
        ?.textContent.trim(),
    ).toBe('Enterprise active');
  });

  it('renders a non-interactive row when only one workspace is available', () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.componentInstance.workspaces.set([WORKSPACES[0]]);
    fixture.detectChanges();

    const workspace = fixture.nativeElement.querySelector(
      'mlv-sidebar-workspace',
    ) as HTMLElement;
    expect(workspace.querySelector('button')).toBeNull();
    expect(
      workspace.querySelector('.mlv-sidebar-workspace__chevron'),
    ).toBeNull();
  });

  it('opens a labelled menu containing every available workspace', async () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-workspace__trigger',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe(
      'Switch workspace. Current workspace: Acme Inc',
    );

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menu = overlayContainerElement.querySelector('[role="menu"]');
    const items = overlayContainerElement.querySelectorAll(
      '.mlv-sidebar-workspace__option',
    );
    expect(menu?.getAttribute('aria-label')).toBe('Workspaces');
    expect(items).toHaveLength(2);
    expect(items[0].getAttribute('aria-current')).toBe('true');
    expect(
      items[0].querySelector('.mlv-sidebar-workspace__check'),
    ).toBeTruthy();

    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    overlayContainerElement
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('updates the workspace model when a menu option is selected', async () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.mlv-sidebar-workspace__trigger',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const items = overlayContainerElement.querySelectorAll<HTMLElement>(
      '.mlv-sidebar-workspace__option',
    );
    items[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    overlayContainerElement
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.workspace()).toEqual(WORKSPACES[1]);
  });

  it('uses the sidebar collapsed state without removing the active logo', () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.componentInstance.collapsed.set(true);
    fixture.detectChanges();

    const workspace = fixture.nativeElement.querySelector(
      'mlv-sidebar-workspace',
    ) as HTMLElement;
    expect(
      workspace.classList.contains('mlv-sidebar-workspace--collapsed'),
    ).toBe(true);
    expect(workspace.querySelector('.custom-logo')).toBeTruthy();
    expect(
      workspace
        .querySelector('.mlv-sidebar-workspace__trigger')
        ?.getAttribute('aria-label'),
    ).toContain('Acme Inc');
  });

  it('has no detectable accessibility violations in its closed state', async () => {
    const fixture = TestBed.createComponent(WorkspaceHost);
    fixture.detectChanges();

    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

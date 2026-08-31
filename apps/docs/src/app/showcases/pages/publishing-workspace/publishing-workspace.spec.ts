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
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import axe from 'axe-core';
import { BehaviorSubject } from 'rxjs';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import type { MlvUploadedFile } from '@malva-ui/core/file-upload';
// The service/provider contract is static; only locale data is split into lazy packs.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import {
  ARTICLE_VERSIONS,
  UPLOAD_FAILURE_AT_PERCENT,
} from './publishing-workspace.data';
import { PublishingWorkspaceShowcaseComponent } from './publishing-workspace';

const MD_QUERY = '(min-width: 768px)';
const LG_QUERY = '(min-width: 1200px)';

@Component({
  selector: 'docs-publishing-workspace-test-host',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PublishingWorkspaceTestHostComponent {}

interface RenderedShowcase {
  readonly component: PublishingWorkspaceShowcaseComponent;
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

/** Waits for the most recent host-driven AI run to settle into review state. */
async function settleAiStream(rendered: RenderedShowcase): Promise<void> {
  await rendered.component.aiSettled();
  await settle(rendered);
}

async function renderAt(
  url = '/showcases/publishing-workspace',
  tier: 'compact' | 'desktop' = 'desktop',
): Promise<RenderedShowcase> {
  const viewport = new BehaviorSubject<BreakpointState>(viewportState(tier));

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: PublishingWorkspaceTestHostComponent,
          children: [
            {
              path: 'showcases/publishing-workspace',
              component: PublishingWorkspaceShowcaseComponent,
            },
          ],
        },
      ]),
      provideAnimationsAsync('noop'),
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
  await harness.navigateByUrl(url);
  const rendered: RenderedShowcase = {
    component: harness.fixture.debugElement.query(
      By.directive(PublishingWorkspaceShowcaseComponent),
    ).componentInstance as PublishingWorkspaceShowcaseComponent,
    root: harness.fixture.nativeElement as HTMLElement,
    harness,
    viewport,
  };
  // The editor constructs its Tiptap instance after the first browser render.
  await settle(rendered, 20);
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

function versionRow(
  rendered: RenderedShowcase,
  label: string,
): HTMLButtonElement {
  const row = Array.from(
    rendered.root.querySelectorAll<HTMLButtonElement>(
      '.publishing-workspace-showcase__version',
    ),
  ).find((button) => button.textContent?.includes(label));
  if (!row) {
    throw new Error(`Expected version row “${label}”`);
  }
  return row;
}

function uploadedFile(id: string, name: string): MlvUploadedFile {
  return {
    id,
    file: new File(['x'], name, { type: 'image/png' }),
    name,
    size: 1,
    state: 'pending',
  };
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

describe('PublishingWorkspaceShowcaseComponent', () => {
  afterEach(() => {
    finishOverlayAnimations();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((element) => element.remove());
  });

  it('composes the workspace around one skip-linkable main landmark', async () => {
    const rendered = await renderAt();

    expect(rendered.root.querySelectorAll('main#main-content')).toHaveLength(1);
    expect(rendered.root.querySelectorAll('mlv-sidebar')).toHaveLength(1);
    expect(rendered.root.querySelector('mlv-editor')).not.toBeNull();
    expect(rendered.root.textContent).toContain(
      'Malva Cloud 3.4 release notes',
    );
    expect(rendered.root.textContent).toContain('Draft');
    expect(buttonsNamed('Publish', rendered.root)).toHaveLength(1);
    expect(buttonsNamed('Preview', rendered.root)).toHaveLength(1);
    expect(
      rendered.root.querySelector('aside[aria-label="Review & versions"]'),
    ).not.toBeNull();
  });

  it('accepts an AI review suggestion into the document', async () => {
    const rendered = await renderAt();
    const component = rendered.component;

    component.requestSuggestion('shorten');
    await settleAiStream(rendered);
    expect(component.reviewSuggestion()).not.toBeNull();

    component.acceptSuggestion();
    await settle(rendered);
    expect(component.documentHtml()).toContain('A clearer product update');
    expect(component.reviewSuggestion()).toBeNull();
  });

  it('rejects an AI review suggestion and restores the original intro', async () => {
    const rendered = await renderAt();
    const component = rendered.component;

    component.requestSuggestion('shorten');
    await settleAiStream(rendered);
    expect(component.reviewSuggestion()).not.toBeNull();

    component.rejectSuggestion();
    await settle(rendered);
    expect(component.documentHtml()).toContain(
      'brings the publishing workflow together',
    );
    expect(component.documentHtml()).not.toContain('A clearer product update');
    expect(component.reviewSuggestion()).toBeNull();
  });

  it('publishes only after confirmation', async () => {
    const rendered = await renderAt();
    const component = rendered.component;

    component.openPublishDialog();
    expect(component.status()).toBe('draft');
    component.confirmPublish();
    expect(component.status()).toBe('published');
  });

  it('runs the publish confirmation through the rendered dialog and restores focus', async () => {
    const rendered = await renderAt();
    const publish = buttonNamed('Publish', rendered.root);
    publish.focus();
    publish.click();
    await settle(rendered);

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Publish immediately');

    await clickButton(rendered, 'Cancel');
    await finishClosing(rendered);
    expect(rendered.component.status()).toBe('draft');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(publish);

    publish.click();
    await settle(rendered);
    await clickButton(rendered, 'Publish now');
    await finishClosing(rendered);
    expect(rendered.component.status()).toBe('published');
    expect(publish.disabled).toBe(true);
    expect(rendered.root.textContent).toContain('Published');
  });

  it('opens a split-pane comparison for a selected version and closes back to the editor', async () => {
    const rendered = await renderAt();
    expect(rendered.root.querySelector('mlv-editor')).not.toBeNull();

    versionRow(rendered, 'First draft').click();
    await settle(rendered);

    expect(rendered.component.selectedVersion()?.id).toBe('v1');
    expect(rendered.root.querySelector('mlv-split-pane')).not.toBeNull();
    expect(rendered.root.querySelectorAll('mlv-split-pane-panel')).toHaveLength(
      2,
    );
    expect(rendered.root.querySelector('mlv-editor')).toBeNull();
    expect(rendered.root.textContent).toContain('Current draft');
    expect(rendered.root.textContent).toContain(
      ARTICLE_VERSIONS.find((version) => version.id === 'v1')?.label ?? '',
    );

    await clickButton(rendered, 'Close comparison', rendered.root);
    expect(rendered.component.selectedVersion()).toBeNull();
    expect(rendered.root.querySelector('mlv-split-pane')).toBeNull();
    await settle(rendered, 20);
    expect(rendered.root.querySelector('mlv-editor')).not.toBeNull();
  });

  it('changes the draft status from the review inspector', async () => {
    const rendered = await renderAt();

    await clickButton(rendered, 'Request review', rendered.root);
    expect(rendered.component.status()).toBe('in-review');
    expect(rendered.root.textContent).toContain('In review');

    await clickButton(rendered, 'Mark as draft', rendered.root);
    expect(rendered.component.status()).toBe('draft');
  });

  it('simulates upload progress with one deterministic failure and retry', async () => {
    const rendered = await renderAt();
    const component = rendered.component;

    component.onAttachmentsChange([uploadedFile('cover-1', 'cover.png')]);
    await settle(rendered);
    expect(component.attachments()[0]?.state).toBe('uploading');

    await settle(rendered, 400);
    expect(component.attachments()[0]).toMatchObject({
      state: 'error',
      progress: UPLOAD_FAILURE_AT_PERCENT,
    });
    expect(buttonsNamed('Retry upload', rendered.root)).toHaveLength(1);

    component.retryUpload('cover-1');
    await settle(rendered, 600);
    expect(component.attachments()[0]).toMatchObject({
      state: 'success',
      progress: 100,
    });
    expect(buttonsNamed('Retry upload', rendered.root)).toHaveLength(0);

    component.onAttachmentsChange([
      ...component.attachments(),
      uploadedFile('shot-2', 'screenshot.png'),
    ]);
    await settle(rendered, 600);
    expect(
      component.attachments().find((file) => file.id === 'shot-2'),
    ).toMatchObject({ state: 'success', progress: 100 });
  });

  it('switches documents from the sidebar and preserves in-session edits', async () => {
    const rendered = await renderAt();
    const component = rendered.component;

    component.documentHtml.set('<p>Edited body kept across switches.</p>');
    const otherDocument = Array.from(
      rendered.root.querySelectorAll<HTMLElement>('mlv-sidebar-item'),
    ).find((item) =>
      item.getAttribute('aria-label')?.includes('Editor deep dive'),
    );
    expect(otherDocument).toBeDefined();
    otherDocument?.click();
    await settle(rendered, 20);

    expect(component.activeDocumentId()).toBe('editor-deep-dive');
    expect(component.documentHtml()).toContain('block editor');

    component.selectDocument('malva-cloud-3-4');
    await settle(rendered, 20);
    expect(component.documentHtml()).toContain(
      'Edited body kept across switches.',
    );
  });

  it('keeps the default workspace state axe-clean', async () => {
    const rendered = await renderAt();
    const results = await axe.run(rendered.root, {
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });
});

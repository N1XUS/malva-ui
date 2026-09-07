import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  inject,
  DestroyRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { ExampleContainerComponent } from '../example-container';
import { ExamplePipe } from '../example-pipe';
import { ComponentPipe } from '../component-pipe';
import { DocsDocumentationPipe } from '../documentation.pipe';
import { DocsTocService, DocsTocSourceDirective } from '../toc';
import { ApiViewerComponent } from '../api-viewer';
import { hasApiEntry } from '../../../generated/api';
import { MlvDensityDirective } from '@malva-ui/cdk/density';
import { LucideLink } from '@lucide/angular';
import { showcaseRouteForComponent } from '../../showcases/showcase.registry';

export interface DocPageMeta {
  title: string;
  description?: string;
  category?: string;
}

/**
 * Human display headers accepted by docs pages, mapped to the canonical route
 * paths stored in showcase component inventories. Legacy kebab-case headers
 * remain supported through the explicit canonical set below.
 */
const DOCS_HEADER_TO_CANONICAL_PATH: Readonly<Record<string, string>> = {
  Alert: 'alert',
  Avatar: 'avatar',
  'Avatar Group': 'avatar-group',
  Badge: 'badge',
  Checkbox: 'checkbox',
  Chat: 'chat',
  'Data Table': 'data-table',
  Dialog: 'dialog',
  Drawer: 'drawer',
  'AI Kit': 'editor-ai',
  Editor: 'editor',
  'Editor AI': 'editor-ai',
  'File Upload': 'file-upload',
  Filter: 'filter',
  Form: 'form',
  'Form Field': 'form-field',
  Input: 'input',
  List: 'list',
  Menu: 'menu',
  Notification: 'notification',
  Page: 'page',
  Pagination: 'pagination',
  'PIN Input': 'pin-input',
  'Pin Input': 'pin-input',
  Progress: 'progress',
  Radio: 'radio',
  'Search Field': 'search-field',
  Select: 'select',
  Sidebar: 'sidebar',
  'Split Pane': 'split-pane',
  Switch: 'switch',
  Tabs: 'tabs',
  Textarea: 'textarea',
  'Time Picker': 'time-picker',
  Timeline: 'timeline',
  Title: 'title',
  Toast: 'toast',
  Tokenizer: 'tokenizer',
  Toolbar: 'toolbar',
  Tooltip: 'tooltip',
  'View Variant': 'view-variant',
};

const SHOWCASE_COMPONENT_PATHS = new Set(
  Object.values(DOCS_HEADER_TO_CANONICAL_PATH),
);

/** Resolves a docs display header without ever treating an unknown label as a route. */
function canonicalPathForDocsHeader(header: string): string | null {
  return (
    DOCS_HEADER_TO_CANONICAL_PATH[header] ??
    (SHOWCASE_COMPONENT_PATHS.has(header) ? header : null)
  );
}

/**
 * Universal component-page shell. Renders the page title/description, then —
 * when the page's library has an extracted API entry — a link-mode
 * `mlv-segmented` with two router links:
 *
 * - **Examples** → `routerLink` to the page base (`/<name>`), matched
 *   `{ exact: true }` so the base URL does not also mark the API link active.
 * - **API** → `routerLink` to `/<name>/api`, hosting `docs-api-viewer`.
 *
 * The two panels are mutually exclusive: at `/<name>` only the examples mount;
 * at `/<name>/api` only the API viewer mounts. Which panel renders is derived
 * from the router URL (`isApiRoute()`), the segmented control derives its own
 * active link from the same URL, and the `/<name>/api` route is a componentless
 * child of `/<name>` (registered by `withApiTab` in `app.routes.ts`), so this
 * component instance is **reused** across the two URLs — switching never tears
 * the page down.
 *
 * Pages whose library has no extracted API entry (`hasApiEntry(header())` is
 * `false`, e.g. `animated-presence`) render the examples flat with no switcher.
 */
@Component({
  selector: 'docs-page',
  imports: [
    NgTemplateOutlet,
    AsyncPipe,
    RouterLink,
    MlvSegmented,
    MlvSegmentedItem,
    DocsTocSourceDirective,
    ApiViewerComponent,
    ExampleContainerComponent,
    ExamplePipe,
    ComponentPipe,
    DocsDocumentationPipe,
    MlvDensityDirective,
    LucideLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ meta().title }}</h1>
    @if (meta().description; as description) {
      <p class="doc-page__description">{{ description }}</p>
    }

    @if (hasApi()) {
      <mlv-segmented class="doc-page__tabs">
        <a
          mlvSegmentedItem
          [routerLink]="examplesLink()"
          [linkActiveOptions]="exactMatch"
        >
          Examples
        </a>
        <a mlvSegmentedItem [routerLink]="apiLink()">API</a>
      </mlv-segmented>
      @if (isApiRoute()) {
        <div class="doc-page__panel">
          <docs-api-viewer [name]="apiName()" />
        </div>
      } @else {
        <div class="doc-page__panel" docsTocSource>
          <ng-container [ngTemplateOutlet]="examplesTpl" />
        </div>
      }
    } @else {
      <div class="doc-page__panel" docsTocSource>
        <ng-container [ngTemplateOutlet]="examplesTpl" />
      </div>
    }

    <ng-template #examplesTpl>
      <ng-content />
      @for (example of examples(); track $index) {
        <div [attr.id]="'example-' + $index">
          @if (example | docsDocumentation | async; as entry) {
            <div class="doc-page__example__documentation">
              @if (entry.frontmatter.title; as title) {
                <h2>
                  {{ title }}
                  <a [attr.href]="'#example-' + $index">
                    <svg lucideLink [size]="16"></svg>
                  </a>
                </h2>
              }
              @if (entry.frontmatter.description; as description) {
                <p>{{ description }}</p>
              }
              <div [innerHTML]="entry.html"></div>
            </div>
          }
          <section class="demo-section">
            <docs-example-container
              [component]="example | docsComponent | async"
              [content]="example | docsExample"
              [fullExampleRoute]="$index === 0 ? showcaseRoute() : null"
            ></docs-example-container>
          </section>
        </div>
      }
    </ng-template>
  `,
  styles: `
    .doc-page__description {
      color: var(--mlv-text-secondary, #666);
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }

    .doc-page__tabs {
      margin-top: 1rem;
    }

    .doc-page__panel {
      padding-top: 1rem;
    }

    .doc-page__example__documentation hr {
      display: none;
    }
  `,
})
export class DocPageComponent {
  readonly type = input<string>();
  readonly header = input<string>();
  readonly meta = input.required<DocPageMeta>();
  readonly examples = input<number[]>();

  /** Route for the first example, resolved from its display header via a canonical alias. */
  readonly showcaseRoute = computed(() => {
    const header = this.header();
    const canonicalPath = header ? canonicalPathForDocsHeader(header) : null;

    return canonicalPath ? showcaseRouteForComponent(canonicalPath) : null;
  });

  /**
   * Whether the page's library has an extracted API entry — gates the routed
   * two-tab layout. When `false`, the examples render flat with no tab bar.
   */
  readonly hasApi = computed(() => {
    const header = this.header();
    return !!header && hasApiEntry(header);
  });

  /** RouterLink target for the Examples tab (the page base path). */
  readonly examplesLink = computed(() => '/' + this.header());

  /** RouterLink target for the API tab (`/<name>/api`). */
  readonly apiLink = computed(() => '/' + this.header() + '/api');

  /** Non-empty kebab page name passed to `docs-api-viewer` (only used when `hasApi()`). */
  readonly apiName = computed(() => this.header() ?? '');

  /**
   * Stable `linkActiveOptions` for the Examples link. `{ exact: true }` is
   * mandatory: with the default subset match, `/<name>` would also satisfy the
   * API link's `/<name>/api` and both segments would read active.
   */
  readonly exactMatch: { exact: boolean } = { exact: true };

  /** @private Router — the panel switch is URL-driven, like the segmented links. */
  private readonly _router = inject(Router);

  /**
   * @private Current router URL, refreshed on every `NavigationEnd`. Seeded
   * with the URL at construction so a direct load of `/<name>/api` shows the
   * API panel without waiting for a navigation event.
   */
  private readonly _url = toSignal(
    this._router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this._router.url),
    ),
    { initialValue: this._router.url },
  );

  /**
   * Whether the API panel is mounted: the current URL is exactly `/<name>/api`
   * (query string and fragment ignored). Everything else — including the page
   * base — shows the examples panel.
   */
  readonly isApiRoute = computed(() => {
    this._url();
    return this._router.isActive(this.apiLink(), {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  });

  /** @private ToC service — force-cleared on destroy so the sidebar empties on navigation. */
  private readonly _tocService = inject(DocsTocService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this._tocService.clear());
  }
}

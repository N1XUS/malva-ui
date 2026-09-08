import type { Type } from '@angular/core';
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
  effect,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  LucideChevronDown,
  LucideChevronUp,
  LucideExternalLink,
} from '@lucide/angular';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvDensityService } from '@malva-ui/cdk/density';
import type { MlvDirection } from '@malva-ui/cdk/utils';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvExpand, MlvExpandContent } from '@malva-ui/core/expand';
import type { MlvTheme } from '@malva-ui/core/layout';
import { MlvThemeService } from '@malva-ui/core/layout';
import {
  MlvTab,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
} from '@malva-ui/core/tabs';
import { MlvToolbar, MlvToolbarSpacer } from '@malva-ui/core/toolbar';
import { ShikiHighlightService } from '../shiki-highlight.service';
import { OpenInPlaygroundComponent } from '../playground';
import { CopySourceComponent } from './copy-source';
import type { DocsExampleViewport } from './example-controls';
import { ExampleControlsComponent } from './example-controls';
import { DocsExampleScopeDirective } from './example-scope';

export interface ExampleFile {
  filename: string;
  content: string;
  language: string;
}

interface ResolvedFile {
  type: string;
  content: string;
  language: string;
}

/** One cached Shiki render, keyed by the source and theme it was produced for. */
interface HighlightedSource {
  readonly html: SafeHtml;
  readonly theme: MlvTheme;
  readonly content: string;
}

const LANG_MAP: Record<string, string> = {
  TypeScript: 'typescript',
  HTML: 'html',
  SCSS: 'scss',
  CSS: 'css',
};

/** Feeds the `aria-controls` / `id` pair that ties a toggle to its own panel. */
let nextExampleId = 0;

@Component({
  selector: 'docs-example-container',
  imports: [
    NgComponentOutlet,
    MlvButton,
    MlvButtonIcon,
    MlvExpand,
    MlvExpandContent,
    MlvTab,
    MlvTabContentDef,
    MlvTabDef,
    MlvTabGroup,
    MlvToolbar,
    MlvToolbarSpacer,
    RouterLink,
    LucideChevronDown,
    LucideChevronUp,
    LucideExternalLink,
    CopySourceComponent,
    ExampleControlsComponent,
    DocsExampleScopeDirective,
    OpenInPlaygroundComponent,
  ],
  // One of the few docs components that turn encapsulation off (`toc`,
  // `inspector` and `api-viewer` do too). Here the reason is Shiki: its output
  // is bound with `[innerHTML]`, so the `<pre>` / `<code>` it produces carry no
  // `_ngcontent` attribute and emulated encapsulation would never reach them.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="example-container">
      <!-- The bar is the example's chrome, not its content, and a docs page
           builds one container per example - 10 on the button page, 23 on the
           data-table page, all rebuilt on every navigation. Eager, the bars
           were 38% of the page's elements (42 segmented controls and 100
           tooltip directives on the button page) and the whole navigation
           waited for them. Measured in Chromium, median of 6 routed
           navigations: button 107.4ms -> 74.7ms, data-table 214.7ms ->
           147.7ms; initial element count 1553 -> 1147 and 6843 -> 5683.
           The placeholder reserves the bar's box so nothing below it moves. -->
      @defer (on viewport) {
        <docs-example-controls
          [density]="density()"
          (densityChange)="_densityOverride.set($event)"
          [direction]="direction()"
          (directionChange)="_directionOverride.set($event)"
          [theme]="theme()"
          (themeChange)="_themeOverride.set($event)"
          [(viewport)]="viewport"
        />
      } @placeholder {
        <div class="example-container__controls-placeholder"></div>
      }

      <div
        class="example-container__stage"
        docsExampleScope
        [density]="density()"
        [direction]="direction()"
        [theme]="theme()"
      >
        <div
          class="example-container__preview"
          [class]="'example-container__preview--' + viewport()"
        >
          <ng-container *ngComponentOutlet="component()" />
        </div>
      </div>

      <mlv-toolbar class="example-container__toolbar">
        <button
          type="button"
          class="example-container__sources-toggle"
          mlvButton
          variant="transparent"
          [attr.aria-expanded]="sourcesOpen()"
          [attr.aria-controls]="sourcesId"
          (click)="toggleSources()"
        >
          @if (sourcesOpen()) {
            <svg
              mlvButtonIcon
              lucideChevronUp
              data-chevron="up"
              [size]="16"
              aria-hidden="true"
            ></svg>
          } @else {
            <svg
              mlvButtonIcon
              lucideChevronDown
              data-chevron="down"
              [size]="16"
              aria-hidden="true"
            ></svg>
          }
          {{ sourcesOpen() ? 'Hide sources' : 'Show sources' }}
        </button>
        <mlv-toolbar-spacer />
        <docs-open-in-playground
          [files]="resolvedFiles()"
          [heading]="heading() ?? ''"
        />
        @if (fullExampleRoute(); as route) {
          <a
            class="example-container__open-full"
            mlvButton
            variant="transparent"
            [routerLink]="route"
          >
            <svg
              mlvButtonIcon
              lucideExternalLink
              [size]="16"
              aria-hidden="true"
            />
            Open full example
          </a>
        }
      </mlv-toolbar>

      <mlv-expand [attr.id]="sourcesId" [(opened)]="sourcesOpen">
        <!-- Lazy, not projected: mlv-tab-group measures its own header to
             decide what overflows, and a group built inside a collapsed panel
             would measure a zero-width box. The template is constructed on the
             first open instead, which also keeps every example on a docs page
             from building a tab group nobody asked for. -->
        <!-- Guarded, because a tab group with nothing in it is not nothing: it
             still paints its separator and header band, and its empty tablist
             is still a tab stop. -->
        <ng-template mlvExpandContent>
          @if (renderedFiles().length > 0) {
            <mlv-tab-group
              class="example-container__sources"
              [(activeTab)]="activeSource"
            >
              @for (file of renderedFiles(); track file.type) {
                <mlv-tab [value]="file.type">
                  <ng-template mlvTabDef>{{ file.type }}</ng-template>
                  <ng-template mlvTabContent>
                    <div class="example-container__source">
                      <docs-copy-source
                        class="example-container__source-copy"
                        [value]="file.content"
                        [label]="'Copy ' + file.type + ' source'"
                      />
                      @if (file.highlighted; as highlighted) {
                        <div
                          class="example-container__code"
                          [innerHTML]="highlighted"
                        ></div>
                      } @else {
                        <div class="example-container__code">
                          <pre><code>{{ file.content }}</code></pre>
                        </div>
                      }
                    </div>
                  </ng-template>
                </mlv-tab>
              }
            </mlv-tab-group>
          }
        </ng-template>
      </mlv-expand>
    </div>
  `,
  styles: `
    .example-container {
      position: relative;
      margin: var(--mlv-spacing-4) 0;
      overflow: hidden;
      border: var(--mlv-stroke-width) solid var(--mlv-border-normal);
      border-radius: var(--mlv-radius-l);
      background: var(--mlv-background-raised);
    }

    /* The stage is the themed island: it declares the scoped token set, so its
       own background resolves against the example's theme rather than the
       page's. The preview inside it carries only the width cap. */
    .example-container__stage {
      background: var(--mlv-background-base);
      color: var(--mlv-text-primary);
    }

    .example-container__preview {
      width: 100%;
      margin-inline: auto;
      padding: var(--mlv-spacing-6);
      transition: max-width var(--mlv-duration-normal) var(--mlv-ease-default);
    }

    .example-container__preview--mobile {
      max-width: 23.4375rem;
    }

    .example-container__preview--tablet {
      max-width: 48rem;
    }

    /* Holds the deferred bar's box open so the example below it does not jump
       when the bar arrives: a tight action bar is 2rem of segmented control
       plus 2 x var(--mlv-spacing-1) padding plus its bottom hairline. Measured
       at 41.5px against this 41px, the 0.5px being the text-bearing LTR/RTL
       segment's line box; a fixed block-size rather than a min-block-size
       because a placeholder that overshoots would shift the page the other
       way. */
    .example-container__controls-placeholder {
      block-size: 2.5625rem;
      border-bottom: var(--mlv-stroke-width) solid var(--mlv-border-subtle);
    }

    .example-container__toolbar {
      padding: var(--mlv-spacing-1) var(--mlv-spacing-2);
      border-top: var(--mlv-stroke-width) solid var(--mlv-border-subtle);
    }

    .example-container__sources {
      border-top: var(--mlv-stroke-width) solid var(--mlv-border-subtle);
    }

    .example-container__source {
      position: relative;
    }

    /* Hover reveal is a pointer affordance only. The button never leaves the
       tab order, and :focus-within brings it into view for keyboard users. */
    .example-container__source-copy {
      position: absolute;
      z-index: 1;
      inset-block-start: var(--mlv-spacing-2);
      inset-inline-end: var(--mlv-spacing-2);
      border-radius: var(--mlv-radius-button);
      background: var(--mlv-background-raised);
      opacity: 0;
      transition: opacity var(--mlv-duration-fast) var(--mlv-ease-default);
    }

    .example-container__source:hover .example-container__source-copy,
    .example-container__source:focus-within .example-container__source-copy {
      opacity: 1;
    }

    /* No hover to reveal it with — a touch pointer would never see the button. */
    @media (hover: none) {
      .example-container__source-copy {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .example-container__preview,
      .example-container__source-copy {
        transition: none;
      }
    }

    .example-container__code {
      margin: 0;
      overflow-x: auto;
      font-size: var(--mlv-typography-body-s-size);
      line-height: var(--mlv-typography-body-s-line-height);
    }

    .example-container__code pre {
      margin: 0;
      padding: var(--mlv-spacing-4);
      border-radius: 0;
    }

    .example-container__code code {
      font-family: var(--mlv-typography-family-code);
    }
  `,
})
export class ExampleContainerComponent {
  /** @private Page-level theme, the example's starting point. */
  private readonly _themeService = inject(MlvThemeService);

  /** @private Page-level density, the example's starting point. */
  private readonly _densityService = inject(MlvDensityService);

  /** @private Page-level direction, the example's starting point. */
  private readonly _rtlService = inject(MlvRtlService);

  /** @private Sanitizes generated Shiki markup for binding. */
  private readonly _sanitizer = inject(DomSanitizer);

  /** @private Lazily highlights and caches source code across panel remounts. */
  private readonly _highlighter = inject(ShikiHighlightService);

  readonly component = input.required<Type<unknown> | null>();
  readonly files = input<ExampleFile[]>([]);
  readonly content = input<
    Record<string, Promise<{ default: string }> | string> | undefined
  >();
  readonly heading = input<string>();

  /** Optional normal route used to open this example as a full composition. */
  readonly fullExampleRoute = input<string | null>(null);

  /** Whether the source panel is expanded. Gates Shiki highlighting. */
  readonly sourcesOpen = signal(false);

  /**
   * File type of the open source tab, or `''` before the tab group has picked
   * one. It lives here rather than inside the panel because `mlv-expand`
   * re-instantiates its lazy content on every open — a signal owned by the
   * template would reset the reader's choice each time they collapsed it.
   */
  readonly activeSource = signal('');

  /** Width the preview stage is pinned to. */
  readonly viewport = signal<DocsExampleViewport>('desktop');

  /** The example's source files, in the order the `docsExample` pipe yields them. */
  readonly resolvedFiles = signal<ResolvedFile[]>([]);

  /** Ties the disclosure button to the one panel it controls. */
  readonly sourcesId = `docs-example-sources-${nextExampleId++}`;

  /**
   * @protected Per-example override. `null` means "follow the page", so an
   * untouched example keeps tracking the app bar's own switchers and pins
   * itself only once the reader picks something here.
   */
  protected readonly _densityOverride = signal<MlvDensity | null>(null);

  /** @protected See `_densityOverride`. */
  protected readonly _directionOverride = signal<MlvDirection | null>(null);

  /** @protected See `_densityOverride`. */
  protected readonly _themeOverride = signal<MlvTheme | null>(null);

  /** Density applied to this example's stage. */
  readonly density = computed(
    () => this._densityOverride() ?? this._densityService.density(),
  );

  /** Direction applied to this example's stage. */
  readonly direction = computed(
    () => this._directionOverride() ?? this._rtlService.direction(),
  );

  /** Theme applied to this example's stage. */
  readonly theme = computed(
    () => this._themeOverride() ?? this._themeService.currentTheme(),
  );

  /**
   * @private Theme the source panes are rendered in — the **page's**, not the
   * example's. They sit below the toolbar, outside the scoped stage, so a
   * reader flipping one example to dark is not asking its code block to
   * follow. One signal, read by both `renderedFiles` and the highlighting
   * effect, so the cache key and the request can never disagree about which
   * theme "current" means.
   */
  private readonly _sourceTheme = computed(() =>
    this._themeService.currentTheme(),
  );

  /**
   * @private Shiki output per file type. Kept beside `resolvedFiles` rather
   * than inside it so the highlighting effect can write results without
   * invalidating its own dependencies — one combined signal would cancel every
   * sibling file still in flight each time one completed.
   */
  private readonly _highlighted = signal<Record<string, HighlightedSource>>({});

  /**
   * @private The file whose tab is open. `mlv-tab-group` falls back to its
   * first tab when `activeTab` matches none, and writes that choice back a tick
   * later; mirroring the fallback here means the first open starts highlighting
   * straight away instead of waiting for that round trip.
   */
  private readonly _activeFile = computed(() => {
    const files = this.resolvedFiles();
    const active = this.activeSource();
    return files.find((file) => file.type === active) ?? files[0] ?? null;
  });

  /**
   * @protected The source files as the template renders them: each paired with
   * its Shiki markup when one exists for the current content **and** theme, and
   * with `null` (the plain `<pre>` fallback) otherwise.
   */
  protected readonly renderedFiles = computed(() => {
    const highlighted = this._highlighted();
    const theme = this._sourceTheme();

    return this.resolvedFiles().map((file) => {
      const entry = highlighted[file.type];
      return {
        ...file,
        highlighted:
          entry && entry.theme === theme && entry.content === file.content
            ? entry.html
            : null,
      };
    });
  });

  constructor() {
    // Resolve source files up front so the playground button can decide whether
    // this example is portable, but do not invoke Shiki: the source panel is
    // collapsed by default, so eager highlighting would do invisible work for
    // every example on the page.
    effect((onCleanup) => {
      const content = this.content();
      if (!content) return;

      let stale = false;
      onCleanup(() => (stale = true));

      const entries = Object.entries(content) as [
        string,
        Promise<{ default: string }> | string,
      ][];

      Promise.all(
        entries.map(async ([type, data]): Promise<ResolvedFile | null> => {
          const resolved =
            typeof data === 'string' ? data : (await data)?.default;
          if (typeof resolved !== 'string' || resolved.length === 0)
            return null;

          return {
            type,
            content: resolved,
            language: LANG_MAP[type] ?? 'text',
          };
        }),
      ).then((files) => {
        if (stale) return;
        this.resolvedFiles.set(
          files.filter((f): f is ResolvedFile => f !== null),
        );
      });
    });

    // Highlight the open source tab — and only that one: the other tabs' panels
    // are not in the DOM, so tokenizing them would be invisible work. Re-runs on
    // a tab switch and on a page theme change. The root cache keeps results warm
    // when Examples is destroyed by a routed API tab switch.
    effect((onCleanup) => {
      if (!this.sourcesOpen()) return;

      const file = this._activeFile();
      if (!file) return;

      const theme = this._sourceTheme();

      // Read untracked: the `.then` below writes this signal, and tracking it
      // would restart the effect and cancel the request it just started.
      const cached = untracked(this._highlighted)[file.type];
      if (cached && cached.theme === theme && cached.content === file.content)
        return;

      let stale = false;
      onCleanup(() => (stale = true));

      this._highlighter
        .highlight(file.content, file.language, theme)
        .then((html) => {
          if (stale) return;
          this._highlighted.update((current) => ({
            ...current,
            [file.type]: {
              html: this._sanitizer.bypassSecurityTrustHtml(html),
              theme,
              content: file.content,
            },
          }));
        })
        .catch(() => undefined);
    });
  }

  /** Opens or closes the source panel. */
  toggleSources(): void {
    this.sourcesOpen.update((open) => !open);
  }
}

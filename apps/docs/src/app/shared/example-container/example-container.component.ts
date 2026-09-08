import type { Type } from '@angular/core';
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
  input,
  signal,
  effect,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LucideExternalLink } from '@lucide/angular';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  MlvTabGroup,
  MlvTab,
  MlvTabDef,
  MlvTabContentDef,
} from '@malva-ui/core/tabs';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { ShikiHighlightService } from '../shiki-highlight.service';

export interface ExampleFile {
  filename: string;
  content: string;
  language: string;
}

interface ResolvedFile {
  type: string;
  content: string;
  language: string;
  highlighted: SafeHtml | null;
  highlightedTheme: 'light' | 'dark' | null;
}

const LANG_MAP: Record<string, string> = {
  TypeScript: 'typescript',
  HTML: 'html',
  SCSS: 'scss',
  CSS: 'css',
};

@Component({
  selector: 'docs-example-container',
  imports: [
    NgComponentOutlet,
    MlvTabGroup,
    MlvTab,
    MlvTabDef,
    MlvTabContentDef,
    MlvButton,
    MlvButtonIcon,
    RouterLink,
    LucideExternalLink,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="example-container">
      <mlv-tab-group [(activeTab)]="activeTab">
        <mlv-tab value="preview">
          <ng-template mlvTabDef>Preview</ng-template>
          <ng-template mlvTabContent>
            <div class="example-container__preview">
              <ng-container *ngComponentOutlet="component()" />
            </div>
          </ng-template>
        </mlv-tab>
        @for (file of resolvedFiles(); track file.type) {
          <mlv-tab [value]="file.type">
            <ng-template mlvTabDef>{{ file.type }}</ng-template>
            <ng-template mlvTabContent>
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
            </ng-template>
          </mlv-tab>
        }
      </mlv-tab-group>
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
    </div>
  `,
  styles: `
    .example-container {
      position: relative;
      margin: var(--mlv-spacing-4) 0;
      overflow: hidden;
      border: 0.0625rem solid var(--mlv-border-normal);
      border-radius: var(--mlv-radius-l);
      background: var(--mlv-background-raised);
    }

    .example-container__open-full {
      margin: var(--mlv-spacing-2);
    }

    .example-container__preview {
      padding: var(--mlv-spacing-6);
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
  /** @private Theme source used to select the matching Shiki theme. */
  private readonly _themeService = inject(MlvThemeService);

  /** @private Sanitizes generated Shiki markup for binding. */
  private readonly _sanitizer = inject(DomSanitizer);

  /** @private Lazily highlights and caches source code across panel remounts. */
  private readonly _highlighter = inject(ShikiHighlightService);

  readonly component = input.required<Type<unknown> | null>();
  readonly files = input<ExampleFile[]>([]);
  readonly content = input<
    Record<string, Promise<{ default: string }> | string> | undefined
  >();
  readonly activeTab = signal('preview');
  readonly heading = input<string>();

  /** Optional normal route used to open this example as a full composition. */
  readonly fullExampleRoute = input<string | null>(null);

  readonly resolvedFiles = signal<ResolvedFile[]>([]);

  constructor() {
    // Resolve source files so their tab labels can render, but do not invoke
    // Shiki while Preview is active. The code panels are deferred tab content,
    // so eager highlighting here would do invisible work for every example.
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
            highlighted: null,
            highlightedTheme: null,
          };
        }),
      ).then((files) => {
        if (stale) return;
        this.resolvedFiles.set(
          files.filter((f): f is ResolvedFile => f !== null),
        );
      });
    });

    // Highlight only the currently selected source tab. The root cache keeps
    // the result warm when Examples is destroyed by a routed API tab switch.
    effect((onCleanup) => {
      const activeType = this.activeTab();
      if (activeType === 'preview') return;

      const theme = this._themeService.currentTheme();
      const activeFile = this.resolvedFiles().find(
        (file) => file.type === activeType,
      );
      if (!activeFile) return;
      if (
        activeFile.highlighted !== null &&
        activeFile.highlightedTheme === theme
      )
        return;

      let stale = false;
      onCleanup(() => (stale = true));

      this._highlighter
        .highlight(activeFile.content, activeFile.language, theme)
        .then((html) => {
          if (stale) return;

          this.resolvedFiles.update((files) =>
            files.map((file) =>
              file.type === activeType && file.content === activeFile.content
                ? {
                    ...file,
                    highlighted: this._sanitizer.bypassSecurityTrustHtml(html),
                    highlightedTheme: theme,
                  }
                : file,
            ),
          );
        })
        .catch(() => undefined);
    });
  }
}

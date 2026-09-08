import {
  ChangeDetectionStrategy,
  Component,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MlvThemeService } from '@malva-ui/cdk/theme';
import { DocsTocSourceDirective } from '../../shared/toc';
import { HighlightPipe } from '../../shared/highlight.pipe';

@Component({
  imports: [AsyncPipe, DocsTocSourceDirective, HighlightPipe],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tailwind-page' },
})
export class TailwindPageComponent {
  protected readonly codeTheme = inject(MlvThemeService).currentTheme;

  protected readonly installCommand = 'ng add @malva-ui/tailwind';

  protected readonly manualInstallCommand =
    'npm install @malva-ui/core @malva-ui/tailwind';

  protected readonly toolingInstallCommand =
    'npm install --save-dev tailwindcss @tailwindcss/postcss postcss';

  protected readonly stylesheetExample = `@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";`;

  protected readonly liveExample = `<article class="rounded-mlv-card border border-mlv-normal bg-mlv-surface-raised p-mlv-5 shadow-mlv-raised">
  <h2 class="font-mlv-display text-mlv-heading-h2 text-mlv-content">
    A token-backed card
  </h2>
</article>`;

  protected readonly postcssExample = `{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}`;

  protected readonly managedStylesheetExample = `/* malva-ui:tailwind:start */
@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";
/* malva-ui:tailwind:end */`;
}

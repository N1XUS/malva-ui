import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import { MlvLink } from '@malva-ui/core/link';
import { DocsTocSourceDirective } from '../../shared/toc';

@Component({
  imports: [
    RouterLink,
    MlvAccordion,
    MlvAccordionItem,
    MlvCopyToClipboard,
    MlvLink,
    DocsTocSourceDirective,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'getting-started' },
})
export class GettingStartedPageComponent {
  protected readonly installCommand = 'ng add @malva-ui/core';

  protected readonly nonInteractiveCommand = `ng add @malva-ui/core \\
  --project my-app \\
  --theme dark \\
  --density compact \\
  --include-styles \\
  --configure-providers \\
  --no-interactive`;

  protected readonly manualInstallCommand =
    'npm install @malva-ui/core @malva-ui/cdk @malva-ui/i18n';

  protected readonly stylesConfiguration = `{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "styles": [
              "src/styles.scss",
              "node_modules/@malva-ui/core/styles/malva-ui.css"
            ]
          }
        }
      }
    }
  }
}`;

  protected readonly providersConfiguration = `import type { ApplicationConfig } from '@angular/core';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { provideDefaultTheme } from '@malva-ui/cdk/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideDefaultTheme('light', 'mlv-theme'),
    provideMlvDensity('comfortable'),
  ],
};`;

  protected readonly componentExample = `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import { MlvPageShell } from '@malva-ui/core/page';

@Component({
  selector: 'app-root',
  imports: [MlvPageShell, MlvButton],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}`;

  protected readonly templateExample = `<mlv-page-shell sizing="viewport">
  <main mlvPage>
    <button mlvButton>Save changes</button>
  </main>
</mlv-page-shell>`;
}

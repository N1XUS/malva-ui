import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvPage,
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageEndPaneTrigger,
  MlvPageShell,
} from '@malva-ui/core/page';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-page-end-pane-example',
  imports: [
    MlvButton,
    MlvPage,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvPageEndPaneTrigger,
    MlvPageShell,
    MlvTitle,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PageEndPaneExampleComponent {}

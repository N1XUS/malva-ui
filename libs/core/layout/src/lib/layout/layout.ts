import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  ViewEncapsulation,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { MlvLayoutTop } from './directives/MlvLayoutTop';
import { MlvLayoutSide } from './directives/MlvLayoutSide';
import { NgTemplateOutlet } from '@angular/common';
import { MlvThemeService } from './services/theme.service';

@Component({
  selector: 'mlv-layout',
  imports: [NgTemplateOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-layout',
    '[class.mlv-layout--plain]': 'plain()',
    '[attr.mlvTheme]': '_theme()',
  },
})
export class MlvLayout {
  /** @protected Header slot directive projected via `[mlvLayoutTop]`. */
  protected readonly topRef = contentChild(MlvLayoutTop);

  /** @protected Sidebar slot directive projected via `[mlvLayoutSide]`. */
  protected readonly sideRef = contentChild(MlvLayoutSide);

  /** @protected Current active theme, sourced from the theme service. */
  protected readonly _theme = computed(() => {
    return this._themeService.currentTheme();
  });

  readonly plain = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @private Theme service providing the current light/dark theme signal.
   * Injected so the host reflects the theme locally; publishing it on the
   * document element is `MlvThemeService`'s own job, so that a route rendering
   * no `mlv-layout` still themes correctly.
   */
  private readonly _themeService = inject(MlvThemeService);
}

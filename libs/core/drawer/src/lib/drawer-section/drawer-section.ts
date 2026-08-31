import type { OnDestroy, OnInit } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { MlvDrawerSectionState } from '../drawer-sections.service';
import { MlvDrawerSectionsService } from '../drawer-sections.service';
import { mlvNextId } from '@malva-ui/cdk/utils';

@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvDrawerSection]',
  templateUrl: 'drawer-section.html',
  styleUrls: ['drawer-section.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MlvDrawerSection
  implements MlvDrawerSectionState, OnInit, OnDestroy
{
  readonly label = input.required<string>();
  readonly id = input<string>(mlvNextId('mlv-drawer-section'));

  readonly elementRef = inject(ElementRef);

  /** @private Scoped service tracking section registration and scroll-active state. */
  private readonly _sectionService = inject(MlvDrawerSectionsService);

  ngOnInit() {
    this._sectionService.register(this);
  }

  ngOnDestroy() {
    this._sectionService.unregister(this);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { MlvDrawerSectionsService } from '../drawer-sections.service';
import type { MlvPopupTriggerType } from '@malva-ui/core/popup';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvList, MlvListItem } from '@malva-ui/core/list';
import { LucideChevronDown } from '@lucide/angular';
import { MlvClick } from '@malva-ui/cdk/accessibility';

@Component({
  selector: 'mlv-drawer-sections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './drawer-sections.html',
  imports: [
    MlvPopupContent,
    MlvButton,
    MlvButtonIcon,
    MlvPopupTrigger,
    MlvPopup,
    MlvList,
    MlvListItem,
    LucideChevronDown,
    MlvClick,
  ],
})
export class MlvDrawerSections {
  /** @protected Service exposing the registered drawer sections and the currently scrolled section. */
  protected readonly sectionsService = inject(MlvDrawerSectionsService);

  /** @protected Two-way open state of the section-navigation popup. */
  protected readonly isOpen = signal(false);

  /**
   * @protected Gestures that open the section menu.
   *
   * `hover` alone made the menu unreachable by keyboard (WCAG 2.1.1, #223):
   * `MlvPopupTrigger.onClick()` gates on `hasTrigger('click')` and
   * `onFocus()` on `hasTrigger('focus')`, so for a hover-only trigger every
   * keyboard path was a no-op. The trigger is a real `<button>`, so `click`
   * is also its Enter/Space activation — adding it is what makes the menu
   * openable without a pointer. `focus` is deliberately *not* in the list: it
   * closes on `blur`, so it would shut the panel the moment focus moved
   * toward the rows.
   *
   * Held in a field rather than written as an array literal in the template
   * so the reference is stable across change detection.
   */
  protected readonly _triggerOn: MlvPopupTriggerType[] = ['hover', 'click'];

  /**
   * @protected Whether the navigator has anything to navigate between.
   *
   * A single registered section produced a "Meta ▾" menu whose only entry was
   * the section already on screen, so the control is suppressed below two.
   */
  protected readonly _hasMultipleSections = computed(
    () => this.sectionsService.normalizedSections().length > 1,
  );
  /** @private Host used to scope body lookup to this drawer instance. */
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  navigateToSection(section: ElementRef): void {
    const drawer = this._host.nativeElement.closest('.mlv-drawer');
    this.scrollIntoViewWithScrollableContainer(
      drawer?.querySelector('.mlv-drawer__body'),
      section.nativeElement,
      80,
    );
  }

  scrollIntoViewWithScrollableContainer(
    baseElement: Element | null | undefined,
    destinationElement: Element | null | undefined,
    topMargin?: number,
  ): void {
    if (baseElement && destinationElement) {
      const baseScrollTop = baseElement.scrollTop;
      const elementPosition =
        destinationElement.getBoundingClientRect().top -
        baseElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + baseScrollTop - (topMargin || 0);

      baseElement.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  }
}

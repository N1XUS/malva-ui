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

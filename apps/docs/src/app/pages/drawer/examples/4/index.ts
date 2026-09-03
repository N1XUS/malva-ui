import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox, MlvCheckboxGroup } from '@malva-ui/core/checkbox';
import {
  MlvDrawerBody,
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerFooter,
  MlvDrawerHeader,
} from '@malva-ui/core/drawer';
import { MlvForm } from '@malva-ui/core/form';
import { MlvSlider } from '@malva-ui/core/slider';
import { MlvSwitch } from '@malva-ui/core/switch';

interface CategoryFilter {
  id: string;
  label: string;
  checked: boolean;
}

const DEFAULT_PRICE: [number, number] = [0, 500];

/**
 * A persistent filter panel: a left drawer with free resize (no snap points)
 * clamped between `minSize` and `maxSize`, no backdrop, and a header that
 * carries the live filter count next to the close button.
 */
@Component({
  selector: 'docs-drawer-filter-panel-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MlvSpacer,
    MlvBadge,
    MlvButton,
    MlvCheckbox,
    MlvCheckboxGroup,
    MlvDrawerBody,
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerFooter,
    MlvDrawerHeader,
    MlvForm,
    MlvSlider,
    MlvSwitch,
  ],
  templateUrl: './index.html',
})
export default class DrawerFilterPanelExampleComponent {
  readonly showFilters = signal(false);

  readonly categories = signal<CategoryFilter[]>([
    { id: 'furniture', label: 'Furniture', checked: true },
    { id: 'lighting', label: 'Lighting', checked: false },
    { id: 'textiles', label: 'Textiles', checked: true },
    { id: 'storage', label: 'Storage', checked: false },
  ]);
  readonly priceRange = signal<[number, number]>([...DEFAULT_PRICE]);
  readonly inStockOnly = signal(false);

  /** Number of filters that differ from their defaults. */
  readonly activeCount = computed(() => {
    const [min, max] = this.priceRange();
    const priceTouched = min !== DEFAULT_PRICE[0] || max !== DEFAULT_PRICE[1];
    return (
      this.categories().filter((c) => c.checked).length +
      (priceTouched ? 1 : 0) +
      (this.inStockOnly() ? 1 : 0)
    );
  });

  /** The count committed by the last Apply — what the page would query with. */
  readonly appliedCount = signal(2);

  setCategory(id: string, checked: boolean): void {
    this.categories.update((all) =>
      all.map((c) => (c.id === id ? { ...c, checked } : c)),
    );
  }

  reset(): void {
    this.categories.update((all) => all.map((c) => ({ ...c, checked: false })));
    this.priceRange.set([...DEFAULT_PRICE]);
    this.inStockOnly.set(false);
  }

  apply(): void {
    this.appliedCount.set(this.activeCount());
    this.showFilters.set(false);
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import type { MlvDrawerPosition } from '@malva-ui/core/drawer';
import {
  MlvDrawerBody,
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerFooter,
  MlvDrawerHeader,
  MlvDrawerSection,
  MlvDrawerSections,
} from '@malva-ui/core/drawer';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvSwitch } from '@malva-ui/core/switch';

type SnapPreset = 'free' | 'thirds' | 'sheet';

const SNAP_PRESETS: Record<SnapPreset, number[]> = {
  free: [],
  thirds: [33, 66, 100],
  sheet: [40, 80, 100],
};

const SNAP_LABELS: Record<SnapPreset, string> = {
  free: 'Free resize',
  thirds: 'Thirds · 33 / 66 / 100',
  sheet: 'Sheet · 40 / 80 / 100',
};

const SIZE_LABELS: Record<string, string> = {
  '20rem': 'Narrow',
  '28rem': 'Default',
  '40rem': 'Wide',
};

const DEFAULT_SIZE = '28rem';
const DEFAULT_SNAP_PRESET: SnapPreset = 'sheet';

/**
 * One drawer, every orientation. The controls outside the panel drive
 * `position`, `size`, `resizable`, `snapPoints`, `defaultSnap` and
 * `hasBackdrop`; the panel's body reads the same signals back so the
 * configuration is visible from inside.
 */
@Component({
  selector: 'docs-drawer-playground-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvSpacer,
    MlvButton,
    MlvDrawerBody,
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerFooter,
    MlvDrawerHeader,
    MlvDrawerSection,
    MlvDrawerSections,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSelect,
    MlvSwitch,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DrawerPlaygroundExampleComponent {
  readonly opened = signal(false);

  readonly position = signal<MlvDrawerPosition>('right');
  readonly resizable = signal(false);
  readonly backdrop = signal(true);

  /** `mlv-select` models `T | null`; the raw item is the value, `toOption` labels it. */
  readonly sizeChoice = signal<string | null>(DEFAULT_SIZE);
  readonly snapChoice = signal<SnapPreset | null>(DEFAULT_SNAP_PRESET);

  readonly sizes = Object.keys(SIZE_LABELS);
  readonly snapPresets = Object.keys(SNAP_PRESETS) as SnapPreset[];

  readonly toSizeOption = (size: string): MlvSelectOption<string> => ({
    label: `${SIZE_LABELS[size]} · ${size}`,
    value: size,
  });

  readonly toSnapOption = (
    preset: SnapPreset,
  ): MlvSelectOption<SnapPreset> => ({
    label: SNAP_LABELS[preset],
    value: preset,
  });

  readonly size = computed(() => this.sizeChoice() ?? DEFAULT_SIZE);
  readonly snapPoints = computed(
    () => SNAP_PRESETS[this.snapChoice() ?? DEFAULT_SNAP_PRESET],
  );

  /** Open at the middle snap point, or at half the viewport when free. */
  readonly defaultSnap = computed(() => {
    const points = this.snapPoints();
    return points[Math.floor(points.length / 2)] ?? 50;
  });

  readonly axis = computed(() =>
    this.position() === 'left' || this.position() === 'right'
      ? 'width'
      : 'height',
  );

  readonly title = computed(() => `Drawer · ${this.position()}`);

  /** The template as a consumer would write it for the current settings. */
  readonly snippet = computed(() => {
    const attrs = [`position="${this.position()}"`];
    if (this.resizable()) {
      attrs.push('resizable');
      const points = this.snapPoints();
      if (points.length) attrs.push(`[snapPoints]="[${points.join(', ')}]"`);
      attrs.push(`[defaultSnap]="${this.defaultSnap()}"`);
    } else {
      attrs.push(`size="${this.size()}"`);
    }
    if (!this.backdrop()) attrs.push('[hasBackdrop]="false"');
    return `<mlv-drawer [(opened)]="opened"\n  ${attrs.join('\n  ')}\n>`;
  });
}

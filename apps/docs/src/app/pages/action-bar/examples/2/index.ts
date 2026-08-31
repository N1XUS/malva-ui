import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvActionBar, MlvActionBarSpacer } from '@malva-ui/core/action-bar';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCombobox } from '@malva-ui/core/combobox';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import { MlvDataTable } from '@malva-ui/core/data-table';
import { MlvSelect } from '@malva-ui/core/select';
import {
  LucideDownload,
  LucideArchive,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';

interface Asset {
  id: string;
  name: string;
  type: 'Image' | 'Video' | 'Document';
  size: string;
  updated: string;
}

const ASSETS: Asset[] = [
  {
    id: 'A-1041',
    name: 'brand-hero.png',
    type: 'Image',
    size: '1.8 MB',
    updated: '2026-03-24',
  },
  {
    id: 'A-1042',
    name: 'launch-teaser.mp4',
    type: 'Video',
    size: '24.6 MB',
    updated: '2026-03-22',
  },
  {
    id: 'A-1043',
    name: 'press-release.pdf',
    type: 'Document',
    size: '212 KB',
    updated: '2026-03-19',
  },
  {
    id: 'A-1044',
    name: 'lookbook-spring.pdf',
    type: 'Document',
    size: '4.1 MB',
    updated: '2026-03-17',
  },
  {
    id: 'A-1045',
    name: 'homepage-banner.png',
    type: 'Image',
    size: '960 KB',
    updated: '2026-03-15',
  },
  {
    id: 'A-1046',
    name: 'testimonial-reel.mp4',
    type: 'Video',
    size: '18.2 MB',
    updated: '2026-03-10',
  },
];

@Component({
  selector: 'docs-action-bar-selection-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MlvActionBar,
    MlvActionBarSpacer,
    MlvButton,
    MlvCombobox,
    MlvDataTable,
    MlvSelect,
    LucideDownload,
    LucideArchive,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ActionBarSelectionExampleComponent {
  readonly assets = ASSETS;
  readonly selected = signal<Set<Record<string, unknown>>>(new Set());
  readonly selectedCount = computed(() => this.selected().size);

  readonly columns: MlvDataTableColumn[] = [
    { key: 'id', title: 'ID', width: '110px' },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'type', title: 'Type', width: '130px' },
    { key: 'size', title: 'Size', width: '110px', align: 'right' },
    { key: 'updated', title: 'Updated', width: '140px', sortable: true },
  ];

  readonly folders = ['Marketing', 'Launches', 'Brand', 'Archive', 'Trash'];
  readonly targetFolder = signal<string | null>(null);

  readonly tags = [
    'spring-campaign',
    'homepage',
    'social',
    'press-kit',
    'lookbook',
    'hero',
    'retouched',
    'final',
  ];
  readonly appliedTag = signal<string | null>(null);

  clearSelection(): void {
    this.selected.set(new Set());
  }
}

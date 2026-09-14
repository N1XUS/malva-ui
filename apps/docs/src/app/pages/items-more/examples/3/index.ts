import { NgTemplateOutlet } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideArchive,
  LucideChevronDown,
  LucideCopy,
  LucideDownload,
  LucidePencil,
  LucideShare2,
  LucideTrash2,
} from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvItemsMore,
  MlvItemsMoreHiddenDef,
  MlvItemsMoreItem,
  MlvItemsMoreTrigger,
  MlvItemsMoreTriggerDef,
  MlvItemsMoreVisibleDef,
} from '@malva-ui/core/items-more';

interface DocumentAction {
  readonly id: string;
  readonly label: string;
}

@Component({
  selector: 'docs-items-more-custom-trigger-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTriggerDef,
    MlvItemsMoreTrigger,
    LucidePencil,
    LucideCopy,
    LucideShare2,
    LucideDownload,
    LucideArchive,
    LucideTrash2,
    LucideChevronDown,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ItemsMoreCustomTriggerExampleComponent {
  readonly actions: readonly DocumentAction[] = [
    { id: 'edit', label: 'Edit' },
    { id: 'duplicate', label: 'Duplicate' },
    { id: 'share', label: 'Share' },
    { id: 'export', label: 'Export' },
    { id: 'archive', label: 'Archive' },
    { id: 'delete', label: 'Delete' },
  ];
}

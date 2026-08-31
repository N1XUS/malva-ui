import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTree, MlvTreeNodeDef, type MlvTreeNode } from '@malva-ui/core/tree';
import {
  LucideFolder,
  LucideFolderOpen,
  LucideFile,
  LucideFileText,
  LucideImage,
} from '@lucide/angular';

interface FileMetadata {
  type: 'folder' | 'ts' | 'html' | 'scss' | 'png' | 'text';
  size?: string;
}

const STYLED_TREE: MlvTreeNode<FileMetadata>[] = [
  {
    id: 'src',
    label: 'src',
    data: { type: 'folder' },
    expanded: true,
    children: [
      {
        id: 'components',
        label: 'components',
        data: { type: 'folder' },
        children: [
          {
            id: 'btn-ts',
            label: 'button.ts',
            data: { type: 'ts', size: '3.2 KB' },
          },
          {
            id: 'btn-html',
            label: 'button.html',
            data: { type: 'html', size: '1.1 KB' },
          },
          {
            id: 'btn-scss',
            label: 'button.scss',
            data: { type: 'scss', size: '4.8 KB' },
          },
        ],
      },
      { id: 'logo', label: 'logo.png', data: { type: 'png', size: '12 KB' } },
      {
        id: 'readme',
        label: 'README.md',
        data: { type: 'text', size: '2.1 KB' },
      },
    ],
  },
];

@Component({
  selector: 'docs-tree-custom-template-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvTree,
    MlvTreeNodeDef,
    LucideFolder,
    LucideFolderOpen,
    LucideFile,
    LucideFileText,
    LucideImage,
  ],
  template: `
    <mlv-tree [nodes]="nodes" style="max-width: 22rem;">
      <ng-template mlvTreeNodeDef let-flatNode>
        <span
          style="display: flex; align-items: center; gap: 0.375rem; flex: 1; min-width: 0;"
        >
          @if ($any(flatNode.node.data).type === 'folder') {
            @if (flatNode.isExpanded) {
              <svg
                lucideFolderOpen
                [size]="15"
                style="color: var(--mlv-text-warning); flex-shrink: 0;"
              />
            } @else {
              <svg
                lucideFolder
                [size]="15"
                style="color: var(--mlv-text-warning); flex-shrink: 0;"
              />
            }
          } @else if ($any(flatNode.node.data).type === 'png') {
            <svg
              lucideImage
              [size]="15"
              style="color: var(--mlv-text-positive); flex-shrink: 0;"
            />
          } @else if ($any(flatNode.node.data).type === 'text') {
            <svg
              lucideFileText
              [size]="15"
              style="color: var(--mlv-text-secondary); flex-shrink: 0;"
            />
          } @else {
            <svg
              lucideFile
              [size]="15"
              [style.color]="
                $any(flatNode.node.data).type === 'ts'
                  ? 'var(--mlv-text-info)'
                  : $any(flatNode.node.data).type === 'html'
                    ? 'var(--mlv-text-negative)'
                    : 'var(--mlv-text-positive)'
              "
              style="flex-shrink: 0;"
            />
          }
          <span
            style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.875rem;"
          >
            {{ flatNode.node.label }}
          </span>
          @if ($any(flatNode.node.data).size) {
            <span
              style="font-size: 0.75rem; color: var(--mlv-text-tertiary); margin-left: auto; padding-left: 0.5rem;"
            >
              {{ $any(flatNode.node.data).size }}
            </span>
          }
        </span>
      </ng-template>
    </mlv-tree>
  `,
})
export default class TreeCustomTemplateExampleComponent {
  readonly nodes = STYLED_TREE;
}

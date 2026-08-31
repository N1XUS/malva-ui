import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTree, type MlvTreeNode } from '@malva-ui/core/tree';

interface FileItem {
  type: 'folder' | 'file';
}

const FILE_TREE: MlvTreeNode<FileItem>[] = [
  {
    id: 'src',
    label: 'src',
    data: { type: 'folder' },
    expanded: true,
    children: [
      {
        id: 'app',
        label: 'app',
        data: { type: 'folder' },
        children: [
          { id: 'app-ts', label: 'app.ts', data: { type: 'file' } },
          { id: 'app-html', label: 'app.html', data: { type: 'file' } },
          { id: 'app-scss', label: 'app.scss', data: { type: 'file' } },
        ],
      },
      {
        id: 'assets',
        label: 'assets',
        data: { type: 'folder' },
        children: [{ id: 'logo', label: 'logo.svg', data: { type: 'file' } }],
      },
      { id: 'main-ts', label: 'main.ts', data: { type: 'file' } },
      { id: 'styles-scss', label: 'styles.scss', data: { type: 'file' } },
    ],
  },
  {
    id: 'public',
    label: 'public',
    data: { type: 'folder' },
    children: [{ id: 'favicon', label: 'favicon.ico', data: { type: 'file' } }],
  },
  { id: 'package-json', label: 'package.json', data: { type: 'file' } },
  { id: 'tsconfig', label: 'tsconfig.json', data: { type: 'file' } },
];

@Component({
  selector: 'docs-tree-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTree],
  template: ` <mlv-tree [nodes]="nodes" style="max-width: 20rem;" /> `,
})
export default class TreeBasicExampleComponent {
  readonly nodes = FILE_TREE;
}

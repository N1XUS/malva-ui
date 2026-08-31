import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDataTableColumn } from '@malva-ui/core/data-table';
import {
  MlvDataTable,
  MlvDataTableCell,
  MlvDataTableNoData,
} from '@malva-ui/core/data-table';
import { LucideFolder, LucideFile, LucideSearchX } from '@lucide/angular';

type FileNode = Record<string, unknown> & {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  _mlvChildren?: FileNode[];
};

const FILE_TREE: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    size: '—',
    modified: '2026-03-20',
    _mlvChildren: [
      {
        name: 'app',
        type: 'folder',
        size: '—',
        modified: '2026-03-20',
        _mlvChildren: [
          {
            name: 'app.component.ts',
            type: 'file',
            size: '4.2 KB',
            modified: '2026-03-20',
            _mlvChildren: [],
          },
          {
            name: 'app.routes.ts',
            type: 'file',
            size: '1.8 KB',
            modified: '2026-03-19',
            _mlvChildren: [],
          },
        ],
      },
      {
        name: 'assets',
        type: 'folder',
        size: '—',
        modified: '2026-03-15',
        _mlvChildren: [
          {
            name: 'logo.svg',
            type: 'file',
            size: '12 KB',
            modified: '2026-03-15',
            _mlvChildren: [],
          },
        ],
      },
      {
        name: 'main.ts',
        type: 'file',
        size: '0.5 KB',
        modified: '2026-03-10',
        _mlvChildren: [],
      },
      {
        name: 'styles.scss',
        type: 'file',
        size: '2.1 KB',
        modified: '2026-03-18',
        _mlvChildren: [],
      },
    ],
  },
  {
    name: 'libs',
    type: 'folder',
    size: '—',
    modified: '2026-03-25',
    _mlvChildren: [
      {
        name: 'button',
        type: 'folder',
        size: '—',
        modified: '2026-03-22',
        _mlvChildren: [],
      },
      {
        name: 'data-table',
        type: 'folder',
        size: '—',
        modified: '2026-03-25',
        _mlvChildren: [],
      },
      {
        name: 'pagination',
        type: 'folder',
        size: '—',
        modified: '2026-03-26',
        _mlvChildren: [],
      },
    ],
  },
  {
    name: 'angular.json',
    type: 'file',
    size: '18 KB',
    modified: '2026-03-01',
    _mlvChildren: [],
  },
  {
    name: 'package.json',
    type: 'file',
    size: '3.5 KB',
    modified: '2026-03-20',
    _mlvChildren: [],
  },
  {
    name: 'tsconfig.json',
    type: 'file',
    size: '1.2 KB',
    modified: '2026-03-01',
    _mlvChildren: [],
  },
];

@Component({
  selector: 'docs-data-table-tree-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDataTable,
    MlvDataTableCell,
    MlvDataTableNoData,
    LucideFolder,
    LucideFile,
    LucideSearchX,
  ],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class DataTableTreeExampleComponent {
  readonly fileTree = FILE_TREE;

  readonly columns: MlvDataTableColumn[] = [
    { key: 'name', title: 'Name', sortable: true, filterable: true },
    { key: 'type', title: 'Type', width: '90px' },
    { key: 'size', title: 'Size', width: '100px', align: 'right' },
    { key: 'modified', title: 'Last Modified', width: '140px', sortable: true },
  ];
}

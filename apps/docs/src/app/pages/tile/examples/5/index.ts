import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  MlvTiles,
  type MlvTileNodeWithChildren,
  type MlvTilesAccepts,
} from '@malva-ui/core/tile';

import { DocsTileTreeNode, type PageBuilderProps } from './tile-tree-node';

const PAGE: MlvTileNodeWithChildren<PageBuilderProps> = {
  id: 'page',
  acceptsChildren: true,
  props: {
    title: 'Homepage',
    summary: 'Public landing page structure',
    enabled: true,
    kind: 'row',
  },
  children: [
    {
      id: 'header-row',
      acceptsChildren: true,
      props: {
        title: 'Header row',
        summary: 'Campaign headline and supporting introduction',
        enabled: true,
        kind: 'row',
      },
      children: [
        {
          id: 'hero',
          acceptsChildren: false,
          props: {
            title: 'Launch campaign',
            summary: 'Primary headline and featured message',
            enabled: true,
            kind: 'block',
            blockType: 'hero',
          },
        },
        {
          id: 'intro-text',
          acceptsChildren: false,
          props: {
            title: 'Introduction',
            summary: 'Short supporting copy for new visitors',
            enabled: true,
            kind: 'block',
            blockType: 'text',
          },
        },
      ],
    },
    {
      id: 'content-stack',
      acceptsChildren: true,
      props: {
        title: 'Content stack',
        summary: 'Flexible rows for the page body',
        enabled: true,
        kind: 'row',
      },
      children: [
        {
          id: 'feature-row',
          acceptsChildren: true,
          props: {
            title: 'Feature row',
            summary: 'Nested media and conversion content',
            enabled: true,
            kind: 'row',
          },
          children: [
            {
              id: 'media-row',
              acceptsChildren: true,
              props: {
                title: 'Media row',
                summary: 'Product visual with its primary action',
                enabled: true,
                kind: 'row',
              },
              children: [
                {
                  id: 'image-block',
                  acceptsChildren: false,
                  props: {
                    title: 'Product image',
                    summary: 'Editorial image for the featured release',
                    enabled: true,
                    kind: 'block',
                    blockType: 'image',
                  },
                },
                {
                  id: 'cta-block',
                  acceptsChildren: false,
                  props: {
                    title: 'Shop the release',
                    summary: 'Primary call to action for the campaign',
                    enabled: true,
                    kind: 'block',
                    blockType: 'cta',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'empty-row',
          acceptsChildren: true,
          props: {
            title: 'Open row',
            summary: 'Available for another row or content block',
            enabled: false,
            kind: 'row',
          },
          children: [],
        },
      ],
    },
  ],
};

@Component({
  selector: 'docs-tile-site-builder-example',
  imports: [DocsTileTreeNode, MlvTiles],
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-tile-site-builder-example' },
})
export default class TileSiteBuilderExampleComponent {
  readonly page = signal<MlvTileNodeWithChildren<PageBuilderProps>>(PAGE);

  readonly canAccept: MlvTilesAccepts<PageBuilderProps> = (
    draggedTile,
    _targetTile,
    innerTiles,
  ) =>
    !draggedTile.acceptsChildren ||
    !innerTiles.some((innerTile) => !innerTile.acceptsChildren);
}

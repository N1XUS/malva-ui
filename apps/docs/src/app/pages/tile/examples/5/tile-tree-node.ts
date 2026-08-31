import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import {
  LucideDynamicIcon,
  LucideBox,
  LucideImage,
  LucideMegaphone,
  LucideMousePointerClick,
  LucidePencil,
  LucideRows3,
  LucideText,
  LucideTrash2,
} from '@lucide/angular';
import { MlvDensityDirective } from '@malva-ui/cdk/density';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvTile,
  MlvTileActions,
  MlvTileHeader,
  MlvTileTrailingActions,
  MlvTiles,
  type MlvTileTreeNode,
} from '@malva-ui/core/tile';

export type PageBlockType = 'hero' | 'text' | 'image' | 'cta';

export type PageNodeKind = 'row' | 'block';

export interface PageBuilderProps {
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly kind: PageNodeKind;
  readonly blockType?: PageBlockType;
}

@Component({
  selector: 'docs-tile-tree-node',
  imports: [
    LucideDynamicIcon,
    LucidePencil,
    LucideTrash2,
    MlvButton,
    MlvButtonIcon,
    MlvDensityDirective,
    MlvInput,
    MlvSwitch,
    MlvTile,
    MlvTileActions,
    MlvTileHeader,
    MlvTileTrailingActions,
    MlvTiles,
  ],
  templateUrl: './tile-tree-node.html',
  styleUrl: './tile-tree-node.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-tile-tree-node' },
})
export class DocsTileTreeNode {
  /** Immutable tree node presented by this recursive consumer component. */
  readonly tile = input.required<MlvTileTreeNode<PageBuilderProps>>();

  /** Whether this node currently presents its inline title editor. */
  protected readonly editing = signal(false);

  /** Product-specific metadata icons rendered through the Lucide system. */
  protected readonly metadataIcons = {
    row: LucideRows3,
    block: LucideBox,
    hero: LucideMegaphone,
    text: LucideText,
    image: LucideImage,
    cta: LucideMousePointerClick,
  } as const;

  /** Saves a non-empty changed title through the public compound Tile API. */
  protected saveTitle(
    tile: MlvTile<PageBuilderProps>,
    props: PageBuilderProps,
    value: string,
  ): void {
    this.editing.set(false);
    const title = value.trim();
    if (!title || title === props.title) return;
    tile.setProps({ ...props, title });
  }

  /** Closes the inline editor without changing the public tree model. */
  protected cancelTitle(): void {
    this.editing.set(false);
  }
}

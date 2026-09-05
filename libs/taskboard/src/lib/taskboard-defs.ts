import { Directive, inject, input, TemplateRef } from '@angular/core';
import type {
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardDropTarget,
  MlvTaskboardLocation,
  MlvTaskboardSwimlane,
  MlvTaskboardWipState,
} from './taskboard.types';

/** Context provided to a board header template. */
export interface MlvTaskboardHeaderDefContext {
  readonly $implicit: readonly MlvTaskboardColumn[];
  readonly columns: readonly MlvTaskboardColumn[];
  readonly columnGroups: readonly MlvTaskboardColumnGroup[];
  readonly swimlanes: readonly MlvTaskboardSwimlane[];
}

/** Context provided to a column-group template. */
export interface MlvTaskboardColumnGroupDefContext {
  readonly $implicit: MlvTaskboardColumnGroup;
  readonly group: MlvTaskboardColumnGroup;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a column-header template. */
export interface MlvTaskboardColumnHeaderDefContext {
  readonly $implicit: MlvTaskboardColumn;
  readonly column: MlvTaskboardColumn;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to the content area of a column or swimlane cell. */
export interface MlvTaskboardColumnContentDefContext<TItem = unknown> {
  readonly $implicit: readonly TItem[];
  readonly items: readonly TItem[];
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a swimlane template. */
export interface MlvTaskboardSwimlaneDefContext {
  readonly $implicit: MlvTaskboardSwimlane;
  readonly swimlane: MlvTaskboardSwimlane;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a card template. */
export interface MlvTaskboardItemDefContext<TItem = unknown> {
  readonly $implicit: TItem;
  readonly card: TItem;
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly location: MlvTaskboardLocation;
  readonly selected: boolean;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a custom add-card template. */
export interface MlvTaskboardCardAddDefContext {
  readonly $implicit: () => void;
  readonly requestAdd: () => void;
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a custom drag-preview template. */
export interface MlvTaskboardDragPreviewDefContext<TItem = unknown> {
  readonly $implicit: TItem;
  readonly card: TItem;
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly location: MlvTaskboardLocation;
  readonly selected: boolean;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided when a column or swimlane has no cards to render. */
export interface MlvTaskboardEmptyStateDefContext {
  readonly $implicit: MlvTaskboardColumn;
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly wip: MlvTaskboardWipState;
}

/** Context provided to a drop-indicator template. */
export interface MlvTaskboardDropIndicatorDefContext<TItem = unknown> {
  readonly $implicit: boolean;
  readonly valid: boolean;
  /**
   * The previewed slot. `target.items` holds the cell's cards **with the
   * dragged card removed**, which is the list `target.index` counts: the
   * indicator sits before `items[index]`, and `index === items.length` is the
   * slot after the last card.
   */
  readonly target: MlvTaskboardDropTarget<TItem>;
}

/** Marks a custom template for the board header. */
@Directive({ selector: '[mlvTaskboardHeaderDef]' })
export class MlvTaskboardHeaderDef {
  /** The template reference for this custom board-header slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardHeaderDefContext>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardHeaderDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardHeaderDefContext {
    return true;
  }
}

/** Marks a custom template for a column group. */
@Directive({ selector: '[mlvTaskboardColumnGroupDef]' })
export class MlvTaskboardColumnGroupDef {
  /** The template reference for this custom column-group slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardColumnGroupDefContext>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardColumnGroupDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardColumnGroupDefContext {
    return true;
  }
}

/** Marks a custom template for a column header. */
@Directive({ selector: '[mlvTaskboardColumnHeaderDef]' })
export class MlvTaskboardColumnHeaderDef {
  /** The template reference for this custom column-header slot. */
  readonly templateRef = inject(
    TemplateRef<MlvTaskboardColumnHeaderDefContext>,
  );

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardColumnHeaderDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardColumnHeaderDefContext {
    return true;
  }
}

/** Marks a custom template for a column or swimlane cell's content. */
@Directive({ selector: '[mlvTaskboardColumnContentDef]' })
export class MlvTaskboardColumnContentDef<TItem = unknown> {
  /**
   * Carries the item type into the template context for strict template inference.
   * The board does not consume this value as runtime data.
   */
  readonly from = input<TItem | undefined>(undefined, {
    alias: 'mlvTaskboardColumnContentDefFrom',
  });

  /** The template reference for this custom cell-content slot. */
  readonly templateRef = inject(
    TemplateRef<MlvTaskboardColumnContentDefContext<TItem>>,
  );

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard<TItem>(
    _dir: MlvTaskboardColumnContentDef<TItem>,
    _ctx: unknown,
  ): _ctx is MlvTaskboardColumnContentDefContext<TItem> {
    return true;
  }
}

/** Marks a custom template for a swimlane. */
@Directive({ selector: '[mlvTaskboardSwimlaneDef]' })
export class MlvTaskboardSwimlaneDef {
  /** The template reference for this custom swimlane slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardSwimlaneDefContext>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardSwimlaneDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardSwimlaneDefContext {
    return true;
  }
}

/** Marks a custom template for a taskboard card. */
@Directive({ selector: '[mlvTaskboardItemDef]' })
export class MlvTaskboardItemDef<TItem = unknown> {
  /**
   * Carries the card type into the template context for strict template inference.
   * The board does not consume this value as runtime data.
   */
  readonly from = input<TItem | undefined>(undefined, {
    alias: 'mlvTaskboardItemDefFrom',
  });

  /** The template reference for this custom taskboard-card slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardItemDefContext<TItem>>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard<TItem>(
    _dir: MlvTaskboardItemDef<TItem>,
    _ctx: unknown,
  ): _ctx is MlvTaskboardItemDefContext<TItem> {
    return true;
  }
}

/** Marks a custom template for the add-card affordance. */
@Directive({ selector: '[mlvTaskboardCardAddDef]' })
export class MlvTaskboardCardAddDef {
  /** The template reference for this custom add-card slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardCardAddDefContext>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardCardAddDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardCardAddDefContext {
    return true;
  }
}

/** Marks a custom template for a drag preview. */
@Directive({ selector: '[mlvTaskboardDragPreviewDef]' })
export class MlvTaskboardDragPreviewDef<TItem = unknown> {
  /**
   * Carries the card type into the template context for strict template inference.
   * The board does not consume this value as runtime data.
   */
  readonly from = input<TItem | undefined>(undefined, {
    alias: 'mlvTaskboardDragPreviewDefFrom',
  });

  /** The template reference for this custom drag-preview slot. */
  readonly templateRef = inject(
    TemplateRef<MlvTaskboardDragPreviewDefContext<TItem>>,
  );

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard<TItem>(
    _dir: MlvTaskboardDragPreviewDef<TItem>,
    _ctx: unknown,
  ): _ctx is MlvTaskboardDragPreviewDefContext<TItem> {
    return true;
  }
}

/** Marks a custom template for an empty cell state. */
@Directive({ selector: '[mlvTaskboardEmptyStateDef]' })
export class MlvTaskboardEmptyStateDef {
  /** The template reference for this custom empty-state slot. */
  readonly templateRef = inject(TemplateRef<MlvTaskboardEmptyStateDefContext>);

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard(
    _dir: MlvTaskboardEmptyStateDef,
    _ctx: unknown,
  ): _ctx is MlvTaskboardEmptyStateDefContext {
    return true;
  }
}

/** Marks a custom template for a cell drop indicator. */
@Directive({ selector: '[mlvTaskboardDropIndicatorDef]' })
export class MlvTaskboardDropIndicatorDef<TItem = unknown> {
  /**
   * Carries the item type into the template context for strict template inference.
   * The board does not consume this value as runtime data.
   */
  readonly from = input<TItem | undefined>(undefined, {
    alias: 'mlvTaskboardDropIndicatorDefFrom',
  });

  /** The template reference for this custom drop-indicator slot. */
  readonly templateRef = inject(
    TemplateRef<MlvTaskboardDropIndicatorDefContext<TItem>>,
  );

  /** Narrows the template context for strict template type checking. */
  static ngTemplateContextGuard<TItem>(
    _dir: MlvTaskboardDropIndicatorDef<TItem>,
    _ctx: unknown,
  ): _ctx is MlvTaskboardDropIndicatorDefContext<TItem> {
    return true;
  }
}

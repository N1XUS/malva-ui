import type { LucideIconData, LucideIconInput } from '@lucide/angular';
import {
  LucideCodeXml,
  LucideHeading1,
  LucideHeading2,
  LucideHeading3,
  LucideImage,
  LucideList,
  LucideListOrdered,
  LucideListTodo,
  LucideMinus,
  LucidePilcrow,
  LucideSparkles,
  LucideTable2,
  LucideTextQuote,
} from '@lucide/angular';
import type { MlvEditorI18n } from '@malva-ui/i18n';
import { MLV_EDITOR_CLEAN_MODE_FALLBACKS } from '../editor-clean-mode-fallbacks';
import type {
  MlvEditorInsertContext,
  MlvEditorInsertItem,
} from './editor-insert.types';

/** @internal Built-in groups, in render order. */
const BUILT_IN_GROUPS = ['ai', 'style', 'lists', 'insert'] as const;

/**
 * @internal Icons of the default items, resolved here rather than through a
 * component-level `provideLucideIcons`: that provider shadows the
 * application's registrations instead of merging with them (§ 17 item 12,
 * `lucide-angular.mjs` `provideLucideIcons` / `LUCIDE_ICONS`), which would
 * break every consumer icon name. Any other name is looked up in the
 * application's registry here, not by `LucideDynamicIcon`, which throws for
 * an unknown name and would take the whole menu down.
 */
const DEFAULT_ITEM_ICONS: Readonly<Record<string, LucideIconInput>> = {
  sparkles: LucideSparkles,
  pilcrow: LucidePilcrow,
  'heading-1': LucideHeading1,
  'heading-2': LucideHeading2,
  'heading-3': LucideHeading3,
  'text-quote': LucideTextQuote,
  'code-xml': LucideCodeXml,
  list: LucideList,
  'list-ordered': LucideListOrdered,
  'list-todo': LucideListTodo,
  'table-2': LucideTable2,
  minus: LucideMinus,
  image: LucideImage,
};

/** @internal One rendered item. */
export interface MlvEditorInsertMenuEntry {
  readonly item: MlvEditorInsertItem;
  readonly enabled: boolean;
  /** `null` with no `item.icon`, or for a name nothing registered. */
  readonly icon: LucideIconInput | null;
}

/** @internal One rendered group; `label` is `null` for a consumer group. */
export interface MlvEditorInsertMenuGroup {
  readonly id: string;
  readonly label: string | null;
  readonly entries: readonly MlvEditorInsertMenuEntry[];
}

/**
 * @internal Groups the available items: the built-in groups first, in fixed
 * order with localized labels, then consumer groups in first-seen order with
 * no label. Empty groups are dropped.
 *
 * @param registry The application's Lucide registry (`LUCIDE_ICONS`) the
 * icons render against. An icon name neither a default item nor the registry
 * knows yields an entry with no icon (see {@link mlvEditorMissingInsertIcons}).
 */
export function mlvEditorInsertMenuGroups(
  items: readonly MlvEditorInsertItem[],
  context: MlvEditorInsertContext,
  copy: MlvEditorI18n | undefined,
  registry: Readonly<Record<string, LucideIconData>> = {},
): MlvEditorInsertMenuGroup[] {
  const order: string[] = [...BUILT_IN_GROUPS];
  for (const item of items) {
    if (!order.includes(item.group)) order.push(item.group);
  }
  return order
    .map((id) => ({
      id,
      label: groupLabel(id, copy),
      entries: items
        .filter(
          (item) => item.group === id && (item.available?.(context) ?? true),
        )
        .map((item) => ({
          item,
          enabled: item.enabled?.(context) ?? true,
          icon: itemIcon(item.icon, registry),
        })),
    }))
    .filter((group) => group.entries.length > 0);
}

/** @internal Icon names in `groups` that resolved to no icon, deduplicated. */
export function mlvEditorMissingInsertIcons(
  groups: readonly MlvEditorInsertMenuGroup[],
): string[] {
  const names = new Set<string>();
  for (const { entries } of groups) {
    for (const { item, icon } of entries) {
      if (item.icon && !icon) names.add(item.icon);
    }
  }
  return [...names];
}

/** @internal Own-key lookup, so `constructor` never resolves to `Object.prototype`. */
const own = <T>(record: Readonly<Record<string, T>>, key: string): T | null =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : null;

/**
 * @internal The icon input for `name`: a default item's class, else the
 * application's registered icon data, else `null` — `LucideDynamicIcon`
 * would throw for an unknown name at render time.
 */
function itemIcon(
  name: string | undefined,
  registry: Readonly<Record<string, LucideIconData>>,
): LucideIconInput | null {
  if (!name) return null;
  return own(DEFAULT_ITEM_ICONS, name) ?? own(registry, name);
}

/** @internal Localized label of a built-in group, `null` for any other. */
function groupLabel(
  id: string,
  copy: MlvEditorI18n | undefined,
): string | null {
  switch (id) {
    case 'ai':
      return (
        copy?.insertGroupAi ?? MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertGroupAi
      );
    case 'style':
      return (
        copy?.insertGroupStyle ??
        MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertGroupStyle
      );
    case 'lists':
      return (
        copy?.insertGroupLists ??
        MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertGroupLists
      );
    case 'insert':
      return (
        copy?.insertGroupInsert ??
        MLV_EDITOR_CLEAN_MODE_FALLBACKS.insertGroupInsert
      );
    default:
      return null;
  }
}

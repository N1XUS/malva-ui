import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import {
  LucideArchive,
  LucideCopy,
  LucideDownload,
  LucideEllipsisVertical,
  LucideEye,
  LucideHeadphones,
  LucideHistory,
  LucideMessageSquare,
  LucidePenLine,
  LucideShare2,
  LucideSparkles,
  LucideType,
} from '@lucide/angular';
import { MlvActionBar } from '@malva-ui/core/action-bar';
import { MlvAvatar } from '@malva-ui/core/avatar';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvBreadcrumb } from '@malva-ui/core/breadcrumb';
import type { MlvBreadcrumbEntry } from '@malva-ui/core/breadcrumb';
import {
  MlvButton,
  MlvButtonGroup,
  MlvButtonToggle,
} from '@malva-ui/core/button';
import {
  MlvCard,
  MlvCardHeader,
  MlvCardHeaderDef,
  MlvCardSubheader,
  MlvCardSubheaderDef,
} from '@malva-ui/core/card';
import { MlvChip } from '@malva-ui/core/chip';
import { MlvFormControlAppend } from '@malva-ui/core/form-utils';
import { MlvDayPicker } from '@malva-ui/core/day-picker';
import { MlvDivider } from '@malva-ui/core/divider';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';
import { MlvInput } from '@malva-ui/core/input';
import { MlvListItem, MlvListItemPrefix } from '@malva-ui/core/list';
import { MlvMenu, MlvMenuItem, MlvMenuTrigger } from '@malva-ui/core/menu';
import {
  MlvPage,
  MlvPageBreadcrumb,
  MlvPageDock,
  MlvPageDockCenter,
  MlvPageHeader,
  MlvPageHeaderActions,
  MlvPageHeaderIcon,
  MlvPageHeaderMeta,
  MlvPageHeaderStatus,
  MlvPageHeaderTabs,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
} from '@malva-ui/core/page';
import {
  MlvPopup,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvSwitch } from '@malva-ui/core/switch';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvTextarea } from '@malva-ui/core/textarea';
import {
  MlvTimeline,
  MlvTimelineItem,
  MlvTimelineItemMeta,
} from '@malva-ui/core/timeline';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import { MlvTooltip } from '@malva-ui/core/tooltip';

/** Editable draft fields of the demo product record. */
interface ProductDraft {
  name: string;
  availability: string;
  price: string;
  unitCost: string;
  leadTime: string;
  featured: boolean;
  description: string;
  tags: MlvSelectOption<string>[];
}

/** One host-computed pending change shown in the Changes tab. */
interface PendingChange {
  field: string;
  from: string;
  to: string;
}

/** One host-owned inline suggestion attached to a field. */
interface FieldSuggestion {
  field: keyof ProductDraft;
  summary: string;
  apply: (draft: ProductDraft) => ProductDraft;
}

const LIVE_VERSION: ProductDraft = {
  name: 'Wireless Headphones Pro',
  availability: 'In Stock',
  price: '349',
  unitCost: '121.40',
  leadTime: '4',
  featured: false,
  description:
    'Over-ear headphones with adaptive noise cancellation and 40-hour battery life.',
  tags: [
    { label: 'audio', value: 'audio' },
    { label: 'flagship', value: 'flagship' },
  ],
};

const DRAFT_VERSION: ProductDraft = {
  name: 'Wireless Headphones Pro (Gen 2)',
  availability: 'Low Stock',
  price: '329',
  unitCost: '121.40',
  leadTime: '6',
  featured: true,
  description:
    'Reference-grade over-ear headphones with adaptive noise cancellation, spatial audio and 50-hour battery life.',
  tags: [
    { label: 'audio', value: 'audio' },
    { label: 'flagship', value: 'flagship' },
    { label: 'anc', value: 'anc' },
    { label: 'spatial', value: 'spatial' },
  ],
};

/** Human-readable labels for the diff rows. */
const FIELD_LABELS: Record<keyof ProductDraft, string> = {
  name: 'Product name',
  availability: 'Availability',
  price: 'Price',
  unitCost: 'Unit cost',
  leadTime: 'Lead time',
  featured: 'Featured in storefront',
  description: 'Description',
  tags: 'Tags',
};

@Component({
  selector: 'docs-page-record-editor-example',
  templateUrl: './index.html',
  styleUrl: './index.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    LucideArchive,
    LucideCopy,
    LucideDownload,
    LucideEllipsisVertical,
    LucideEye,
    LucideHeadphones,
    LucideHistory,
    LucideMessageSquare,
    LucidePenLine,
    LucideShare2,
    LucideSparkles,
    LucideType,
    MlvActionBar,
    MlvAvatar,
    MlvBadge,
    MlvBreadcrumb,
    MlvButton,
    MlvButtonGroup,
    MlvButtonToggle,
    MlvCard,
    MlvCardHeader,
    MlvCardHeaderDef,
    MlvCardSubheader,
    MlvCardSubheaderDef,
    MlvChip,
    MlvDayPicker,
    MlvDivider,
    MlvFormControlAppend,
    MlvInput,
    MlvListItem,
    MlvListItemPrefix,
    MlvMenu,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvPage,
    MlvPageBreadcrumb,
    MlvPageDock,
    MlvPageDockCenter,
    MlvPageHeader,
    MlvPageHeaderActions,
    MlvPageHeaderIcon,
    MlvPageHeaderMeta,
    MlvPageHeaderStatus,
    MlvPageHeaderTabs,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageTitle,
    MlvPopup,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvSelect,
    MlvSegmented,
    MlvSegmentedItem,
    MlvSwitch,
    MlvTextarea,
    MlvTimeline,
    MlvTimelineItem,
    MlvTimelineItemMeta,
    MlvTokenizer,
    MlvTooltip,
  ],
})
export default class PageRecordEditorExampleComponent {
  /** Which version the reader is inspecting; `live` renders read-only. */
  readonly view = signal<'draft' | 'live'>('draft');

  /** Narrows the Draft/Live segmented value back into the view union. */
  setView(value: unknown): void {
    this.view.set(value === 'live' ? 'live' : 'draft');
  }

  /** Active header section (segmented control); panels are switched in the page body. */
  readonly activeTab = signal('details');

  /** Editing mode selected in the dock's center tool cluster. */
  readonly editMode = signal<'edit' | 'suggest' | 'comment'>('edit');

  /** Optional delayed-publish date chosen in the Schedule popup. */
  readonly scheduledFor = signal<Date | null>(null);

  /** Currently published (live) values — the diff baseline. */
  readonly live = signal<ProductDraft>(LIVE_VERSION);

  /** Last explicitly saved draft; drives the Unsaved indicator. */
  readonly savedDraft = signal<ProductDraft>(DRAFT_VERSION);

  /** Editable draft fields. */
  readonly name = signal(DRAFT_VERSION.name);
  readonly availability = signal(DRAFT_VERSION.availability);
  readonly price = signal(DRAFT_VERSION.price);
  readonly unitCost = signal(DRAFT_VERSION.unitCost);
  readonly leadTime = signal(DRAFT_VERSION.leadTime);
  readonly featured = signal(DRAFT_VERSION.featured);
  readonly description = signal(DRAFT_VERSION.description);
  readonly tags = signal<MlvSelectOption<string>[]>(DRAFT_VERSION.tags);

  readonly availabilityOptions = ['In Stock', 'Low Stock', 'Out of Stock'];

  readonly breadcrumbs: MlvBreadcrumbEntry[] = [
    { label: 'Catalog', href: '#catalog' },
    { label: 'Audio Equipment', href: '#audio' },
    { label: 'Details' },
  ];

  /** Open (not yet applied) field suggestions, host-owned. */
  readonly suggestions = signal<FieldSuggestion[]>([
    {
      field: 'availability',
      summary: 'Set availability to Out of Stock — 0 units left in EU-1',
      apply: (draft) => ({ ...draft, availability: 'Out of Stock' }),
    },
    {
      field: 'price',
      summary: 'Round price to 325 to match the Gen 2 launch campaign',
      apply: (draft) => ({ ...draft, price: '325' }),
    },
    {
      field: 'tags',
      summary: 'Add the launch-2026 campaign tag',
      apply: (draft) => ({
        ...draft,
        tags: [...draft.tags, { label: 'launch-2026', value: 'launch-2026' }],
      }),
    },
  ]);

  /** Version history rendered in the History tab, newest first. */
  readonly versions = signal(
    [
      {
        title: 'Draft saved',
        timestamp: '4 hours ago',
        tone: 'info' as const,
        author: 'ME',
        note: 'Renamed to Gen 2 and refreshed the description.',
      },
      {
        title: 'v1.4 published',
        timestamp: 'Yesterday, 16:02',
        tone: 'success' as const,
        author: 'DS',
        note: 'Price drop to 349 USD for the summer sale.',
      },
      {
        title: 'v1.3 published',
        timestamp: 'Jul 21, 09:40',
        tone: 'success' as const,
        author: 'ME',
        note: 'Initial storefront release.',
      },
    ].map((version, index) => ({ ...version, id: index })),
  );

  /** Current draft assembled from the editable field signals. */
  readonly draft = computed<ProductDraft>(() => ({
    name: this.name(),
    availability: this.availability(),
    price: this.price(),
    unitCost: this.unitCost(),
    leadTime: this.leadTime(),
    featured: this.featured(),
    description: this.description(),
    tags: this.tags(),
  }));

  /** Pending changes: draft fields that differ from the live version. */
  readonly changes = computed<PendingChange[]>(() => {
    const live = this.live();
    const draft = this.draft();
    return (Object.keys(FIELD_LABELS) as (keyof ProductDraft)[])
      .filter((field) => !this._equal(field, live, draft))
      .map((field) => ({
        field: FIELD_LABELS[field],
        from: this._format(field, live),
        to: this._format(field, draft),
      }));
  });

  /** True when the draft differs from its last saved snapshot. */
  readonly unsaved = computed(() => {
    const saved = this.savedDraft();
    const draft = this.draft();
    return (Object.keys(FIELD_LABELS) as (keyof ProductDraft)[]).some(
      (field) => !this._equal(field, saved, draft),
    );
  });

  /** Set of field names that carry a CHANGED marker in the Details tab. */
  readonly changedFields = computed(() => {
    const live = this.live();
    const draft = this.draft();
    return new Set(
      (Object.keys(FIELD_LABELS) as (keyof ProductDraft)[]).filter(
        (field) => !this._equal(field, live, draft),
      ),
    );
  });

  /** Read-only view of whichever version the header toggle selects. */
  readonly viewed = computed(() =>
    this.view() === 'live' ? this.live() : this.draft(),
  );

  readonly isLive = computed(() => this.view() === 'live');

  /** Applies one suggestion to the draft and removes it from the open list. */
  applySuggestion(suggestion: FieldSuggestion): void {
    const next = suggestion.apply(this.draft());
    this._writeDraft(next);
    this.dismissSuggestion(suggestion);
  }

  /** Removes a suggestion without applying it. */
  dismissSuggestion(suggestion: FieldSuggestion): void {
    this.suggestions.update((open) => open.filter((s) => s !== suggestion));
  }

  /** Returns the open suggestion attached to a field, if any. */
  suggestionFor(field: keyof ProductDraft): FieldSuggestion | null {
    return this.suggestions().find((s) => s.field === field) ?? null;
  }

  /** Snapshot the draft as saved and log a history entry. */
  saveDraft(): void {
    this.savedDraft.set(this.draft());
    this._logVersion('Draft saved', 'info', 'Manual save from the editor.');
  }

  /** Publish the draft: it becomes the live version and the diff resets. */
  publish(): void {
    const draft = this.draft();
    this.live.set(draft);
    this.savedDraft.set(draft);
    this.scheduledFor.set(null);
    this._logVersion(
      'New version published',
      'success',
      'Published from the record editor demo.',
    );
  }

  /** Throw away draft edits and return to the live values. */
  discard(): void {
    this._writeDraft(this.live());
    this.savedDraft.set(this.live());
  }

  /** Store the delayed-publish date chosen in the Schedule popup. */
  schedule(date: Date | null): void {
    this.scheduledFor.set(date);
  }

  /** @private Writes a whole draft object back into the field signals. */
  private _writeDraft(draft: ProductDraft): void {
    this.name.set(draft.name);
    this.availability.set(draft.availability);
    this.price.set(draft.price);
    this.unitCost.set(draft.unitCost);
    this.leadTime.set(draft.leadTime);
    this.featured.set(draft.featured);
    this.description.set(draft.description);
    this.tags.set(draft.tags);
  }

  /** @private Compares one field between two drafts. */
  private _equal(
    field: keyof ProductDraft,
    a: ProductDraft,
    b: ProductDraft,
  ): boolean {
    if (field === 'tags') {
      return (
        a.tags.map((t) => t.value).join(',') ===
        b.tags.map((t) => t.value).join(',')
      );
    }
    return a[field] === b[field];
  }

  /** @private Formats one field of a draft for the diff rows. */
  private _format(field: keyof ProductDraft, draft: ProductDraft): string {
    if (field === 'tags') {
      return draft.tags.map((t) => t.label).join(', ');
    }
    if (field === 'featured') {
      return draft.featured ? 'Enabled' : 'Disabled';
    }
    if (field === 'price' || field === 'unitCost') {
      return `${draft[field]} USD`;
    }
    if (field === 'leadTime') {
      return `${draft.leadTime} days`;
    }
    return String(draft[field]);
  }

  /** @private Prepends a version-history entry. */
  private _logVersion(
    title: string,
    tone: 'info' | 'success',
    note: string,
  ): void {
    this.versions.update((versions) => [
      {
        id: versions.length,
        title,
        timestamp: 'Just now',
        tone,
        author: 'ME',
        note,
      },
      ...versions,
    ]);
  }
}

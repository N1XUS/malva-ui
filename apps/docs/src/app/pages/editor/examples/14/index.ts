import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LucideLightbulb, provideLucideIcons } from '@lucide/angular';
import { MlvBreakpointService } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import {
  MlvDrawer,
  MlvDrawerBody,
  MlvDrawerContent,
  MlvDrawerHeader,
} from '@malva-ui/core/drawer';
import { MlvKbd, type MlvKbdKey } from '@malva-ui/core/kbd';
import { MlvSwitch } from '@malva-ui/core/switch';
import {
  MlvEditor,
  MlvEditorToc,
  mlvEditorDefaultInsertItems,
  type MlvEditorAiProvider,
  type MlvEditorAiRequest,
  type MlvEditorHeadingAnchorOptions,
  type MlvEditorInsertItem,
  type MlvEditorTocItem,
} from '@malva-ui/editor';

/** A draft long enough to scroll, with headings for the table of contents. */
const CLEAN_DOCUMENT = [
  '<h1>Field guide</h1>',
  '<p>Select any text to see the bubble. Point at a block, or put the caret ',
  'in one, and press the "+" in the gutter to insert a block below it.</p>',
  '<h2>Planning</h2>',
  ...Array.from(
    { length: 5 },
    (_, index) => `<p>Planning note ${index + 1}: one line of detail.</p>`,
  ),
  '<h3>Checklist</h3>',
  '<ul><li><p>Pick a route</p></li><li><p>Pack light</p></li></ul>',
  '<h2>On the trail</h2>',
  ...Array.from(
    { length: 6 },
    (_, index) => `<p>Trail note ${index + 1}: one line of detail.</p>`,
  ),
  '<blockquote><h3>Weather</h3><p>Check the forecast twice.</p></blockquote>',
  '<h2>Coming home</h2>',
  '<p>Write the trip up while it is fresh.</p>',
].join('');

/**
 * Canned text per request. A real host calls its own backend here; this one
 * never leaves the page and needs no API key.
 */
function cannedAnswer(request: MlvEditorAiRequest): string {
  if (request.kind === 'custom' && request.instruction) {
    return `A short paragraph written for “${request.instruction}”.`;
  }
  return 'This text was rewritten by the stubbed provider, one word at a time.';
}

/** Streams the canned answer word by word, stopping when the request aborts. */
const STUB_PROVIDER: MlvEditorAiProvider = {
  async *stream(request) {
    for (const word of cannedAnswer(request).split(/(?<= )/)) {
      if (request.signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
      yield word;
    }
  },
};

/** One row of the keyboard table. */
interface CleanKeyRow {
  readonly where: string;
  readonly keys: readonly MlvKbdKey[][];
  readonly result: string;
}

@Component({
  selector: 'docs-editor-clean-example',
  imports: [
    MlvButton,
    MlvDrawer,
    MlvDrawerBody,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvEditor,
    MlvEditorToc,
    MlvKbd,
    MlvSwitch,
  ],
  // The Callout item's icon is not one the editor ships, so the page
  // registers it; an unregistered name renders no icon and warns in dev.
  providers: [provideLucideIcons(LucideLightbulb)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styles: `
    .docs-clean {
      display: grid;
      gap: 1.5rem;
      align-items: start;
    }
    .docs-clean--wide {
      grid-template-columns: minmax(0, 1fr) 13rem;
    }
    /* The docs app bar is fixed at the top: land headings clear of it. */
    .docs-clean mlv-editor {
      --mlv-editor-heading-scroll-margin: 5.5rem;
    }
    .docs-clean__aside {
      position: sticky;
      inset-block-start: 5.5rem;
    }
    .docs-clean__keys {
      border-collapse: collapse;
      inline-size: 100%;
    }
    .docs-clean__keys th,
    .docs-clean__keys td {
      padding: 0.375rem 0.5rem;
      border-block-end: 1px solid var(--mlv-border-subtle);
      text-align: start;
      vertical-align: top;
    }
  `,
})
export default class EditorCleanExample {
  /** HTML value of the clean editor. */
  readonly value = signal<string | null>(CLEAN_DOCUMENT);

  /** Whether the stubbed AI provider is connected. */
  readonly aiEnabled = signal(true);

  /** The provider while the switch is on; AI entry points hide without one. */
  readonly aiProvider = computed(() =>
    this.aiEnabled() ? STUB_PROVIDER : undefined,
  );

  /** A distinct prefix, so these heading ids cannot collide with another editor's. */
  readonly anchors: Partial<MlvEditorHeadingAnchorOptions> = {
    idPrefix: 'guide-',
  };

  /**
   * The default command-menu items plus a "Callout": a blockquote whose first
   * paragraph starts with an emoji. `chain()` has already left the caret in an
   * empty paragraph, so wrapping it and typing is one transaction.
   */
  readonly insertItems: readonly MlvEditorInsertItem[] = [
    ...mlvEditorDefaultInsertItems(),
    {
      id: 'callout',
      label: 'Callout',
      group: 'insert',
      icon: 'lightbulb',
      available: ({ editor }) => 'blockquote' in editor.schema.nodes,
      run: (context) =>
        context.chain().setBlockquote().insertContent('💡 ').run(),
    },
  ];

  /** Below `md` the table of contents moves into a drawer. */
  readonly narrow = inject(MlvBreakpointService).isDown('md');

  /** Whether the contents drawer is open. */
  readonly contentsOpen = signal(false);

  /** Keyboard map of clean mode, rendered with `mlv-kbd`. */
  readonly keyRows: readonly CleanKeyRow[] = [
    {
      where: 'Content',
      keys: [['alt', 'F10']],
      result:
        'Show the bubble at the caret and focus its first control (Insert block at a caret).',
    },
    {
      where: 'Content',
      keys: [['cmd', 'alt', 'enter']],
      result: 'Open the command menu for the block at the caret.',
    },
    {
      where: 'Content',
      keys: [
        ['alt', 'shift', 'up'],
        ['alt', 'shift', 'down'],
      ],
      result: 'Move the block at the caret.',
    },
    {
      where: 'Content, bubble',
      keys: [['escape']],
      result: 'Dismiss the bubble; the selection stays.',
    },
    {
      where: 'Bubble',
      keys: [['left'], ['right'], ['home'], ['end']],
      result: 'Move between controls (mirrored right to left).',
    },
    {
      where: 'Bubble',
      keys: [['tab']],
      result: 'Return to the content.',
    },
    {
      where: 'Command menu',
      keys: [['up'], ['down'], ['enter'], ['escape']],
      result: 'Pick an item; Escape returns to the content.',
    },
    {
      where: 'Table of contents',
      keys: [['tab'], ['enter']],
      result: 'Scroll to the heading and move the caret into it.',
    },
  ];

  /** @private The page document, for the heading lookup after the drawer closes. */
  private readonly _document = inject(DOCUMENT);

  /** @private The editor, refocused after a pick in the drawer. */
  private readonly _editor = viewChild.required(MlvEditor);

  /** @private The heading picked in the drawer, scrolled to once it has closed. */
  private _picked: MlvEditorTocItem | null = null;

  /**
   * Closes the drawer after a pick. The table of contents has already put
   * the caret in the heading, but the drawer blocks page scrolling while it
   * is open, restores the old position when it closes, and returns focus to
   * its trigger — so both the scroll and the focus are re-applied from
   * `afterClosed`.
   */
  protected _onDrawerPick(item: MlvEditorTocItem): void {
    this._picked = item;
    this.contentsOpen.set(false);
  }

  /** Refocuses the content and scrolls to the heading picked in the drawer. */
  protected _onDrawerClosed(): void {
    const item = this._picked;
    this._picked = null;
    if (!item) return;
    this._editor().editor()?.commands.focus(null, { scrollIntoView: false });
    const reduce = this._document.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this._document.getElementById(item.id)?.scrollIntoView({
      block: 'start',
      behavior: reduce ? 'auto' : 'smooth',
    });
  }
}

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Component, ErrorHandler, signal, type Type } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideRouter } from '@angular/router';
import { LucideHome, LucideSearch, provideLucideIcons } from '@lucide/angular';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

import type { MlvNavItem } from '@malva-ui/cdk/utils';
import { MlvAnimatedPresence } from '@malva-ui/cdk/utils';
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';
import { MlvActionBar, MlvActionBarLogo } from '@malva-ui/core/action-bar';
import { MlvAlert } from '@malva-ui/core/alert';
import { MlvAvatar } from '@malva-ui/core/avatar';
import {
  MlvAvatarGroup,
  type MlvAvatarGroupMember,
} from '@malva-ui/core/avatar-group';
import { MlvBadge } from '@malva-ui/core/badge';
import { MlvBottomNav } from '@malva-ui/core/bottom-nav';
import {
  MlvBreadcrumb,
  MlvBreadcrumbItem,
  type MlvBreadcrumbEntry,
} from '@malva-ui/core/breadcrumb';
import {
  MlvButton,
  MlvButtonClose,
  MlvButtonGroup,
  MlvButtonSplit,
  MlvButtonToggle,
} from '@malva-ui/core/button';
import { MlvCalendar, MlvCalendarSheet } from '@malva-ui/core/calendar';
import { MlvCard } from '@malva-ui/core/card';
import {
  MlvChat,
  MlvChatMessage,
  type MlvChatMessageData,
} from '@malva-ui/core/chat';
import { MlvCheckbox, MlvCheckboxGroup } from '@malva-ui/core/checkbox';
import { MlvChip } from '@malva-ui/core/chip';
import {
  MlvColorPicker,
  MlvColorPickerPopup,
} from '@malva-ui/core/color-picker';
import { MlvCombobox } from '@malva-ui/core/combobox';
import { MlvCompare } from '@malva-ui/core/compare';
import { MlvCopyToClipboard } from '@malva-ui/core/copy-to-clipboard';
import {
  MlvDataTable,
  type MlvDataTableColumn,
} from '@malva-ui/core/data-table';
import { MlvDateRangePicker } from '@malva-ui/core/date-range-picker';
import { MlvDayPicker } from '@malva-ui/core/day-picker';
import { MlvDialogBody, MlvDialogFooter } from '@malva-ui/core/dialog';
import { MlvDivider } from '@malva-ui/core/divider';
import {
  MlvDrawer,
  MlvDrawerBody,
  MlvDrawerContent,
  MlvDrawerHeader,
  MlvDrawerSection,
  MlvDrawerSections,
  MlvDrawerSectionsService,
} from '@malva-ui/core/drawer';
import {
  MlvDropdownPanel,
  type MlvSelectOption,
} from '@malva-ui/core/dropdown';
import { MlvEmptyState } from '@malva-ui/core/empty-state';
import { MlvExpand } from '@malva-ui/core/expand';
import {
  MlvFileUpload,
  MlvFileUploadItem,
  type MlvUploadedFile,
} from '@malva-ui/core/file-upload';
import {
  MlvFilter,
  MlvSmartFilterBar,
  type MlvFilterCondition,
  type MlvFilterDefinition,
  type MlvFilterFieldState,
  type MlvFilterOption,
} from '@malva-ui/core/filter';
import { MlvFieldset, MlvForm } from '@malva-ui/core/form';
import {
  MlvDescription,
  MlvFormControlWrapper,
  MlvFormControlWrapperControl,
  MlvFormField,
  MlvHint,
  MlvLabel,
  MlvMessage,
  MlvSelectionService,
} from '@malva-ui/core/form-utils';
import { MlvIconToggle } from '@malva-ui/core/icon-toggle';
import { MlvInput } from '@malva-ui/core/input';
import {
  MlvItemsMore,
  MlvItemsMoreHiddenDef,
  MlvItemsMoreItem,
  MlvItemsMoreTrigger,
  MlvItemsMoreTriggerDef,
  MlvItemsMoreVisibleDef,
} from '@malva-ui/core/items-more';
import { MlvKbd, type MlvKbdKey } from '@malva-ui/core/kbd';
import { MlvLink } from '@malva-ui/core/link';
import {
  MlvList,
  MlvListItem,
  MlvListItemGroup,
  MlvListItemLink,
} from '@malva-ui/core/list';
import { MlvLoader } from '@malva-ui/core/loader';
import {
  MlvMenu,
  MlvMenuGroup,
  MlvMenuItem,
  MlvMenuSeparator,
  MlvMenuTrigger,
  MlvMenubar,
} from '@malva-ui/core/menu';
import {
  MlvNotificationItem,
  type MlvInternalNotification,
} from '@malva-ui/core/notification';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import {
  MlvPage,
  MlvPageContent,
  MlvPageDock,
  MlvPageEndPane,
  MlvPageEndPaneContent,
  MlvPageHeader,
  MlvPageShell,
  MlvPageSkipLink,
  MlvPageSummary,
  MlvPageSummaryItem,
  MlvPageTitle,
} from '@malva-ui/core/page';
import { MlvPagination } from '@malva-ui/core/pagination';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import {
  MlvPopup,
  MlvPopupContainer,
  MlvPopupContent,
  MlvPopupTrigger,
} from '@malva-ui/core/popup';
import { MlvProgress } from '@malva-ui/core/progress';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvRating } from '@malva-ui/core/rating';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvSearchField } from '@malva-ui/core/search-field';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import { MlvSelect } from '@malva-ui/core/select';
import {
  MlvSidebar,
  MlvSidebarContent,
  MlvSidebarGroup,
  MlvSidebarItem,
  MlvSidebarRail,
  MlvSidebarTrigger,
  MlvSidebarWorkspace,
  type MlvSidebarWorkspaceOption,
} from '@malva-ui/core/sidebar';
import { MlvSkeleton } from '@malva-ui/core/skeleton';
import { MlvSlider } from '@malva-ui/core/slider';
import { MlvSpeedDial, type MlvSpeedDialItem } from '@malva-ui/core/speed-dial';
import { MlvSplitPane, MlvSplitPanePanel } from '@malva-ui/core/split-pane';
import { MlvStatusIndicator } from '@malva-ui/core/status-indicator';
import { MlvStep, MlvStepper } from '@malva-ui/core/stepper';
import { MlvSwipeAction, MlvSwipeActions } from '@malva-ui/core/swipe-actions';
import { MlvSwitch, MlvSwitchGroup } from '@malva-ui/core/switch';
import { MlvTable, MlvTableCell, MlvTableRow } from '@malva-ui/core/table';
import {
  MlvTab,
  MlvTabContent,
  MlvTabContentDef,
  MlvTabDef,
  MlvTabGroup,
  MlvTabItem,
} from '@malva-ui/core/tabs';
import { MlvTextarea } from '@malva-ui/core/textarea';
import {
  MlvTile,
  MlvTiles,
  type MlvTileNodeWithChildren,
} from '@malva-ui/core/tile';
import { MlvScrubber } from '@malva-ui/core/scrubber';
import { MlvTimePicker } from '@malva-ui/core/time-picker';
import { MlvTimeline, MlvTimelineItem } from '@malva-ui/core/timeline';
import { MlvTitle } from '@malva-ui/core/title';
import {
  MLV_TOAST_CLOSE,
  MlvToastContainer,
  MlvToastItem,
  type MlvInternalToast,
} from '@malva-ui/core/toast';
import { MlvToken, MlvTokenizer } from '@malva-ui/core/tokenizer';
import { MlvToolbar, MlvToolbarSpacer } from '@malva-ui/core/toolbar';
import { MlvTooltipPanel } from '@malva-ui/core/tooltip';
import { MlvTree, type MlvTreeNode } from '@malva-ui/core/tree';
import {
  MlvViewVariantList,
  MlvViewVariantStatus,
  type MlvViewVariant,
} from '@malva-ui/core/view-variant';

/**
 * Server-rendering smoke test for every publicly exported `@malva-ui/core`
 * component.
 *
 * `@malva-ui/core` is published for applications that may render on the
 * server. The failure mode is silent at build time and fatal at runtime: a
 * component that measures, observes, or listens during construction throws on
 * the server, and Angular routes that exception to the `ErrorHandler` and
 * carries on rendering — so the markup still comes out intact and a
 * markup-only assertion stays green with the bug present. The primary
 * assertions of this suite are therefore the *error channels*, not the
 * markup. There are two of them, because Angular does not use one:
 * exceptions reach the `ErrorHandler`, while an unknown **property
 * binding** never does and lands on `console.error` instead (see
 * `renderHost`). Both are collected, and both are asserted empty.
 *
 * **What this suite cannot see.** It runs domino inside jsdom, and the two
 * have different holes. `domino.impl` defines DOM *classes* only — no
 * `document`, `window`, `getComputedStyle`, `requestAnimationFrame`,
 * `matchMedia` or any observer — and
 * `scripts/testing/setup-restore-dom-globals.js` deliberately snapshots only
 * uppercase function-valued globals, so it never touches instance globals like
 * `document`. jsdom's `document` is therefore live for the whole server
 * render. Three classes of real SSR crash pass here:
 *
 * - reading the bare global `document` (or `getComputedStyle`,
 *   `requestAnimationFrame`, `matchMedia`) instead of the injected `DOCUMENT`
 *   — jsdom answers, Node throws;
 * - reading `navigator` — present on Node 21+, but with a Node shape
 *   (`userAgent` is `"Node.js/<version>"`, no `clipboard`, no `language`);
 * - *constructing* an observer jsdom happens to ship without calling it. The
 *   `MutationObserver` bug this suite does catch is caught only because
 *   `observe()` is called on a domino node and jsdom rejects it;
 *   `IntersectionObserver` and `ResizeObserver` are caught properly, because
 *   jsdom ships neither.
 *
 * Green here is therefore necessary, not sufficient. When a fix turns on "this
 * cannot run on the server", prefer a primitive that structurally cannot
 * (`afterNextRender` / `afterRenderEffect`) over one this suite merely fails
 * to catch.
 *
 * The hosts below split the library only for readability; every one of them is
 * rendered through the same error-collecting path. A component is "covered"
 * when its selector is written into one of these templates *and* its class is
 * listed in that same host's `imports` — see `readDeclaredHosts` for why the
 * template, rather than the rendered markup, is the primary signal, and why
 * the `imports` array is the second condition rather than a replacement.
 */

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

@Component({
  selector: 'mlv-ssr-form-controls-host',
  imports: [
    MlvForm,
    MlvFieldset,
    MlvFormField,
    MlvFormControlWrapper,
    MlvFormControlWrapperControl,
    MlvLabel,
    MlvHint,
    MlvDescription,
    MlvMessage,
    MlvInput,
    MlvTextarea,
    MlvSelect,
    MlvCombobox,
    MlvNumberInput,
    MlvSearchField,
    MlvPinInput,
    MlvRating,
    MlvSlider,
    MlvSwitch,
    MlvSwitchGroup,
    MlvCheckbox,
    MlvCheckboxGroup,
    MlvRadio,
    MlvRadioGroup,
    MlvTokenizer,
    MlvToken,
    MlvFileUpload,
    MlvFileUploadItem,
    MlvDropdownPanel,
  ],
  // `mlv-dropdown-panel` injects `MlvSelectionService` non-optionally and
  // declares no providers of its own — its usual hosts (select, combobox,
  // filter) provide it. Docs examples do the same.
  providers: [MlvSelectionService],
  template: `
    <form mlvForm>
      <fieldset mlvFieldset legend="Contact">
        <!-- The label-to-control association (#197) resolves through
             MLV_FORM_FIELD + contentChild(MLV_FORM_CONTROL) and lands on the
             *server* payload, so it needs a server case: no for attribute and
             no control-side label input here, or the field resolves nothing
             and the whole path stays untested. This one is the native half -
             the id lands on mlv-input's own input element, so the projected
             label names it with a plain for. (No backticks in a host template,
             as elsewhere in this file.) -->
        <mlv-form-field>
          <mlv-label>Name <mlv-hint>required</mlv-hint></mlv-label>
          <mlv-input [(value)]="text" />
          <mlv-description>Shown on your public profile.</mlv-description>
          <mlv-message state="error">This field is required.</mlv-message>
        </mlv-form-field>

        <!-- The aria half: mlv-select's custom trigger is a
             div[role=combobox], which a label for attribute cannot name, so
             the trigger points aria-labelledby at the projected label's id. -->
        <mlv-form-field>
          <mlv-label>Region</mlv-label>
          <mlv-select [options]="options" [(value)]="option" />
        </mlv-form-field>

        <mlv-textarea
          label="Bio"
          autoResize
          [minRows]="2"
          [maxRows]="6"
          [(value)]="bio"
        />
        <mlv-select
          label="Environment"
          [options]="options"
          [(value)]="option"
        />
        <!-- The same control in its *other* rendering mode. The native input
             defaults to false, so the instance above stops at the custom
             trigger and never reaches the branch that stamps a real select and
             one option per entry - the shape that made #135 invisible here
             (#137 is that blind spot in general). Keep this instance and keep
             its committed value: without the native attribute, neither the
             unknown-property assertion nor the selected-in-markup one has
             anything to bite on. (No backticks in a host template, as above.) -->
        <mlv-select
          label="Environment (native)"
          native
          [options]="options"
          [(value)]="option"
        />
        <!-- The viewport-driven mode (#218). A server has no viewport, so the
             select renders auto natively there whatever its breakpoint service
             answers, named by the field label's for. A hydrating client's
             first render matches it; a hydrating desktop client switches to
             the custom trigger only after that render, and a client-rendered
             one follows its viewport from the start. Keep it inside a field
             and after the native instance above, so the selection assertion
             keeps reading that one, and after the Region field, so the label
             association test keeps finding Region's trigger first. (No
             backticks in a host template, as above.) -->
        <mlv-form-field>
          <mlv-label>Zone</mlv-label>
          <mlv-select native="auto" [options]="options" [(value)]="option" />
        </mlv-form-field>
        <mlv-combobox label="City" [options]="options" [(value)]="option" />
        <mlv-number-input label="Quantity" [(value)]="quantity" />
        <mlv-search-field [(value)]="query" />
        <!-- A static role: it must reach the native input and leave the host
             in the server payload, not only after hydration (issue #329). -->
        <mlv-search-field
          class="ssr-command-search"
          role="combobox"
          ariaAutocomplete="list"
          ariaLabel="Search commands"
          ariaControls="ssr-command-listbox"
          [ariaExpanded]="false"
          [(value)]="query"
        />
        <mlv-pin-input label="One-time code" [length]="4" [(value)]="pin" />
        <mlv-rating [(value)]="stars" />
        <mlv-slider [min]="0" [max]="10" [(value)]="level" />
      </fieldset>

      <!-- An explicit density on a fieldset inside a form that has none: the
           nearest scope, not the form, sizes the controls in it, and each
           stamps its own modifier on the server (issue #364). -->
      <fieldset mlvFieldset legend="Preferences" mlvDensity="compact">
        <mlv-switch-group label="Alerts">
          <!-- A static consumer id: it must reach the native input and leave
               the host in the server payload, not only after hydration
               (issue #323). -->
          <mlv-switch id="ssr-email" label="Email" [(checked)]="toggled" />
        </mlv-switch-group>

        <mlv-checkbox-group label="Permissions">
          <mlv-checkbox id="ssr-read" label="Read" [(checked)]="toggled" />
          <!-- The tri-state "select all" shape. The indeterminate state is a
               DOM property with no HTML attribute, so it is the one part of
               this input domino cannot satisfy — issue #124. Keep this
               instance: with no checkbox that actually sets it, both the
               mixed-markup assertion and the unknown-property assertion have
               nothing to bite on. (No backticks in a host template: the
               template is read back out of this file with a regex that a
               backslash-escaped backtick terminates early.) -->
          <mlv-checkbox label="Select all" indeterminate />
        </mlv-checkbox-group>

        <mlv-radio-group label="Colour" [(value)]="choice">
          <mlv-radio value="red">Red</mlv-radio>
          <mlv-radio value="green">Green</mlv-radio>
        </mlv-radio-group>

        <mlv-tokenizer label="Tags" [(tokens)]="tokens" />
        <mlv-token [value]="tokens()[0]">angular</mlv-token>

        <mlv-file-upload [(value)]="files" />
        <mlv-file-upload-item [file]="uploaded" />
      </fieldset>

      <mlv-form-control-wrapper>
        <mlv-label for="ssr-wrapped">Wrapped control</mlv-label>
        <ng-template mlvFormControlWrapperControl>
          <mlv-input label="Wrapped control" />
        </ng-template>
      </mlv-form-control-wrapper>

      <mlv-dropdown-panel [options]="options" />
    </form>
  `,
})
class SsrFormControlsHost {
  readonly text = signal('');
  readonly bio = signal('');
  readonly options: MlvSelectOption<string>[] = [
    { label: 'Production', value: 'prod' },
    { label: 'Staging', value: 'staging' },
  ];
  // Deliberately not the *first* option: a native select with nothing selected
  // falls back to its first entry, so a committed 'prod' would look identical
  // to no selection at all in the server markup.
  readonly option = signal<string | null>('staging');
  readonly quantity = signal<number | null>(1);
  readonly query = signal('');
  readonly pin = signal('');
  readonly stars = signal(3);
  readonly level = signal(4);
  readonly toggled = signal(false);
  readonly choice = signal<unknown>('red');
  readonly tokens = signal<MlvSelectOption<string>[]>([
    { label: 'angular', value: 'angular' },
  ]);
  readonly files = signal<MlvUploadedFile[]>([]);
  // `mlv-file-upload-item` reads name/size/state/progress/error/previewUrl and
  // never dereferences `file`, so no real `File` is needed on the server.
  readonly uploaded: MlvUploadedFile = {
    id: 'f1',
    name: 'report.pdf',
    size: 2048,
    state: 'success',
    file: null as unknown as File,
  };
}

@Component({
  selector: 'mlv-ssr-pickers-host',
  imports: [
    MlvCalendar,
    MlvCalendarSheet,
    MlvDayPicker,
    MlvScrubber,
    MlvTimePicker,
    MlvDateRangePicker,
    MlvColorPicker,
    MlvColorPickerPopup,
    MlvFilter,
    MlvSmartFilterBar,
  ],
  template: `
    <mlv-calendar [(value)]="day" />
    <!--
      The sheet measures scroll offsets and registers a scroll listener, but
      only from afterNextRender / ngAfterViewInit, and resolves reduced motion
      through a guarded matchMedia — so it must server-render its month list
      without reaching a browser global.
    -->
    <mlv-calendar-sheet [(value)]="day" [windowMonths]="1" [yearRange]="1" />
    <mlv-day-picker label="Date" [(value)]="day" />
    <mlv-time-picker label="Start" [(value)]="time" />
    <mlv-scrubber
      label="Year"
      orientation="horizontal"
      [items]="years"
      [selectedValue]="year()"
    />
    <mlv-date-range-picker label="Period" />
    <mlv-color-picker [(value)]="colour" />
    <mlv-color-picker-popup label="Brand colour" [(value)]="colour" />
    <mlv-filter
      label="Status"
      [options]="filterOptions"
      [(conditions)]="conditions"
    />
    <mlv-smart-filter-bar [definitions]="definitions" [(filters)]="filters" />
  `,
})
class SsrPickersHost {
  readonly day = signal<Date | null>(null);
  readonly time = signal('09:30');
  readonly years: readonly number[] = [2026, 2027, 2028];
  readonly year = signal(2027);
  readonly colour = signal('#3366ff');
  readonly filterOptions: MlvFilterOption<string>[] = [
    { label: 'Open', value: 'open' },
  ];
  readonly conditions = signal<readonly MlvFilterCondition[]>([]);
  readonly definitions: MlvFilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      options: [{ label: 'Open', value: 'open' }],
    },
  ];
  readonly filters = signal<readonly MlvFilterFieldState[]>([]);
}

@Component({
  selector: 'mlv-ssr-navigation-host',
  imports: [
    MlvActionBar,
    MlvActionBarLogo,
    MlvBreadcrumb,
    MlvBreadcrumbItem,
    MlvBottomNav,
    MlvToolbar,
    MlvToolbarSpacer,
    MlvItemsMore,
    MlvItemsMoreItem,
    MlvItemsMoreVisibleDef,
    MlvItemsMoreHiddenDef,
    MlvItemsMoreTriggerDef,
    MlvItemsMoreTrigger,
    MlvTabGroup,
    MlvTab,
    MlvTabDef,
    MlvTabContentDef,
    MlvTabItem,
    MlvTabContent,
    MlvSegmented,
    MlvSegmentedItem,
    MlvStepper,
    MlvStep,
    MlvPagination,
    MlvList,
    MlvListItem,
    MlvListItemLink,
    MlvListItemGroup,
    MlvSwipeActions,
    MlvSwipeAction,
    MlvLink,
    MlvMenu,
    MlvMenubar,
    MlvMenuGroup,
    MlvMenuSeparator,
    MlvMenuItem,
    MlvMenuTrigger,
    MlvButton,
  ],
  template: `
    <header mlvActionBar>
      <div mlvActionBarLogo>Malva</div>
      <button mlvButton>Sign in</button>
      <a mlvButton href="/billing" disabled>Billing</a>
    </header>

    <nav mlvBreadcrumb [items]="crumbs">
      <mlv-breadcrumb-item current>Widget Pro</mlv-breadcrumb-item>
    </nav>

    <mlv-bottom-nav [items]="navItems" />

    <mlv-toolbar>
      <button mlvButton>One</button>
      <mlv-toolbar-spacer />
      <button mlvButton>Two</button>
    </mlv-toolbar>

    <!--
      No viewport on the server, so nothing is withheld: every item renders in
      the row and the trigger is present only as the inert measuring probe.
    -->
    <mlv-items-more ariaLabel="More actions">
      <mlv-items-more-item>
        <ng-template mlvItemsMoreVisible>
          <button mlvButton>Share</button>
        </ng-template>
        <ng-template mlvItemsMoreHidden>
          <button mlvButton variant="transparent">Share</button>
        </ng-template>
      </mlv-items-more-item>
      <mlv-items-more-item>
        <ng-template mlvItemsMoreVisible>
          <button mlvButton>Export</button>
        </ng-template>
      </mlv-items-more-item>
      <ng-template mlvItemsMoreTriggerDef let-count>
        <button mlvButton mlvItemsMoreTrigger aria-label="More actions">
          +{{ count }}
        </button>
      </ng-template>
    </mlv-items-more>

    <mlv-tab-group [(activeTab)]="tab">
      <mlv-tab value="one">
        <ng-template mlvTabDef>One</ng-template>
        <ng-template mlvTabContent>First panel</ng-template>
      </mlv-tab>
      <mlv-tab value="two">
        <ng-template mlvTabDef>Two</ng-template>
        <ng-template mlvTabContent>Second panel</ng-template>
      </mlv-tab>
    </mlv-tab-group>

    <mlv-tab-item>Standalone header</mlv-tab-item>
    <mlv-tab-content>Standalone panel</mlv-tab-content>

    <mlv-segmented [(value)]="segment">
      <button mlvSegmentedItem value="day">Day</button>
      <button mlvSegmentedItem value="week">Week</button>
    </mlv-segmented>

    <mlv-stepper ariaLabel="Account setup">
      <mlv-step label="Account">Account details</mlv-step>
      <mlv-step label="Profile">Profile details</mlv-step>
    </mlv-stepper>
    <mlv-stepper aria-label="Checkout">
      <mlv-step label="Cart">Cart contents</mlv-step>
      <mlv-step label="Payment">Payment details</mlv-step>
    </mlv-stepper>

    <mlv-pagination [totalItems]="120" [(currentPage)]="page" />

    <mlv-list>
      <mlv-list-item><a mlvListItemLink href="/a">Item A</a></mlv-list-item>
      <mlv-swipe-actions role="listitem">
        <button mlvSwipeAction side="start" tone="success">Archive</button>
        <mlv-list-item itemRole="none">Item B</mlv-list-item>
        <button mlvSwipeAction tone="danger">Delete</button>
      </mlv-swipe-actions>
    </mlv-list>
    <mlv-list-item-group label="Recent"
      ><p>Grouped rows</p></mlv-list-item-group
    >

    <a mlvLink href="/docs">Docs</a>

    <!--
      A data-driven menubar as well as a projected one. Only the data-driven
      rows are attached to their <mlv-menubar> by the time the item registry
      resolves its shared container, so this is the arrangement that reaches
      the registry's MutationObserver — a browser global Node does not define.
      A projected [mlvMenuTrigger] registers from its constructor, while its
      host element still has no parent, and never gets that far on the server.
    -->
    <mlv-menubar label="Data" [dataSource]="menubarEntries" />
    <mlv-menubar label="Application">
      <button mlvButton variant="transparent" [mlvMenuTrigger]="fileMenu">
        File
      </button>
    </mlv-menubar>
    <mlv-menu #fileMenu label="File">
      <mlv-menu-group>
        <mlv-list-item mlvMenuItem>New file</mlv-list-item>
      </mlv-menu-group>
      <mlv-menu-separator />
      <mlv-list-item mlvMenuItem>Save</mlv-list-item>
    </mlv-menu>
  `,
})
class SsrNavigationHost {
  readonly crumbs: MlvBreadcrumbEntry[] = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
  ];
  readonly navItems: MlvNavItem[] = [
    { icon: 'home', label: 'Home', route: '/' },
    { icon: 'search', label: 'Search', route: '/search' },
  ];
  readonly tab = signal('one');
  readonly segment = signal<unknown>('day');
  /** Rows for the data-driven menubar — see the comment in the template. */
  readonly menubarEntries = [
    { id: 'file', label: 'File' },
    { id: 'edit', label: 'Edit' },
  ];
  readonly page = signal(1);
}

@Component({
  selector: 'mlv-ssr-shell-host',
  imports: [
    MlvPageShell,
    MlvPage,
    MlvPageSkipLink,
    MlvPageHeader,
    MlvPageTitle,
    MlvPageSummary,
    MlvPageSummaryItem,
    MlvPageContent,
    MlvPageDock,
    MlvPageEndPane,
    MlvPageEndPaneContent,
    MlvSidebar,
    MlvSidebarContent,
    MlvSidebarGroup,
    MlvSidebarItem,
    MlvSidebarRail,
    MlvSidebarTrigger,
    MlvSidebarWorkspace,
    MlvTitle,
    MlvButton,
  ],
  template: `
    <mlv-page-shell>
      <!--
        The skip link resolves its target from the page registry, so on the
        server there is no active page and it must emit *no* href rather than a
        dangling one — an anchor with no href is not a link and not a tab stop.
      -->
      <a mlvPageSkipLink>Skip to content</a>

      <mlv-sidebar ariaLabel="Primary navigation">
        <mlv-sidebar-workspace
          [workspaces]="workspaces"
          [(workspace)]="workspace"
        />
        <div mlvSidebarContent>
          <mlv-sidebar-item
            mlvSidebarTrigger
            #collapseTrigger="mlvSidebarTrigger"
            [label]="collapseTrigger.label()"
          />
          <mlv-sidebar-item label="Dashboard" [active]="true" />
          <mlv-sidebar-group label="Projects">
            <mlv-sidebar-item label="Inbox" />
          </mlv-sidebar-group>
        </div>
        <mlv-sidebar-rail />
      </mlv-sidebar>

      <main mlvPage maxWidth="72rem">
        <mlv-page-header>
          <ng-template mlvPageTitle
            ><h1 mlvTitle>Project Atlas</h1></ng-template
          >
        </mlv-page-header>

        <mlv-page-summary>
          <div mlvPageSummaryItem label="Owner">Design systems</div>
        </mlv-page-summary>

        <mlv-page-content>
          <section>Page body</section>
        </mlv-page-content>

        <mlv-page-dock>
          <button mlvButton>Save</button>
        </mlv-page-dock>
      </main>

      <mlv-page-end-pane ariaLabel="Project details">
        <ng-template mlvPageEndPaneContent><p>Details</p></ng-template>
      </mlv-page-end-pane>
    </mlv-page-shell>
  `,
})
class SsrShellHost {
  readonly workspaces: MlvSidebarWorkspaceOption[] = [
    { id: 'w1', label: 'Acme' },
    { id: 'w2', label: 'Globex' },
  ];
  readonly workspace = signal<MlvSidebarWorkspaceOption>({
    id: 'w1',
    label: 'Acme',
  });
}

@Component({
  selector: 'mlv-ssr-surfaces-host',
  imports: [
    MlvCard,
    MlvDivider,
    MlvExpand,
    MlvAccordion,
    MlvAccordionItem,
    MlvSplitPane,
    MlvSplitPanePanel,
    MlvScrollbar,
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDialogBody,
    MlvDialogFooter,
    MlvPopup,
    MlvPopupContainer,
    MlvPopupContent,
    MlvPopupTrigger,
    MlvTile,
    MlvTiles,
    MlvTimeline,
    MlvTimelineItem,
    MlvCompare,
    MlvEmptyState,
    MlvSpeedDial,
    MlvTable,
    MlvTableRow,
    MlvTableCell,
    MlvButton,
  ],
  template: `
    <mlv-card><p>Card body</p></mlv-card>
    <mlv-divider>OR</mlv-divider>
    <mlv-divider [ariaLabel]="'Combine conditions'">AND</mlv-divider>
    <mlv-expand [(opened)]="expanded"><p>Expand body</p></mlv-expand>

    <mlv-accordion>
      <mlv-accordion-item header="Shipping">Accordion body</mlv-accordion-item>
    </mlv-accordion>

    <mlv-split-pane style="height: 200px">
      <mlv-split-pane-panel [size]="30">Left</mlv-split-pane-panel>
      <mlv-split-pane-panel>Right</mlv-split-pane-panel>
    </mlv-split-pane>

    <mlv-scrollbar style="height: 120px"
      ><p>Scrollable content</p></mlv-scrollbar
    >

    <mlv-drawer-header title="Drawer header" />
    <div mlvDrawerBody><p>Drawer body</p></div>
    <mlv-drawer ariaLabel="Filters">
      <ng-template mlvDrawerContent><p>Drawer content</p></ng-template>
    </mlv-drawer>

    <mlv-dialog-body><p>Dialog body</p></mlv-dialog-body>
    <mlv-dialog-footer><button mlvButton>OK</button></mlv-dialog-footer>

    <mlv-popup-container>
      <button mlvButton mlvPopupTrigger>Actions</button>
      <mlv-popup position="bottom-start">
        <ng-template mlvPopupContent><p>Popup content</p></ng-template>
      </mlv-popup>
    </mlv-popup-container>

    <mlv-tile><span>Tile body</span></mlv-tile>
    <mlv-tiles [(tree)]="tileTree" />

    <mlv-timeline>
      <mlv-timeline-item title="Order placed"
        >Placed successfully.</mlv-timeline-item
      >
    </mlv-timeline>

    <mlv-compare ariaLabel="Before and after">
      <img
        mlvCompareBefore
        src="/before.png"
        alt="Before"
        width="10"
        height="10"
      />
      <img
        mlvCompareAfter
        src="/after.png"
        alt="After"
        width="10"
        height="10"
      />
    </mlv-compare>

    <mlv-empty-state>
      <span mlvEmptyStateTitle>No messages yet</span>
      <span mlvEmptyStateDescription>They will appear here.</span>
    </mlv-empty-state>

    <mlv-speed-dial [items]="speedDialItems" ariaLabel="Quick actions" />

    <table mlvTable>
      <tbody>
        <tr mlvTableRow>
          <td mlvTableCell>Ada Lovelace</td>
        </tr>
      </tbody>
    </table>
  `,
})
class SsrSurfacesHost {
  readonly expanded = signal(false);
  readonly tileTree = signal<MlvTileNodeWithChildren<{ title: string }>>({
    id: 'root',
    acceptsChildren: true,
    props: { title: 'Root' },
    children: [],
  });
  readonly speedDialItems: readonly MlvSpeedDialItem[] = [
    { label: 'Edit', icon: 'pencil' },
  ];
}

@Component({
  selector: 'mlv-ssr-data-host',
  imports: [
    MlvDataTable,
    MlvTree,
    MlvChat,
    MlvChatMessage,
    MlvViewVariantList,
    MlvViewVariantStatus,
  ],
  template: `
    <mlv-data-table [columns]="columns" [data]="rows" />
    <!--
      Virtual scroll is a separate SSR surface, not a variant: it is the only
      mode that mounts a cdk-virtual-scroll-viewport and runs the table's
      geometry effect, which measures offsetWidth/clientWidth. Those resolve
      undefined on the server and serialise NaNpx, which is why the
      "writes no NaN into the server payload" case is what guards it.
    -->
    <mlv-data-table
      virtualScroll
      maxHeight="12rem"
      [columns]="columns"
      [data]="rows"
    />
    <mlv-tree [nodes]="treeNodes" />
    <mlv-chat style="height: 12rem" [messages]="messages" selfId="me" />
    <mlv-chat-message [message]="messages[0]" />
    <mlv-view-variant-list [variants]="variants" />
    <mlv-view-variant-status [dirty]="true" />
  `,
})
class SsrDataHost {
  readonly columns: MlvDataTableColumn[] = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'role', title: 'Role' },
  ];
  readonly rows: Record<string, unknown>[] = [
    { name: 'Ada Lovelace', role: 'Engineer' },
  ];
  readonly treeNodes: MlvTreeNode[] = [{ id: '1', label: 'Root' }];
  // The attachments are not decoration. `mlv-chat-media-grid` is the only
  // template in the library that renders a `<video>`, and it renders nothing
  // at all for a message without `attachments` — so a text-only fixture put
  // `mlv-chat` in a host template while leaving every `<video>` binding in the
  // library unrendered, which is how issue #136 sat here uncaught. One of each
  // cell shape, because they take different branches: `gif` is the
  // autoplay/loop video, a poster-less `video` is the preload-metadata video,
  // and a `video` with a poster renders an `<img>` and no `<video>` at all.
  readonly messages: MlvChatMessageData[] = [
    {
      id: 'm1',
      authorId: 'me',
      text: 'Hello',
      timestamp: new Date(0),
      attachments: [
        { id: 'a1', kind: 'gif', src: 'loop.mp4' },
        { id: 'a2', kind: 'video', src: 'clip.mp4' },
        { id: 'a3', kind: 'video', src: 'talk.mp4', poster: 'talk.jpg' },
      ],
    },
  ];
  readonly variants: readonly MlvViewVariant<null>[] = [
    {
      id: 'v1',
      name: 'All records',
      scope: 'system',
      state: null,
      capabilities: {
        clone: false,
        update: false,
        rename: false,
        delete: false,
        share: false,
      },
    },
  ];
}

@Component({
  selector: 'mlv-ssr-display-host',
  imports: [
    MlvAlert,
    MlvAvatar,
    MlvAvatarGroup,
    MlvBadge,
    MlvButton,
    MlvButtonGroup,
    MlvButtonSplit,
    MlvButtonToggle,
    MlvButtonClose,
    MlvChip,
    MlvCopyToClipboard,
    MlvIconToggle,
    MlvKbd,
    MlvLoader,
    MlvProgress,
    MlvSkeleton,
    MlvStatusIndicator,
    MlvTitle,
    MlvTooltipPanel,
    MlvToastItem,
    MlvToastContainer,
    MlvNotificationItem,
  ],
  // `mlv-toast-item` / `mlv-notification-item` take their close callback from
  // `MlvToastContainer.itemInjector` in production. Rendering one directly
  // means supplying it here.
  providers: [{ provide: MLV_TOAST_CLOSE, useValue: () => undefined }],
  template: `
    <mlv-alert tone="info">Your session expires in 5 minutes.</mlv-alert>
    <mlv-avatar name="Ada Lovelace" />
    <mlv-avatar-group [members]="members" />
    <mlv-badge tone="success">New</mlv-badge>

    <button mlvButton>Save</button>
    <mlv-button-group>
      <button mlvButton>Left</button>
      <button mlvButton>Right</button>
    </mlv-button-group>
    <mlv-button-split aria-label="Save options">
      <button mlvButton>Save</button>
      <button mlvButton shape="square" aria-label="More save options">+</button>
    </mlv-button-split>
    <mlv-button-toggle ariaLabel="Bold">B</mlv-button-toggle>
    <mlv-button-close ariaLabel="Close" />

    <mlv-chip tone="info">Filter</mlv-chip>
    <mlv-copy-to-clipboard>sk_live_abc123xyz</mlv-copy-to-clipboard>
    <button mlvIconToggle type="button" aria-label="Bookmark">*</button>
    <mlv-kbd [keys]="shortcut" />
    <mlv-loader variant="circle" [value]="40" />
    <mlv-progress [value]="60" ariaLabel="Upload progress" />
    <mlv-progress [value]="30">{{ progressLabel }}</mlv-progress>
    <mlv-skeleton variant="text" width="8rem" />
    <mlv-status-indicator tone="success" ariaLabel="Online" />
    <h2 mlvTitle>Section heading</h2>

    <mlv-tooltip-panel content="Save changes" tooltipId="ssr-tooltip" />
    <mlv-toast-item [toast]="toast" />
    <mlv-toast-container />
    <mlv-notification-item [toast]="notification" />
  `,
})
class SsrDisplayHost {
  readonly members: MlvAvatarGroupMember[] = [
    { name: 'Ada Lovelace' },
    { name: 'Grace Hopper' },
  ];
  readonly shortcut: MlvKbdKey[] = ['cmd', 'k'];
  // Interpolated rather than static, so the text only arrives in the host's
  // update pass — after `mlv-progress` has created its view.
  readonly progressLabel = 'Uploading files';
  // `displayTime: 0` keeps `ngOnInit` from starting an auto-dismiss timer.
  readonly toast: MlvInternalToast = {
    id: 't1',
    position: 'top-right',
    displayTime: 0,
    pauseOnHover: false,
    closable: true,
    title: 'Saved',
    description: 'Your changes are live.',
    tone: 'success',
  };
  readonly notification: MlvInternalNotification = {
    id: 'n1',
    position: 'top-right',
    displayTime: 0,
    pauseOnHover: false,
    closable: true,
    title: 'Deploy finished',
    description: 'Build 412 is live.',
    tone: 'info',
    actions: [],
    showIcon: true,
  };
}

/**
 * `[mlvDrawerSection]` and `mlv-drawer-sections` inject
 * `MlvDrawerSectionsService`, which `mlv-drawer` provides. Rendering them here
 * behind a host-level provider is deliberate: inside `mlv-drawer` they only
 * ever appear in the overlay content template, which never attaches on the
 * server, so hosting them there would prove nothing. Providing the service
 * directly is a supported arrangement — it is a public export — and it is the
 * only way this suite reaches the service's own construction path.
 */
@Component({
  selector: 'mlv-ssr-drawer-sections-host',
  imports: [MlvDrawerSection, MlvDrawerSections],
  providers: [MlvDrawerSectionsService],
  template: `
    <mlv-drawer-sections />
    <section mlvDrawerSection id="ssr-meta" label="Meta">
      <p>Meta fields</p>
    </section>
    <section mlvDrawerSection id="ssr-history" label="History">
      <p>Change history</p>
    </section>
  `,
})
class SsrDrawerSectionsHost {}

/**
 * Surfaces that start **open**. Every other host renders its overlays closed,
 * so nothing here reached the overlay host's open path on the server: a view
 * `effect()` runs during server change detection, and
 * `MlvOverlayHostBase` read the global `document` there and then built a CDK
 * overlay into the payload; `MlvAnimatedPresence` added its enter class and
 * called `requestAnimationFrame`. This suite's jsdom `document` hides the
 * first (see the file comment) and `renders no overlay markup on the server`
 * sees the overlay; `server-renders open surfaces with no browser instance
 * globals` below renders this host with the animation-frame and computed-style
 * globals taken away, as Node has them.
 */
@Component({
  selector: 'mlv-ssr-open-surfaces-host',
  imports: [MlvDrawer, MlvDrawerContent, MlvSearchField, MlvAnimatedPresence],
  template: `
    <mlv-drawer ariaLabel="Open filters" [opened]="true">
      <ng-template mlvDrawerContent><p>Open drawer content</p></ng-template>
    </mlv-drawer>
    <mlv-search-field overlay ariaLabel="Search everything" [opened]="true" />
    <p *mlvAnimatedPresence="true" class="ssr-presence">Shown</p>
  `,
})
class SsrOpenSurfacesHost {}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** A host plus the element `renderApplication` mounts it on. */
interface SsrHostEntry {
  /** The host component class. */
  readonly component: Type<unknown>;
  /** The host's own selector, used as the server document root. */
  readonly selector: string;
}

/**
 * Every SSR host in this file. `renderAllHosts` iterates this list, and the
 * `renders every host it declares` case fails if a host declared above is
 * missing here — otherwise nothing would render its template and everything in
 * it would be silently uncovered.
 */
const SSR_HOSTS: readonly SsrHostEntry[] = [
  { component: SsrFormControlsHost, selector: 'mlv-ssr-form-controls-host' },
  { component: SsrPickersHost, selector: 'mlv-ssr-pickers-host' },
  { component: SsrNavigationHost, selector: 'mlv-ssr-navigation-host' },
  { component: SsrShellHost, selector: 'mlv-ssr-shell-host' },
  { component: SsrSurfacesHost, selector: 'mlv-ssr-surfaces-host' },
  { component: SsrDataHost, selector: 'mlv-ssr-data-host' },
  { component: SsrDisplayHost, selector: 'mlv-ssr-display-host' },
  {
    component: SsrDrawerSectionsHost,
    selector: 'mlv-ssr-drawer-sections-host',
  },
  { component: SsrOpenSurfacesHost, selector: 'mlv-ssr-open-surfaces-host' },
];

/** What one server render of a host produced. */
interface SsrRenderResult {
  /** The serialised server markup. */
  readonly html: string;
  /** Everything Angular routed to the `ErrorHandler` during the render. */
  readonly errors: string[];
  /** Everything the render wrote to `console.error`. */
  readonly logged: string[];
}

/**
 * Server-renders one host, collecting both channels a defect can surface on.
 *
 * Two channels, because Angular does not use one. A component that throws
 * during construction reaches the `ErrorHandler`; an unknown *property
 * binding* does not. `reportUnknownPropertyError` in `@angular/core` writes
 * NG0303 straight to `console.error` unless `shouldThrowErrorOnUnknownProperty`
 * is set — a flag only `TestBed`'s `errorOnUnknownProperties` turns on, and
 * `renderApplication` is not `TestBed`. So an `ErrorHandler`-only harness is
 * structurally blind to the whole unknown-property class, which is exactly how
 * `MlvCheckbox`'s `[indeterminate]` sat here uncaught (issue #124) while the
 * checkbox was already written into a host template above.
 */
const renderHost = async (entry: SsrHostEntry): Promise<SsrRenderResult> => {
  const errors: string[] = [];
  const logged: string[] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(
      `${entry.selector}: ${args.map((arg) => String(arg)).join(' ')}`,
    );
  };
  try {
    return { ...(await renderMarkup(entry, errors)), errors, logged };
  } finally {
    console.error = consoleError;
  }
};

/** The `renderApplication` call itself, split out so the `console.error` swap above stays narrow. */
const renderMarkup = async (
  entry: SsrHostEntry,
  errors: string[],
): Promise<{ html: string }> => {
  const html = await renderApplication(
    (context) =>
      bootstrapApplication(
        entry.component,
        {
          providers: [
            provideMlvI18nTesting(),
            provideRouter([]),
            // `mlv-bottom-nav` renders its icons through `LucideDynamicIcon`,
            // which resolves names against this registry.
            provideLucideIcons(LucideHome, LucideSearch),
            {
              provide: ErrorHandler,
              useValue: {
                handleError: (error: unknown) =>
                  errors.push(
                    `${entry.selector}: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                  ),
              },
            },
          ],
        },
        context,
      ),
    { document: `<${entry.selector}></${entry.selector}>`, url: '/' },
  );
  return { html };
};

/**
 * Browser **instance** globals Node does not define and this suite can take
 * away. `domino.impl` installs DOM classes only, and jsdom's instances stay
 * live for the rest of this suite — the blind spot the file comment describes.
 * `document` and `window` cannot join them: vitest's jsdom environment
 * defines both as non-configurable getters on `globalThis` (measured), so
 * `vi.stubGlobal` throws `Cannot redefine property`. A bare `document` read
 * therefore stays invisible here; what `renders no overlay markup on the
 * server` sees is its consequence, an overlay built on the server.
 * (`matchMedia` is absent from jsdom already.)
 */
const NODE_ABSENT_GLOBALS = [
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const;

/**
 * Runs `render` with {@link NODE_ABSENT_GLOBALS} removed from `globalThis` —
 * deleted, not set to `undefined`, so a bare read throws `ReferenceError` as
 * it does in Node — and restores them afterwards whatever happens.
 */
const withoutBrowserGlobals = async <T>(
  render: () => Promise<T>,
): Promise<T> => {
  for (const name of NODE_ABSENT_GLOBALS) {
    vi.stubGlobal(name, undefined);
    Reflect.deleteProperty(globalThis, name);
  }
  try {
    return await render();
  } finally {
    vi.unstubAllGlobals();
  }
};

/** Renders every host once. Memoised so the suite pays for one pass. */
let renderedHosts: Promise<SsrRenderResult> | null = null;
const renderAllHosts = (): Promise<SsrRenderResult> => {
  renderedHosts ??= (async () => {
    const parts: string[] = [];
    const errors: string[] = [];
    const logged: string[] = [];
    for (const entry of SSR_HOSTS) {
      const result = await renderHost(entry);
      parts.push(result.html);
      errors.push(...result.errors);
      logged.push(...result.logged);
    }
    return { html: parts.join('\n'), errors, logged };
  })();
  return renderedHosts;
};

// ---------------------------------------------------------------------------
// Coverage guard
// ---------------------------------------------------------------------------

/**
 * `@nx/vitest:test` runs with cwd = workspace root while the inferred
 * `vite:test` runs from the project root, so every path below is resolved from
 * this file rather than from `process.cwd()`.
 */
const SPEC_FILE = fileURLToPath(import.meta.url);
const CORE_ROOT = resolve(dirname(SPEC_FILE), '..');

/**
 * Matches a `@Component({ … })` decorator and the class it decorates:
 * `[1]` the decorator options, `[2]` the `export` keyword when present, `[3]`
 * the class name.
 *
 * Doc comments and line comments are allowed to sit between the decorator and
 * the class. Without that, a component carrying the JSDoc this codebase asks
 * for on every public class fell out of the pattern — and therefore out of the
 * required set — with the suite still green. `parses every @Component
 * declaration the barrels reach` now fails loudly on any shape this misses.
 */
const COMPONENT_DECORATOR =
  /@Component\(\{([\s\S]*?)\n\}\)\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*(export\s+)?class\s+(\w+)/g;

/** One publicly exported `@Component` of a `@malva-ui/core` entry point. */
interface PublicComponent {
  /** Class name, e.g. `MlvButton`. */
  readonly name: string;
  /** Entry point directory, e.g. `button` for `@malva-ui/core/button`. */
  readonly entryPoint: string;
  /** Verbatim `selector`, e.g. `button[mlvButton], a[mlvButton]`. */
  readonly selector: string;
}

/** Resolves an `export * from './x'` target to `./x.ts` or `./x/index.ts`. */
const resolveReexport = (fromFile: string, spec: string): string | null => {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

/** Every file reachable from a barrel through `export * from` chains. */
const reachableFiles = (
  entry: string,
  seen = new Set<string>(),
): Set<string> => {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const match of readFileSync(entry, 'utf8').matchAll(
    /export\s+\*\s+(?:as\s+\w+\s+)?from\s+['"](\.[^'"]+)['"]/g,
  )) {
    const target = resolveReexport(entry, match[1]);
    if (target) reachableFiles(target, seen);
  }
  return seen;
};

/** Every file the `libs/core/<entry-point>/src/index.ts` barrels reach, mapped to its entry point. */
const reachableCoreFiles = (): Map<string, string> => {
  const files = new Map<string, string>();

  for (const dir of readdirSync(CORE_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const barrel = join(CORE_ROOT, dir.name, 'src/index.ts');
    if (!existsSync(barrel)) continue;
    for (const file of reachableFiles(barrel)) {
      if (!files.has(file)) files.set(file, dir.name);
    }
  }

  return files;
};

/**
 * The authoritative list of what needs SSR coverage, read out of the workspace
 * so it cannot rot: every class exported from a
 * `libs/core/<entry-point>/src/index.ts` barrel that carries a `@Component`
 * decorator.
 *
 * Directives are deliberately out of scope as a *list*. A directive can reach a
 * browser global exactly as a component can, but the great majority of the
 * library's public directives are template-slot markers (`MlvCardHeaderDef`
 * and friends) that only `inject(TemplateRef)` and own no effect, listener or
 * observer — a host slot each would be noise, not coverage. The behavioural
 * ones ride along in the hosts above, on the elements they decorate.
 */
const readPublicComponents = (): PublicComponent[] => {
  const components: PublicComponent[] = [];

  for (const [file, entryPoint] of reachableCoreFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(COMPONENT_DECORATOR)) {
      if (!match[2]) continue;
      const selector = /selector:\s*'([^']*)'/.exec(match[1])?.[1];
      if (selector) {
        components.push({ name: match[3], entryPoint, selector });
      }
    }
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
};

/** One `@Component(` occurrence found without `COMPONENT_DECORATOR`'s shape assumptions. */
interface DecoratorSite {
  /** Class name that follows the decorator. */
  readonly name: string;
  /** Entry point the file belongs to. */
  readonly entryPoint: string;
  /** Whether it is an exported, non-abstract class, i.e. one that must be parsed. */
  readonly required: boolean;
}

/**
 * Every `@Component(` occurrence in the reachable files, located by a
 * deliberately different and shape-insensitive scan.
 *
 * This is the guard on the guard. `COMPONENT_DECORATOR` under-matching is
 * silent by construction — a component it fails to see simply stops being
 * required, which is the exact failure this suite exists to prevent — so the
 * two counts are compared instead of trusting the one pattern.
 */
const readComponentDecoratorSites = (): DecoratorSite[] => {
  const sites: DecoratorSite[] = [];

  for (const [file, entryPoint] of reachableCoreFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/@Component\s*\(/g)) {
      // Anchored at a line start so prose like `… the class is not yet …`
      // inside a preceding comment cannot be mistaken for the declaration.
      const declaration = /\n\s*(export\s+)?(abstract\s+)?class\s+(\w+)/.exec(
        source.slice(match.index),
      );
      sites.push({
        name: declaration?.[3] ?? '<no class declaration found>',
        entryPoint,
        required: declaration
          ? Boolean(declaration[1]) && !declaration[2]
          : true,
      });
    }
  }

  return sites;
};

/** An SSR host declared in this file, with the template it renders. */
interface DeclaredHost {
  /** Host class name. */
  readonly name: string;
  /** The host's inline template, verbatim. */
  readonly template: string;
  /** Class names listed in the host's own `imports` array. */
  readonly imports: readonly string[];
}

/**
 * The hosts declared in this file, parsed out of its own source.
 *
 * Coverage is read back from the host templates rather than declared in a
 * second array of selectors, because a second array is exactly the
 * hand-maintained list that rots. Template text — not the `imports` array — is
 * the signal, because a class can sit in `imports` while appearing in no
 * template.
 *
 * The template is also a truer signal than the rendered markup: `mlv-tab` is a
 * `display: none` definition node that `mlv-tab-group` reads through
 * `contentChildren` and never projects, so it is constructed on the server —
 * and can therefore fail there — while never reaching the payload.
 *
 * The `imports` array is read too, as the second half of the coverage
 * condition rather than a replacement for the template: a tag written into a
 * host whose class is missing from that host's `imports` is an unknown
 * element. Angular logs `NG0304`, constructs nothing, and reaches no
 * `ErrorHandler` — coverage on paper, none in fact.
 */
const readDeclaredHosts = (): DeclaredHost[] =>
  [...readFileSync(SPEC_FILE, 'utf8').matchAll(COMPONENT_DECORATOR)].map(
    (match) => ({
      name: match[3],
      template: /template:\s*`([\s\S]*?)`/.exec(match[1])?.[1] ?? '',
      imports: [
        ...(/imports:\s*\[([^\]]*)\]/.exec(match[1])?.[1] ?? '').matchAll(
          /[A-Za-z_$][\w$]*/g,
        ),
      ].map((identifier) => identifier[0]),
    }),
  );

/**
 * Whether a component's selector is written into a host template.
 *
 * Element selectors are matched on a token boundary so `mlv-tab` does not match
 * `<mlv-tab-group`; attribute selectors are matched as whole attribute tokens,
 * case-insensitively, so `mlvActionBar` does not match `mlvActionBarLogo`. A
 * selector with several alternatives counts if any one of them is written.
 */
const isWrittenIn = (selector: string, template: string): boolean =>
  selector.split(',').some((alternative) => {
    const trimmed = alternative.trim();
    const tag = /^([a-zA-Z][\w-]*)/.exec(trimmed)?.[1];
    const attributes = [...trimmed.matchAll(/\[([\w-]+)\]/g)].map((m) => m[1]);

    // Neither a tag nor an attribute means nothing to look for, and
    // `[].every()` would return true — silently marking the component covered.
    if (!tag && attributes.length === 0) return false;
    if (tag && !new RegExp(`<${tag}(?=[\\s/>])`, 'i').test(template)) {
      return false;
    }
    return attributes.every((attribute) =>
      new RegExp(`[\\s[]${attribute}(?=[\\s\\]=/>])`, 'i').test(template),
    );
  });

/**
 * Whether one host actually covers a component.
 *
 * Both halves are required, and both are scoped to the *same* host: the tag
 * must be written into that host's template and the class must be listed in
 * that host's `imports`. Checking the union of every host's imports would let
 * a class imported by one host cover a tag written in another, which renders
 * as an unknown element and constructs nothing.
 */
const isCoveredBy = (component: PublicComponent, host: DeclaredHost): boolean =>
  isWrittenIn(component.selector, host.template) &&
  host.imports.includes(component.name);

/**
 * Components deliberately left without an SSR host, each with the reason.
 *
 * A silent skip is the failure mode this suite exists to prevent, so an entry
 * here is a claim the guard checks: it fails on an entry naming a component
 * that no longer exists, on an empty reason, and on an entry for a component a
 * host does in fact render.
 */
const SSR_COVERAGE_EXCLUSIONS: Readonly<Record<string, string>> = {
  MlvDialog:
    'overlay-only: injects DIALOG_CONFIG, provided only by MlvDialogService.open() into a CDK dialog overlay that never attaches on the server.',
  MlvDialogHeader:
    'overlay-only: same DIALOG_CONFIG requirement as mlv-dialog.',
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('@malva-ui/core SSR safety', () => {
  it('server-renders every host without reaching a browser global', async () => {
    const { errors } = await renderAllHosts();

    // `mlv-textarea[autoResize]` measured itself from a `value` effect, which
    // Angular runs during server-side change detection too. It called
    // `getComputedStyle` there and threw on every render — silently, because
    // the markup still came out intact. Markup never proves SSR safety on its
    // own; this is the primary assertion of the suite.
    //
    // That component no longer exercises this assertion. Issue #78 moved its
    // resize onto an `afterRenderEffect`, which never runs on the server, so
    // `_runAutoResize()` is unreachable from here and neutering its
    // `_isBrowser` guard no longer turns this red. (Confirmed both ways: with
    // the guard neutered, this passes on the current implementation and fails
    // on the previous `effect()` one.) The guard itself is asserted directly
    // in `libs/core/textarea/src/lib/textarea/textarea.spec.ts` →
    // "MlvTextarea auto-resize server guard". The assertion below keeps its
    // full value for every *other* host: any component that still measures
    // from a plain `effect` is caught here, which is the class of defect the
    // suite exists for.
    expect(errors).toEqual([]);
  });

  it('binds no property the server DOM does not have', async () => {
    const { logged } = await renderAllHosts();

    // NG0303 is per *instance*, not per template: a data table with a checkbox
    // column logs one line per rendered row. It is also invisible to every
    // browser test, because the check `@angular/core` runs is `propName in
    // element` against the live element — true in a browser, false on domino
    // for any property its DOM classes do not implement (`indeterminate` is
    // the known case; `muted` is #136 and `selected` is #135). Note that
    // swapping such a binding for the `[attr.*]` or static-attribute form is
    // not automatically equivalent — see the `muted` case below.
    //
    // `selected` is not the same trap as `muted`, so do not copy the property
    // write from there without measuring. A *pristine* `<option>` — one whose
    // selectedness has never been set programmatically or by the user — does
    // track its content attribute live (measured in Chrome 152:
    // `createElement('option')` + `setAttribute('selected', '')` reports
    // `selected === true`, moves `selectedIndex` once inside a `<select>`, and
    // goes back to `false` on `removeAttribute`). It stops once that option is
    // dirty, which is the mechanism #135 is about; check which case a call
    // site is in.
    //
    // This assertion is the reason `renderHost` captures `console.error` at
    // all; the `ErrorHandler` never sees this class. Keep it asserting the
    // whole captured list rather than filtering to NG0303 — anything a server
    // render writes to `console.error` is worth a line in the failure.
    expect(
      logged,
      'a server render wrote to console.error. NG0303 means a property ' +
        'binding names something the server DOM does not implement: set that ' +
        'DOM property from an `afterRenderEffect` instead of binding it.',
    ).toEqual([]);
  });

  it('server-renders every chat video muted', async () => {
    const { html } = await renderAllHosts();

    // The visible half of #136, and the reason the NG0303 fix is not simply
    // "delete the binding": the attribute is what makes a server-rendered
    // `<video>` arrive muted before hydration, so an autoplaying gif cell
    // cannot make noise in that window.
    //
    // It is also not, on its own, enough for an element the *client* created.
    // In Chromium and jsdom a `muted` content attribute reaches the live
    // `muted` property only for a parser-created element (measured in Chrome
    // 152: `createElement('video')` + `setAttribute('muted', '')` leaves
    // `muted === false`), which is why `MlvChatMutedVideo` writes the property
    // on creation and why chat-media-grid.spec.ts asserts it. That is an
    // engine divergence in flight, not a spec rule — the HTML Standard now
    // gives media elements a tristate `muted state` the attribute does feed,
    // and Gecko shipped it in Firefox 153 — but this assertion is unaffected
    // either way: the server payload needs the attribute under both models.
    const videos = [...html.matchAll(/<video[^>]*>/g)].map((match) => match[0]);

    expect(
      videos.length,
      'no <video> in the server payload — the chat fixture in SsrDataHost ' +
        'lost its video attachments, so the media grid rendered nothing and ' +
        'every assertion about a server-rendered <video> is now vacuous',
    ).toBeGreaterThan(0);

    expect(
      videos.filter((video) => !/\smuted[\s=>]/.test(video)),
      'these server-rendered <video> elements carry no muted attribute, so ' +
        'they would arrive unmuted in the pre-hydration document',
    ).toEqual([]);
  });

  it('server-renders the checkbox mixed state into the markup', async () => {
    const { html } = await renderAllHosts();

    // The visible half of #124. `[attr.aria-checked]` is an attribute binding,
    // so unlike the property binding beside it, it survives the server render
    // — this pins that down so a future rewrite of the indeterminate plumbing
    // cannot quietly take the tri-state out of the server payload and leave a
    // "select all" header rendering as plain unchecked until hydration.
    expect(
      html.includes('aria-checked="mixed"'),
      'no aria-checked="mixed" in the server markup — the indeterminate ' +
        'checkbox in SsrFormControlsHost did not render its mixed state',
    ).toBe(true);
  });

  it('server-renders each density modifier from the nearest scope', async () => {
    const { html } = await renderAllHosts();

    // #364. Every density-aware component stamps its own modifier through a
    // host `[class]` binding, which the server renders — so the payload
    // already carries the level the nearest scope resolved, not only after
    // hydration. The "Preferences" fieldset is `mlvDensity="compact"` inside a
    // form with no density: its controls follow the fieldset, the controls in
    // the "Contact" fieldset beside it follow the form (the service default).
    const classesOf = (tag: string): string[] =>
      Array.from(
        html.matchAll(new RegExp(`<${tag}(?=[\\s>])[^>]*>`, 'g')),
        (match) => /\sclass="([^"]*)"/.exec(match[0])?.[1] ?? '',
      );

    const radios = classesOf('mlv-radio');
    expect(radios.length, 'no mlv-radio in the payload').toBeGreaterThan(0);
    expect(
      radios.filter((cls) => !cls.includes('mlv-radio--compact')),
      'mlv-radio hosts without the fieldset-scoped compact modifier',
    ).toEqual([]);

    const checkboxes = classesOf('mlv-checkbox');
    expect(checkboxes.length, 'no mlv-checkbox in the payload').toBeGreaterThan(
      0,
    );
    expect(
      checkboxes.filter((cls) => !cls.includes('mlv-checkbox--compact')),
      'mlv-checkbox hosts without the fieldset-scoped compact modifier',
    ).toEqual([]);

    const fieldsets = classesOf('fieldset').filter((cls) =>
      cls.includes('mlv-fieldset'),
    );
    expect(fieldsets.some((cls) => cls.includes('mlv-fieldset--compact'))).toBe(
      true,
    );
    expect(
      fieldsets.some((cls) => cls.includes('mlv-fieldset--comfortable')),
    ).toBe(true);

    // The cascade-only blocks of #364 now stamp too.
    for (const modifier of [
      'mlv-form-control-wrapper--comfortable',
      'mlv-form-control-wrapper--compact',
      'mlv-label--comfortable',
      'mlv-list-item--comfortable',
      'mlv-tab-item--comfortable',
      'mlv-segmented-item--comfortable',
      'mlv-sidebar--comfortable',
      'mlv-page--comfortable',
    ]) {
      expect(html.includes(modifier), `${modifier} not in the payload`).toBe(
        true,
      );
    }
  });

  it('server-renders a consumer id on the checkbox and switch input, not the host', async () => {
    const { html } = await renderAllHosts();

    // #323. The static host `id` is stripped in the constructor, which runs on
    // the server too, and the native input binds `id()` — so the pre-hydration
    // payload names exactly one element per id, and it is the `<input>` the
    // own label wraps. The own label carries no `for`: it names its input by
    // containment, so a duplicate consumer id cannot cross-wire it.
    for (const id of ['ssr-read', 'ssr-email']) {
      const carriers = Array.from(
        html.matchAll(
          new RegExp(`<([a-z-]+)(?=[^>]*\\sid="${id}")[^>]*>`, 'g'),
        ),
        (match) => match[1],
      );
      expect(carriers, `elements carrying id="${id}"`).toEqual(['input']);
      expect(
        new RegExp(`<label[^>]*>\\s*<input(?=[^>]*\\sid="${id}")`).test(html),
        `the input with id="${id}" is not the own label's first child`,
      ).toBe(true);
      expect(
        html.includes(`for="${id}"`),
        `the own label carries for="${id}" in the server markup`,
      ).toBe(false);
    }
  });

  it('server-renders a static search-field role on the native input, not the host', async () => {
    const { html } = await renderAllHosts();

    // #329. A static role="combobox" is fed to the role input and written to
    // the host by Angular; the constructor strips the host copy, and runs on
    // the server too. So the pre-hydration payload carries one combobox, the
    // input, not an unnamed one wrapped around it. The overlay is closed, so
    // no nested mlv-search-field renders and the non-greedy match is exact.
    const field =
      /<mlv-search-field(?=[^>]*\bssr-command-search\b)[\s\S]*?<\/mlv-search-field>/.exec(
        html,
      )?.[0];
    expect(
      field,
      'no static-role mlv-search-field in the server markup — the command ' +
        'search in SsrFormControlsHost did not render',
    ).toBeTruthy();
    const hostTag = /^<mlv-search-field[^>]*>/.exec(field as string)?.[0];
    expect(hostTag, 'the search-field host tag').not.toMatch(/\srole="/);
    const carriers = Array.from(
      (field as string).matchAll(/<([a-z-]+)(?=[^>]*\srole="combobox")[^>]*>/g),
      (match) => match[1],
    );
    expect(carriers, 'elements carrying role="combobox"').toEqual(['input']);
  });

  it('server-renders the native select selection into the markup', async () => {
    const { html } = await renderAllHosts();

    // The visible half of #135. `selected` is a DOM property domino does not
    // implement *and* a content attribute it does, so the property binding
    // that used to be here logged NG0303 and put nothing in the payload: every
    // server-rendered `mlv-select native` shipped with no option selected, and
    // a browser showing the first one until hydration corrected it. The
    // `[attr.selected]` form survives the render — this pins that, so the
    // browser-side property write cannot quietly take the server payload with
    // it again.
    const nativeSelect = /<select[^>]*>[\s\S]*?<\/select>/.exec(html)?.[0];
    expect(
      nativeSelect,
      'no <select> in the server markup — the native mlv-select in ' +
        'SsrFormControlsHost did not render',
    ).toBeTruthy();
    expect(
      /<option[^>]*\bselected[^>]*>\s*Staging\s*<\/option>/.test(
        nativeSelect ?? '',
      ),
      `the committed option is not marked selected in the server markup: ${nativeSelect}`,
    ).toBe(true);
  });

  it('server-renders the form-field label association into the markup', async () => {
    const { html } = await renderAllHosts();

    // #197 resolves the association through an injection token and two content
    // queries, and neither is a browser-only mechanism — so it must land in
    // the pre-hydration payload, not only after hydration. This repo has two
    // recorded SSR regressions of exactly that shape (a domino `instanceof`
    // case and an `effect()` → `afterRenderEffect` one), which is why the
    // assertion is on the rendered attributes rather than on a component
    // fixture. `mlv-form-field` does not nest, so a non-greedy match per
    // field is exact.
    const fields =
      html.match(/<mlv-form-field[\s\S]*?<\/mlv-form-field>/g) ?? [];
    const ids = new Set(
      Array.from(html.matchAll(/\sid="([^"]+)"/g), (match) => match[1]),
    );

    const nativeField = fields.find((field) => field.includes('<input'));
    const resolvedFor = /<label[^>]*\sfor="([^"]+)"/.exec(
      nativeField ?? '',
    )?.[1];
    expect(
      resolvedFor,
      `no resolved <label for> in the native form field: ${nativeField}`,
    ).toBeTruthy();
    expect(
      ids.has(resolvedFor as string),
      `the server payload's <label for="${resolvedFor}"> names no element`,
    ).toBe(true);

    const ariaField = fields.find((field) =>
      field.includes('mlv-select__trigger'),
    );
    const labelledBy = /\saria-labelledby="([^"]+)"/.exec(ariaField ?? '')?.[1];
    expect(
      labelledBy,
      `the select trigger carries no aria-labelledby on the server: ${ariaField}`,
    ).toBeTruthy();
    expect(
      new RegExp(`<label[^>]*\\sid="${labelledBy}"`).test(ariaField ?? ''),
      `aria-labelledby="${labelledBy}" names no <label> in the same field`,
    ).toBe(true);
  });

  it('server-renders native="auto" as the native <select>, named by the field label', async () => {
    const { html } = await renderAllHosts();

    // #218. `native="auto"` chooses between two DOM trees from the viewport,
    // and the label association follows the choice. The server cannot know the
    // viewport, so it renders the native control — a working picker before any
    // JavaScript runs — and a hydrating client's *first* render produces the
    // same branch; only after that render does a hydrating desktop client
    // switch to the trigger. `mlv-form-field` does not nest, so a non-greedy
    // match per field is exact.
    const autoField = (
      html.match(/<mlv-form-field[\s\S]*?<\/mlv-form-field>/g) ?? []
    ).find((field) => /<mlv-select[^>]*\snative="auto"/.test(field));
    expect(
      autoField,
      'no native="auto" select inside a form field in the server markup — ' +
        'the Zone field in SsrFormControlsHost did not render',
    ).toBeTruthy();
    const field = autoField as string;

    const host = /<mlv-select[^>]*>/.exec(field)?.[0] ?? '';
    expect(
      host,
      `native="auto" did not render its native branch on the server: ${field}`,
    ).toContain('mlv-select--native');
    const selectId = /<select[^>]*\sid="([^"]+)"/.exec(field)?.[1];
    expect(
      selectId,
      `no native <select> with an id for native="auto" on the server: ${field}`,
    ).toBeTruthy();

    const label = /<label[^>]*>/.exec(field)?.[0] ?? '';
    expect(
      label,
      `the field label does not name the native <select> on the server: ${label}`,
    ).toContain(`for="${selectId}"`);

    const trigger = /<div[^>]*class="mlv-select__trigger[^"]*"[^>]*>/.exec(
      field,
    )?.[0];
    expect(
      trigger,
      `no hidden trigger in the server markup: ${field}`,
    ).toBeTruthy();
    expect(
      /\saria-labelledby="/.test(trigger as string),
      `the hidden trigger is labelled on the server: ${trigger}`,
    ).toBe(false);
    // The id belongs to the <select> alone — not duplicated onto the hidden
    // trigger, and not the string "null" a property write of `null` leaves.
    expect(
      /\sid="/.test(trigger as string),
      `the hidden trigger carries an id on the server: ${trigger}`,
    ).toBe(false);
  });

  it('server-renders a disabled anchor button out of the tab order, with no disabled attribute', async () => {
    const { html } = await renderAllHosts();

    // #460. An anchor has no disabled state, so a disabled `a[mlvButton]`
    // (not a merely loading one, #324) leaves the tab order through
    // `tabindex="-1"`, which `MlvButton` writes
    // from an `effect()` rather than a host binding. It has to be an effect
    // that runs on the server, not an `afterRenderEffect`, or the
    // pre-hydration document hands a keyboard user a live tab stop onto a
    // link that goes nowhere once JavaScript arrives.
    const anchor = /<a\b[^>]*\shref="\/billing"[^>]*>/.exec(html)?.[0];
    expect(
      anchor,
      'no disabled a[mlvButton] in the server markup — the Billing anchor in ' +
        'SsrNavigationHost did not render',
    ).toBeTruthy();
    expect(anchor).toContain('tabindex="-1"');
    expect(anchor).toContain('aria-disabled="true"');
    expect(
      /\sdisabled(=|\s|>)/.test(anchor as string),
      `the server-rendered anchor carries the invalid disabled attribute: ${anchor}`,
    ).toBe(false);
  });

  it('server-renders an info alert as a polite status region', async () => {
    const { html } = await renderAllHosts();

    // #333. The live role follows the tone — `status` for info / success,
    // `alert` for warning / danger — through a host binding over a
    // `computed`, so the pre-hydration document must already carry it, and
    // no explicit `aria-live` that would contradict it.
    const open = (html.match(/<mlv-alert\b[^>]*>/g) ?? []).find((tag) =>
      tag.includes('mlv-alert--tone-info'),
    );
    expect(
      open,
      'no info mlv-alert in the server markup — SsrDisplayHost did not render it',
    ).toBeTruthy();
    expect(open).toContain('role="status"');
    expect(
      /\saria-live="/.test(open as string),
      `the server-rendered alert carries aria-live: ${open}`,
    ).toBe(false);
  });

  it('server-renders a projected progress label as the progressbar name', async () => {
    const { html } = await renderAllHosts();

    // #258. The projected label names the progressbar through
    // `aria-labelledby`, decided by reading the label wrapper's text. That read
    // runs in `ngAfterViewChecked`, which the server executes too — an
    // `afterEveryRender`-only read would ship the i18n "Progress" in the
    // pre-hydration document. `mlv-progress` does not nest, so a non-greedy
    // match per element is exact.
    const progress = (
      html.match(/<mlv-progress[\s\S]*?<\/mlv-progress>/g) ?? []
    ).find((markup) => markup.includes('Uploading files'));
    expect(
      progress,
      'no projected progress label in the server markup — the labelled ' +
        'mlv-progress in SsrDisplayHost did not render its content',
    ).toBeTruthy();
    const markup = progress as string;
    const open = /<mlv-progress[^>]*>/.exec(markup)?.[0] ?? '';
    const labelledBy = /\saria-labelledby="([^"]+)"/.exec(open)?.[1];
    expect(
      labelledBy,
      `the server-rendered progressbar is not labelled by its label: ${open}`,
    ).toBeTruthy();
    expect(
      /\saria-label="/.test(open),
      `the server-rendered progressbar also carries aria-label: ${open}`,
    ).toBe(false);
    expect(
      new RegExp(
        `<div[^>]*\\sid="${labelledBy}"[^>]*>\\s*Uploading files\\s*</div>`,
      ).test(markup),
      `aria-labelledby="${labelledBy}" does not name the visible label: ${markup}`,
    ).toBe(true);
  });

  it('server-renders the virtual data table row probe, hidden and unmeasured', async () => {
    const { html } = await renderAllHosts();

    // #363. The virtual table strides by the measured height of a probe sized
    // `var(--mlv-dt-row-height)`. The server measures nothing (no
    // ResizeObserver, and the viewport attaches no scroll strategy there), so
    // the probe must ship as the same empty, hidden element the client claims
    // at hydration — one per virtual table with `rowHeight` unset (a bound
    // `rowHeight` wins and renders none), none on the plain one.
    const probes =
      html.match(
        /<div[^>]*class="mlv-data-table__row-probe"[^>]*>[^<]*<\/div>/g,
      ) ?? [];
    expect(
      probes.length,
      'expected exactly one row probe — SsrDataHost renders one virtual ' +
        'mlv-data-table with no rowHeight and one non-virtual one',
    ).toBe(1);
    const probe = probes[0];
    expect(probe).toContain('aria-hidden="true"');
    expect(
      probe,
      `the server wrote a style onto the probe: ${probe}`,
    ).not.toContain('style=');
    expect(/>\s*<\/div>$/.test(probe), `the probe is not empty: ${probe}`).toBe(
      true,
    );
  });

  it('server-renders a copy-to-clipboard named by ids that resolve in the payload', async () => {
    const { html } = await renderAllHosts();

    // #326. With no `value`, the host's `aria-labelledby` names the host
    // itself — whose `aria-label` is the prefix — then the projected content.
    // Both ids are generated in a field initializer, so the pre-hydration
    // document must carry the host's own id and the content node — a dangling
    // id names nothing. The copy does not nest, so a non-greedy match per
    // element is exact.
    const copy = (
      html.match(/<mlv-copy-to-clipboard[\s\S]*?<\/mlv-copy-to-clipboard>/g) ??
      []
    ).find((markup) => markup.includes('sk_live_abc123xyz'));
    expect(
      copy,
      'no mlv-copy-to-clipboard in the server markup — SsrDisplayHost did ' +
        'not render it',
    ).toBeTruthy();
    const markup = copy as string;
    const open = /<mlv-copy-to-clipboard[^>]*>/.exec(markup)?.[0] ?? '';
    const ids = (/\saria-labelledby="([^"]+)"/.exec(open)?.[1] ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(ids.length, `aria-labelledby on ${open}`).toBe(2);
    const [hostId, contentId] = ids;
    expect(
      new RegExp(`\\sid="${hostId}"`).test(open),
      `aria-labelledby does not start with the host's own id: ${open}`,
    ).toBe(true);
    expect(
      /\saria-label="[^"]+:"/.test(open),
      `the server-rendered copy host carries no prefix aria-label: ${open}`,
    ).toBe(true);
    expect(
      new RegExp(
        `<span[^>]*\\sid="${contentId}"[^>]*>\\s*sk_live_abc123xyz\\s*</span>`,
      ).test(markup),
      `id="${contentId}" does not wrap the projected text: ${markup}`,
    ).toBe(true);
    expect(
      markup
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, '')
        .trim(),
      'the prefix reached the host text, and every ancestor textContent',
    ).toBe('sk_live_abc123xyz');
  });

  it('server-renders the stepper name on the tablist, not the roleless host', async () => {
    const { html } = await renderAllHosts();

    // #326. The `ariaLabel` input binds on the `role="tablist"` element, and a
    // static host `aria-label` is stripped in the constructor — which runs on
    // the server too — and moved to the tablist. A strip moved into a hook the
    // server never runs would ship a prohibited host attribute.
    const steppers = html.match(/<mlv-stepper[\s\S]*?<\/mlv-stepper>/g) ?? [];
    for (const name of ['Account setup', 'Checkout']) {
      const markup = steppers.find((stepper) =>
        new RegExp(
          `<div(?=[^>]*\\srole="tablist")(?=[^>]*\\saria-label="${name}")[^>]*>`,
        ).test(stepper),
      );
      expect(
        markup,
        `no server-rendered tablist named "${name}" in: ${steppers.join('\n')}`,
      ).toBeTruthy();
      const open = /<mlv-stepper[^>]*>/.exec(markup as string)?.[0] ?? '';
      expect(
        /\saria-label="/.test(open),
        `the server-rendered stepper host carries aria-label: ${open}`,
      ).toBe(false);
    }
  });

  it('server-renders a projected divider label as the separator name', async () => {
    const { html } = await renderAllHosts();

    // #332. `role="separator"` takes its name from the author only, so the
    // projected "OR" names the separator through `aria-labelledby` onto the
    // label wrapper. Both are plain bindings, so the pre-hydration document
    // must already carry them. `mlv-divider` does not nest, so a non-greedy
    // match per element is exact.
    const divider = (
      html.match(/<mlv-divider[\s\S]*?<\/mlv-divider>/g) ?? []
    ).find((markup) => />\s*OR\s*</.test(markup));
    expect(
      divider,
      'no labelled divider in the server markup — the `OR` mlv-divider in ' +
        'SsrShellHost did not render its content',
    ).toBeTruthy();
    const markup = divider as string;
    const open = /<mlv-divider[^>]*>/.exec(markup)?.[0] ?? '';
    expect(open).toContain('role="separator"');
    const labelledBy = /\saria-labelledby="([^"]+)"/.exec(open)?.[1];
    expect(
      labelledBy,
      `the server-rendered separator is not labelled by its label: ${open}`,
    ).toBeTruthy();
    expect(
      new RegExp(`<span[^>]*\\sid="${labelledBy}"[^>]*>\\s*OR\\s*</span>`).test(
        markup,
      ),
      `aria-labelledby="${labelledBy}" does not name the visible label: ${markup}`,
    ).toBe(true);
  });

  it('server-renders a divider named through its ariaLabel input', async () => {
    const { html } = await renderAllHosts();

    // #332. `ariaLabel` is written by an `effect()`, not a host binding (a host
    // `[attr.aria-label]` would wipe a consumer's own on the first render), so
    // this pins that the effect runs on the server: the pre-hydration document
    // carries the name, and no `aria-labelledby` onto the label outranks it.
    const open = /<mlv-divider[^>]*>(?=\s*<span[^>]*>\s*AND\s*<\/span>)/.exec(
      html,
    )?.[0];
    expect(
      open,
      'no `AND` mlv-divider in the server markup — SsrShellHost did not ' +
        'render it',
    ).toBeTruthy();
    expect(open).toContain('aria-label="Combine conditions"');
    expect(open).not.toContain('aria-labelledby');
  });

  it('server-renders each host into markup', async () => {
    const { html } = await renderAllHosts();

    // The host's own root tag comes from the `document` string handed to
    // `renderApplication`, so it is in the payload whether or not the template
    // rendered anything. Only its *content* is evidence, which is why this
    // asserts on what is between the tags rather than on the tag.
    const empty = SSR_HOSTS.filter((entry) => {
      const rendered = new RegExp(
        `<${entry.selector}[^>]*>([\\s\\S]*?)</${entry.selector}>`,
      ).exec(html);
      return (rendered?.[1].trim().length ?? 0) === 0;
    }).map((entry) => entry.selector);

    expect(empty, 'these hosts produced no server markup at all').toEqual([]);
  });

  it('covers every publicly exported component', () => {
    const hosts = readDeclaredHosts();

    const uncovered = readPublicComponents()
      .filter((component) => !(component.name in SSR_COVERAGE_EXCLUSIONS))
      .filter(
        (component) => !hosts.some((host) => isCoveredBy(component, host)),
      )
      .map(
        (component) =>
          `${component.name} (@malva-ui/core/${component.entryPoint})`,
      );

    expect(
      uncovered,
      `${uncovered.length} public component(s) have no SSR host. Write each ` +
        `one into a host template in this file, or add it to ` +
        `SSR_COVERAGE_EXCLUSIONS with the reason it cannot have one.`,
    ).toEqual([]);
  });

  it('parses every @Component declaration the barrels reach', () => {
    const parsed = new Set(
      readPublicComponents().map((component) => component.name),
    );

    const unparsed = readComponentDecoratorSites()
      .filter((site) => site.required && !parsed.has(site.name))
      .map((site) => `${site.name} (@malva-ui/core/${site.entryPoint})`)
      .sort();

    expect(
      unparsed,
      'COMPONENT_DECORATOR did not recognise these exported @Component ' +
        'declarations, so they dropped out of the required set without any ' +
        'test going red. Widen the pattern to cover the shape they are ' +
        'written in — a comment between the decorator and the class is the ' +
        'usual cause — rather than leaving them unparsed.',
    ).toEqual([]);
  });

  it('renders every host it declares', () => {
    expect(
      readDeclaredHosts()
        .map((host) => host.name)
        .sort(),
      'a host declared in this file is missing from SSR_HOSTS, so nothing ' +
        'renders it and everything in its template is uncovered',
    ).toEqual(SSR_HOSTS.map((entry) => entry.component.name).sort());
  });

  it('keeps the exclusion list honest', () => {
    const components = readPublicComponents();
    const known = new Set(components.map((component) => component.name));
    const hosts = readDeclaredHosts();

    expect(
      Object.keys(SSR_COVERAGE_EXCLUSIONS)
        .filter((name) => !known.has(name))
        .sort(),
      'exclusions naming components that no longer exist',
    ).toEqual([]);

    expect(
      Object.entries(SSR_COVERAGE_EXCLUSIONS)
        .filter(([, reason]) => reason.trim().length === 0)
        .map(([name]) => name),
      'every exclusion carries a one-line reason',
    ).toEqual([]);

    expect(
      components
        .filter((component) => component.name in SSR_COVERAGE_EXCLUSIONS)
        .filter((component) =>
          hosts.some((host) => isCoveredBy(component, host)),
        )
        .map((component) => component.name),
      'these are covered after all — drop their exclusion entries',
    ).toEqual([]);
  });

  it('renders no overlay markup on the server', async () => {
    const { html } = await renderAllHosts();

    // Overlays attach to the document body from a browser-only code path. Any
    // of these in the server payload means an overlay was created during SSR.
    expect(html).not.toContain('cdk-overlay-container');
    expect(html).not.toContain('cdk-overlay-backdrop');
  });

  it('server-renders open surfaces with no browser instance globals', async () => {
    const { html, errors, logged } = await withoutBrowserGlobals(() =>
      renderHost({
        component: SsrOpenSurfacesHost,
        selector: 'mlv-ssr-open-surfaces-host',
      }),
    );

    // Before #337: `requestAnimationFrame is not defined` from the presence
    // directive, routed to the ErrorHandler on every render. (In Node the
    // drawer and the search field threw `document is not defined` too; this
    // harness cannot take `document` away — see NODE_ABSENT_GLOBALS.)
    expect(errors).toEqual([]);
    expect(logged).toEqual([]);
    // The overlay hosts build nothing on the server; the client opens them.
    expect(html).toContain('<mlv-drawer');
    expect(html).not.toContain('Open drawer content');
    expect(html).not.toContain('cdk-overlay-container');
    // The presence view renders in its final state, no enter class in the
    // payload. (The hydrating client still adds one to the claimed view, so
    // it fades in once after hydration — a tracked follow-up.)
    expect(html).toMatch(/<p class="ssr-presence"[^>]*>Shown<\/p>/);
  });

  it('writes no NaN into the server payload', async () => {
    const { html } = await renderAllHosts();

    // A component that measures the viewport during construction resolves
    // `undefined` on the server and serialises `NaN` into a style or attribute.
    // That is not an exception, so the ErrorHandler never sees it.
    expect(
      [...html.matchAll(/[^\s"'=]*NaN[^\s"']*/g)].map((match) => match[0]),
      'server markup contains NaN values',
    ).toEqual([]);
  });
});

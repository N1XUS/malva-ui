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
import { MlvAccordion, MlvAccordionItem } from '@malva-ui/core/accordion';
import {
  MlvActionBar,
  MlvActionBarLogo,
  MlvActionBarSpacer,
} from '@malva-ui/core/action-bar';
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
import { MlvCalendar } from '@malva-ui/core/calendar';
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
import { MlvKbd, type MlvKbdKey } from '@malva-ui/core/kbd';
import { MlvLayout } from '@malva-ui/core/layout';
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
 * assertion of this suite is therefore the collected `ErrorHandler` entries,
 * not the markup.
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
        <mlv-form-field>
          <mlv-label for="ssr-name"
            >Name <mlv-hint>required</mlv-hint></mlv-label
          >
          <mlv-input label="Name" [(value)]="text" />
          <mlv-description>Shown on your public profile.</mlv-description>
          <mlv-message state="error">This field is required.</mlv-message>
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
        <mlv-combobox label="City" [options]="options" [(value)]="option" />
        <mlv-number-input label="Quantity" [(value)]="quantity" />
        <mlv-search-field [(value)]="query" />
        <mlv-pin-input label="One-time code" [length]="4" [(value)]="pin" />
        <mlv-rating [(value)]="stars" />
        <mlv-slider [min]="0" [max]="10" [(value)]="level" />
      </fieldset>

      <fieldset mlvFieldset legend="Preferences">
        <mlv-switch-group label="Alerts">
          <mlv-switch label="Email" [(checked)]="toggled" />
        </mlv-switch-group>

        <mlv-checkbox-group label="Permissions">
          <mlv-checkbox label="Read" [(checked)]="toggled" />
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
  readonly option = signal<string | null>('prod');
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
    MlvDayPicker,
    MlvTimePicker,
    MlvDateRangePicker,
    MlvColorPicker,
    MlvColorPickerPopup,
    MlvFilter,
    MlvSmartFilterBar,
  ],
  template: `
    <mlv-calendar [(value)]="day" />
    <mlv-day-picker label="Date" [(value)]="day" />
    <mlv-time-picker label="Start" [(value)]="time" />
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
    MlvActionBarSpacer,
    MlvBreadcrumb,
    MlvBreadcrumbItem,
    MlvBottomNav,
    MlvToolbar,
    MlvToolbarSpacer,
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
      <span mlvActionBarSpacer></span>
      <button mlvButton>Sign in</button>
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

    <mlv-pagination [totalItems]="120" [(currentPage)]="page" />

    <mlv-list>
      <mlv-list-item><a mlvListItemLink href="/a">Item A</a></mlv-list-item>
      <mlv-list-item>Item B</mlv-list-item>
    </mlv-list>
    <mlv-list-item-group label="Recent"
      ><p>Grouped rows</p></mlv-list-item-group
    >

    <a mlvLink href="/docs">Docs</a>

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
  readonly page = signal(1);
}

@Component({
  selector: 'mlv-ssr-shell-host',
  imports: [
    MlvLayout,
    MlvPageShell,
    MlvPage,
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
    <mlv-layout>
      <mlv-page-shell>
        <mlv-sidebar ariaLabel="Primary navigation">
          <mlv-sidebar-workspace
            [workspaces]="workspaces"
            [(workspace)]="workspace"
          />
          <div mlvSidebarContent>
            <mlv-sidebar-trigger />
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
            <mlv-page-summary-item label="Owner"
              >Design systems</mlv-page-summary-item
            >
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
    </mlv-layout>
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
  readonly messages: MlvChatMessageData[] = [
    { id: 'm1', authorId: 'me', text: 'Hello', timestamp: new Date(0) },
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
];

/** Server-renders one host, collecting everything that reaches the `ErrorHandler`. */
const renderHost = async (
  entry: SsrHostEntry,
): Promise<{ html: string; errors: string[] }> => {
  const errors: string[] = [];
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
  return { html, errors };
};

/** Renders every host once. Memoised so the suite pays for one pass. */
let renderedHosts: Promise<{ html: string; errors: string[] }> | null = null;
const renderAllHosts = (): Promise<{ html: string; errors: string[] }> => {
  renderedHosts ??= (async () => {
    const parts: string[] = [];
    const errors: string[] = [];
    for (const entry of SSR_HOSTS) {
      const result = await renderHost(entry);
      parts.push(result.html);
      errors.push(...result.errors);
    }
    return { html: parts.join('\n'), errors };
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
  MlvDrawerSection:
    'overlay-only: injects MlvDrawerSectionsService, provided only by mlv-drawer, and rendered only inside the drawer overlay content template.',
  MlvDrawerSections:
    'overlay-only: same MlvDrawerSectionsService requirement as [mlvDrawerSection].',
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
    expect(errors).toEqual([]);
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

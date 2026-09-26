## 0.2.0 (2026-09-26)

### 🚀 Features

- **compare:** add mlv-compare before/after comparison surface ([#104](https://github.com/N1XUS/malva-ui/pull/104))
- **core:** dedicated mobile calendar sheet for both date pickers ([#149](https://github.com/N1XUS/malva-ui/pull/149))
- **core:** ship page-view-transitions.css and export the styles folder ([#403](https://github.com/N1XUS/malva-ui/pull/403), [#310](https://github.com/N1XUS/malva-ui/issues/310))
- **docs:** add the data-at-scale showcase over 100,000 generated rows ([#105](https://github.com/N1XUS/malva-ui/pull/105))
- **docs,action-bar:** StackBlitz playground, live example container, density-aware bar ([#25](https://github.com/N1XUS/malva-ui/pull/25), [#241](https://github.com/N1XUS/malva-ui/pull/241))
- ⚠️  **editor:** add height and toolbar placement inputs; uncapped editors grow ([#478](https://github.com/N1XUS/malva-ui/pull/478), [#416](https://github.com/N1XUS/malva-ui/issues/416))
- **editor:** turn the floating toolbar into a selection bubble ([#541](https://github.com/N1XUS/malva-ui/pull/541), [#483](https://github.com/N1XUS/malva-ui/issues/483))
- ⚠️  **editor:** render no toolbar while the editor is readonly ([#573](https://github.com/N1XUS/malva-ui/pull/573), [#498](https://github.com/N1XUS/malva-ui/issues/498))
- **i18n:** accept the language-pack shape the published package actually emits ([#244](https://github.com/N1XUS/malva-ui/pull/244))
- **i18n:** deprecate the AI translation API and remove the client-side key example ([#401](https://github.com/N1XUS/malva-ui/pull/401), [#292](https://github.com/N1XUS/malva-ui/issues/292))
- **menu:** open mlv-menu at the cursor with mlvContextMenuTrigger ([#106](https://github.com/N1XUS/malva-ui/pull/106))
- ⚠️  **page:** rebuild mlv-page on a measured geometry contract, add mlv-items-more ([#275](https://github.com/N1XUS/malva-ui/pull/275))
- **scheduler:** add @malva-ui/scheduler with month, week and day views ([#157](https://github.com/N1XUS/malva-ui/pull/157))
- **scheduler:** add context menus for cells and events ([#161](https://github.com/N1XUS/malva-ui/pull/161), [#166](https://github.com/N1XUS/malva-ui/pull/166))
- **speed-dial:** add mlv-speed-dial ([#101](https://github.com/N1XUS/malva-ui/pull/101))
- **swipe-actions:** iOS-style swipe-to-reveal actions for list rows ([#162](https://github.com/N1XUS/malva-ui/pull/162), [#169](https://github.com/N1XUS/malva-ui/pull/169))
- **taskboard:** add mlv-taskboard (kanban) component ([#187](https://github.com/N1XUS/malva-ui/pull/187))
- **tree,data-table,list,sidebar:** paint selection with the selected-state tokens ([#457](https://github.com/N1XUS/malva-ui/pull/457), [#304](https://github.com/N1XUS/malva-ui/issues/304))

### 🩹 Fixes

- regenerate yarn.lock for the workspace manifests #246 changed ([#255](https://github.com/N1XUS/malva-ui/pull/255), [#246](https://github.com/N1XUS/malva-ui/issues/246))
- release through dedicated GitHub App and add PR bot ([#593](https://github.com/N1XUS/malva-ui/pull/593))
- ⚠️  **accessibility:** emit MlvClick once per activation on native buttons and links ([#421](https://github.com/N1XUS/malva-ui/pull/421), [#299](https://github.com/N1XUS/malva-ui/issues/299))
- **autocomplete:** name the suggestion listbox after the field it belongs to ([#251](https://github.com/N1XUS/malva-ui/pull/251))
- ⚠️  **avatar:** name initials-only avatars, retry images on a new src ([#584](https://github.com/N1XUS/malva-ui/pull/584), [#334](https://github.com/N1XUS/malva-ui/issues/334))
- ⚠️  **avatar-group,popup:** keep the +N counter out of an interactive host ([#557](https://github.com/N1XUS/malva-ui/pull/557), [#328](https://github.com/N1XUS/malva-ui/issues/328))
- **breadcrumb:** keep the collapsed trail in document order ([#475](https://github.com/N1XUS/malva-ui/pull/475), [#316](https://github.com/N1XUS/malva-ui/issues/316))
- **breadcrumb:** render projected separators and stop nesting lists ([#547](https://github.com/N1XUS/malva-ui/pull/547), [#325](https://github.com/N1XUS/malva-ui/issues/325))
- ⚠️  **button:** block a disabled a[mlvButton] and drop its tab stop ([#490](https://github.com/N1XUS/malva-ui/pull/490), [#460](https://github.com/N1XUS/malva-ui/issues/460))
- ⚠️  **button:** keep focus and tab stop on a loading button ([#533](https://github.com/N1XUS/malva-ui/pull/533), [#324](https://github.com/N1XUS/malva-ui/issues/324))
- **cdk:** resolve arrow-key mirroring per element, not per document ([#147](https://github.com/N1XUS/malva-ui/pull/147), [#152](https://github.com/N1XUS/malva-ui/pull/152))
- **cdk,list:** correct two Mlv-prefix exportAs stragglers and pin the resize service's contract (#15, #172) ([#171](https://github.com/N1XUS/malva-ui/pull/171), [#15](https://github.com/N1XUS/malva-ui/issues/15), [#172](https://github.com/N1XUS/malva-ui/issues/172))
- **checkbox:** write input.indeterminate from an afterRenderEffect ([#134](https://github.com/N1XUS/malva-ui/pull/134))
- ⚠️  **checkbox,switch:** put a consumer id on the native input ([#542](https://github.com/N1XUS/malva-ui/pull/542), [#323](https://github.com/N1XUS/malva-ui/issues/323))
- **ci:** let a ROLLOUT_PENDING entry record the states it still owes ([#270](https://github.com/N1XUS/malva-ui/pull/270))
- **color-picker:** keep the hue across achromatic values ([#479](https://github.com/N1XUS/malva-ui/pull/479), [#315](https://github.com/N1XUS/malva-ui/issues/315))
- **core:** remove three browser globals from SSR render paths ([#122](https://github.com/N1XUS/malva-ui/pull/122))
- **core:** floor the dropdown panel at its trigger instead of pinning it ([#150](https://github.com/N1XUS/malva-ui/pull/150), [#153](https://github.com/N1XUS/malva-ui/pull/153))
- **core:** drop eight unused standalone imports flagged by NG8113 ([#210](https://github.com/N1XUS/malva-ui/pull/210), [#212](https://github.com/N1XUS/malva-ui/pull/212))
- ⚠️  **core:** declare the @angular/router peer nine entry points already need ([#246](https://github.com/N1XUS/malva-ui/pull/246))
- ⚠️  **core:** stop emitting a label `for` that names no labelable element ([#261](https://github.com/N1XUS/malva-ui/pull/261))
- ⚠️  **core:** let a form field resolve the checkbox and switch groups, and name them ([#266](https://github.com/N1XUS/malva-ui/pull/266))
- **data-source:** sink nullish rows and give non-finite numbers a total order ([#118](https://github.com/N1XUS/malva-ui/pull/118))
- **data-table:** memoize cell styles for every declared column ([#17](https://github.com/N1XUS/malva-ui/pull/17), [#167](https://github.com/N1XUS/malva-ui/pull/167))
- ⚠️  **data-table:** key row edits by row identity and stop copying rows to flatten the tree ([#420](https://github.com/N1XUS/malva-ui/pull/420))
- **date-range-picker:** show consecutive months in the two panels ([#140](https://github.com/N1XUS/malva-ui/pull/140))
- **date-range-picker:** show one month in the mobile full-screen sheet ([#145](https://github.com/N1XUS/malva-ui/pull/145))
- **drawer:** rebuild the header as a component with a built-in close ([#139](https://github.com/N1XUS/malva-ui/pull/139))
- **drawer:** give section-menu rows the menuitem role and a keyboard path ([#249](https://github.com/N1XUS/malva-ui/pull/249))
- ⚠️  **drawer:** render service and routable drawers in the component shell ([#449](https://github.com/N1XUS/malva-ui/pull/449), [#305](https://github.com/N1XUS/malva-ui/issues/305))
- **dropdown:** render one keyboard mark in both dropdown focus modes ([#108](https://github.com/N1XUS/malva-ui/pull/108))
- **dropdown:** lift the sticky group header above a focused option row ([#114](https://github.com/N1XUS/malva-ui/pull/114))
- **dropdown:** let the option panel fall back to an end-aligned position ([#154](https://github.com/N1XUS/malva-ui/pull/154), [#165](https://github.com/N1XUS/malva-ui/pull/165))
- **dropdown:** accept options whose label or value is falsy ([#417](https://github.com/N1XUS/malva-ui/pull/417))
- ⚠️  **editor:** raise the Tiptap peer floor to 3.31 for three security advisories ([#405](https://github.com/N1XUS/malva-ui/pull/405), [#291](https://github.com/N1XUS/malva-ui/issues/291))
- **editor:** dim the dragged block and draw the drop line in the gap ([#500](https://github.com/N1XUS/malva-ui/pull/500), [#482](https://github.com/N1XUS/malva-ui/issues/482))
- ⚠️  **editor:** keep the author's image alt and finish the upload status ([#567](https://github.com/N1XUS/malva-ui/pull/567), [#448](https://github.com/N1XUS/malva-ui/issues/448))
- **file-upload:** replace the current file in single mode ([#464](https://github.com/N1XUS/malva-ui/pull/464), [#313](https://github.com/N1XUS/malva-ui/issues/313))
- ⚠️  **filter,i18n:** name each condition control by field, row and role ([#579](https://github.com/N1XUS/malva-ui/pull/579), [#330](https://github.com/N1XUS/malva-ui/issues/330))
- **form-utils:** associate a projected mlv-label with the control it labels ([#197](https://github.com/N1XUS/malva-ui/pull/197), [#215](https://github.com/N1XUS/malva-ui/pull/215))
- ⚠️  **form-utils:** drop the vitest import from the published testing entry point ([#260](https://github.com/N1XUS/malva-ui/pull/260))
- **form-utils:** block value writes while a control is readonly or disabled ([#404](https://github.com/N1XUS/malva-ui/pull/404), [#298](https://github.com/N1XUS/malva-ui/issues/298))
- **form-utils:** gate the clear button on write permission and wire it on every clearable control ([#440](https://github.com/N1XUS/malva-ui/pull/440), [#301](https://github.com/N1XUS/malva-ui/issues/301))
- **form-utils:** keep a tab stop in groups whose first item is disabled ([#445](https://github.com/N1XUS/malva-ui/pull/445), [#307](https://github.com/N1XUS/malva-ui/issues/307))
- ⚠️  **form-utils:** expose toggle validation state and the field error ([#504](https://github.com/N1XUS/malva-ui/pull/504), [#320](https://github.com/N1XUS/malva-ui/issues/320))
- ⚠️  **form-utils:** report touched when focus leaves the control ([#553](https://github.com/N1XUS/malva-ui/pull/553), [#347](https://github.com/N1XUS/malva-ui/issues/347))
- ⚠️  **i18n:** format plurals and dates with the active language pack's locale ([#434](https://github.com/N1XUS/malva-ui/pull/434), [#306](https://github.com/N1XUS/malva-ui/issues/306))
- **input:** render the projected control in the wrapped shape ([#262](https://github.com/N1XUS/malva-ui/pull/262))
- **items-more:** hand focus on when a split removes the focused box ([#550](https://github.com/N1XUS/malva-ui/pull/550), [#327](https://github.com/N1XUS/malva-ui/issues/327))
- ⚠️  **kbd:** read shortcuts by key name, not a prohibited aria-label ([#574](https://github.com/N1XUS/malva-ui/pull/574), [#331](https://github.com/N1XUS/malva-ui/issues/331))
- ⚠️  **link:** block a disabled routerLink and let enabled links activate ([#465](https://github.com/N1XUS/malva-ui/pull/465), [#309](https://github.com/N1XUS/malva-ui/issues/309))
- ⚠️  **list:** coerce the group's open attribute and drop the toggler inset pins ([#253](https://github.com/N1XUS/malva-ui/pull/253))
- ⚠️  **list:** take collapsed group content out of the tab order and the a11y tree ([#264](https://github.com/N1XUS/malva-ui/pull/264))
- ⚠️  **list:** derive the item group's ARIA from the enclosing list's role ([#274](https://github.com/N1XUS/malva-ui/pull/274), [#224](https://github.com/N1XUS/malva-ui/issues/224))
- **page:** measure snap regions from their content, not the clamped box ([#486](https://github.com/N1XUS/malva-ui/pull/486), [#317](https://github.com/N1XUS/malva-ui/issues/317))
- **popup:** resolve the full-screen mode once per open (#126, #144) ([#151](https://github.com/N1XUS/malva-ui/pull/151), [#126](https://github.com/N1XUS/malva-ui/issues/126), [#144](https://github.com/N1XUS/malva-ui/issues/144))
- **popup:** mirror the arrow edge and alignment in RTL ([#163](https://github.com/N1XUS/malva-ui/pull/163), [#184](https://github.com/N1XUS/malva-ui/pull/184))
- ⚠️  **popup:** anchor every open to a live trigger, not a destroyed one ([#237](https://github.com/N1XUS/malva-ui/pull/237))
- ⚠️  **popup:** release a container trigger's registration when the trigger is destroyed ([#284](https://github.com/N1XUS/malva-ui/pull/284), [#230](https://github.com/N1XUS/malva-ui/issues/230))
- ⚠️  **popup:** give full-screen sheets dialog semantics ([#562](https://github.com/N1XUS/malva-ui/pull/562), [#322](https://github.com/N1XUS/malva-ui/issues/322))
- **popup,overlay,drawer:** ignore animation end events bubbling out of panel content ([#280](https://github.com/N1XUS/malva-ui/pull/280), [#231](https://github.com/N1XUS/malva-ui/issues/231))
- ⚠️  **popup,tooltip:** mirror the inline position offset in RTL ([#265](https://github.com/N1XUS/malva-ui/pull/265))
- ⚠️  **progress:** render the label in both shapes and name the progressbar ([#508](https://github.com/N1XUS/malva-ui/pull/508), [#258](https://github.com/N1XUS/malva-ui/issues/258))
- **rating:** paint the half star on the side the hit test chose ([#148](https://github.com/N1XUS/malva-ui/pull/148))
- **rating:** move focus and fill with the keyboard value ([#472](https://github.com/N1XUS/malva-ui/pull/472), [#314](https://github.com/N1XUS/malva-ui/issues/314))
- **scheduler:** add the missing rxjs peer to the lockfile ([#188](https://github.com/N1XUS/malva-ui/pull/188), [#190](https://github.com/N1XUS/malva-ui/pull/190))
- ⚠️  **search-field:** keep a static role off the host ([#571](https://github.com/N1XUS/malva-ui/pull/571), [#329](https://github.com/N1XUS/malva-ui/issues/329))
- **select:** write the native selection instead of binding it ([#135](https://github.com/N1XUS/malva-ui/pull/135), [#155](https://github.com/N1XUS/malva-ui/pull/155))
- ⚠️  **select:** claim the server <select> when hydrating native="auto" ([#285](https://github.com/N1XUS/malva-ui/pull/285), [#218](https://github.com/N1XUS/malva-ui/issues/218))
- ⚠️  **sidebar:** replace the trigger component with a directive and fix collapse animation ([#234](https://github.com/N1XUS/malva-ui/pull/234))
- **slider,sidebar,data-table,infinite-scroll:** mirror pointer and scroll geometry in RTL ([#466](https://github.com/N1XUS/malva-ui/pull/466), [#308](https://github.com/N1XUS/malva-ui/issues/308))
- **speed-dial:** fade the mask out on close instead of cutting it ([#281](https://github.com/N1XUS/malva-ui/pull/281), [#272](https://github.com/N1XUS/malva-ui/issues/272))
- **stepper:** re-index steps when projected content changes ([#471](https://github.com/N1XUS/malva-ui/pull/471), [#311](https://github.com/N1XUS/malva-ui/issues/311))
- ⚠️  **stepper:** treat an explicit step state as decoration, not selection ([#484](https://github.com/N1XUS/malva-ui/pull/484), [#312](https://github.com/N1XUS/malva-ui/issues/312))
- ⚠️  **stepper,breadcrumb,copy-to-clipboard:** correct accessible names ([#585](https://github.com/N1XUS/malva-ui/pull/585), [#326](https://github.com/N1XUS/malva-ui/issues/326))
- **styles:** meet WCAG AA contrast on tone fills, the accent focus ring and avatar initials ([#428](https://github.com/N1XUS/malva-ui/pull/428), [#302](https://github.com/N1XUS/malva-ui/issues/302))
- **styles:** redeclare derived tokens in high-contrast and nested theme scopes ([#453](https://github.com/N1XUS/malva-ui/pull/453), [#303](https://github.com/N1XUS/malva-ui/issues/303))
- **styles,tabs,segmented,switch,action-bar:** follow every theme scope ([#513](https://github.com/N1XUS/malva-ui/pull/513), [#454](https://github.com/N1XUS/malva-ui/issues/454))
- **tabs:** recompute the overflow split when tab widths change, not only the header ([#268](https://github.com/N1XUS/malva-ui/pull/268))
- **taskboard:** add the missing @malva-ui/core peer to the lockfile ([#206](https://github.com/N1XUS/malva-ui/pull/206))
- **textarea:** measure auto-resize after render, not before ([#120](https://github.com/N1XUS/malva-ui/pull/120))
- **time-picker:** fill the mobile full-screen sheet with the drum ([#123](https://github.com/N1XUS/malva-ui/pull/123))
- **time-picker:** derive the panel's track height from the row count ([#143](https://github.com/N1XUS/malva-ui/pull/143))
- **toast,notification:** announce every item shown in the same tick ([#590](https://github.com/N1XUS/malva-ui/pull/590), [#336](https://github.com/N1XUS/malva-ui/issues/336))
- **tokenizer:** track rendered tokens by object identity, not by value ([#185](https://github.com/N1XUS/malva-ui/pull/185), [#186](https://github.com/N1XUS/malva-ui/pull/186))
- ⚠️  **tooltip:** dismiss only the tooltip on Escape, wherever focus is ([#499](https://github.com/N1XUS/malva-ui/pull/499), [#319](https://github.com/N1XUS/malva-ui/issues/319))
- ⚠️  **tooltip:** describe the host from init, beside its own description ([#532](https://github.com/N1XUS/malva-ui/pull/532), [#321](https://github.com/N1XUS/malva-ui/issues/321))
- **tooltip:** apply input changes while the tooltip is shown ([#549](https://github.com/N1XUS/malva-ui/pull/549), [#346](https://github.com/N1XUS/malva-ui/issues/346))

### 🔥 Performance

- **cdk:** memoize the row side of contains filters per column ([#64](https://github.com/N1XUS/malva-ui/pull/64), [#174](https://github.com/N1XUS/malva-ui/pull/174))
- **combobox/select:** resolve value-vs-options through a progressive index ([#107](https://github.com/N1XUS/malva-ui/pull/107))
- **drawer:** drop lodash-es from @malva-ui/core ([#418](https://github.com/N1XUS/malva-ui/pull/418))
- **dropdown:** window the option list ([#528](https://github.com/N1XUS/malva-ui/pull/528), [#318](https://github.com/N1XUS/malva-ui/issues/318))
- **editor:** derive the toolbar's enabled-widget order once per invalidation ([#18](https://github.com/N1XUS/malva-ui/pull/18), [#183](https://github.com/N1XUS/malva-ui/pull/183))
- **form-utils:** share one defaultCompareWith reference across the stack ([#133](https://github.com/N1XUS/malva-ui/pull/133))
- **scrollbar:** invalidate the track-metric cache when a track's own box moves ([#115](https://github.com/N1XUS/malva-ui/pull/115))
- **speed-dial:** register hover and focus listeners with fromEvent ([#102](https://github.com/N1XUS/malva-ui/pull/102))
- **tokenizer:** price the paste dedupe in comparisons instead of counting values ([#200](https://github.com/N1XUS/malva-ui/pull/200))

### 💅 Refactors

- **core:** move DOM listeners onto fromEvent with owned teardown ([#113](https://github.com/N1XUS/malva-ui/pull/113))
- **core:** extract the time-picker drum into a reusable scrubber ([#146](https://github.com/N1XUS/malva-ui/pull/146))

### 📖 Documentation

- **core:** review follow-ups from the 2026-09-03 merge pass ([#141](https://github.com/N1XUS/malva-ui/pull/141))
- **docs:** track docs/migrations and repair the migration index ([#195](https://github.com/N1XUS/malva-ui/pull/195), [#207](https://github.com/N1XUS/malva-ui/pull/207))
- **i18n:** correct the per-component key count from 38 to 39 ([#131](https://github.com/N1XUS/malva-ui/pull/131))
- **release:** publish the versioning and stability policy ([#24](https://github.com/N1XUS/malva-ui/pull/24), [#198](https://github.com/N1XUS/malva-ui/pull/198))

### ⚠️  Breaking Changes

- **stepper,breadcrumb,copy-to-clipboard:** correct accessible names  ([#585](https://github.com/N1XUS/malva-ui/pull/585), [#326](https://github.com/N1XUS/malva-ui/issues/326))
  every copy-to-clipboard host carries an id, one with
  a value included, and one with no value also carries a
  self-referencing aria-labelledby next to a colon-ended aria-label; a
  bound [id] on it now sets a typed input, so a number or null
  expression fails strictTemplates; the stepper's name moves from the
  host to its tablist; a static aria-label on the stepper or the
  breadcrumb, and a static aria-labelledby on the stepper, now name the
  widget. See docs/migrations/2026-09-accessible-name-sources.md.
  Closes #326"
  M	.claude/projects/libs-breadcrumb.md
  M	.claude/projects/libs-copy-to-clipboard.md
  M	.claude/projects/libs-stepper.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/breadcrumb/examples/1/index.ts
  M	apps/docs/src/app/pages/breadcrumb/examples/2/index.ts
  M	apps/docs/src/app/pages/breadcrumb/examples/3/index.ts
  M	apps/docs/src/app/pages/breadcrumb/examples/4/index.mdx
  M	apps/docs/src/app/pages/breadcrumb/examples/4/index.spec.ts
  M	apps/docs/src/app/pages/breadcrumb/examples/4/index.ts
  A	apps/docs/src/app/pages/breadcrumb/landmarks.spec.ts
  M	apps/docs/src/app/pages/copy-to-clipboard/examples/1/index.mdx
  M	apps/docs/src/app/pages/copy-to-clipboard/examples/2/index.mdx
  A	docs/migrations/2026-09-accessible-name-sources.md
  M	libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb.spec.ts
  M	libs/core/breadcrumb/src/lib/breadcrumb/breadcrumb.ts
  M	libs/core/copy-to-clipboard/src/lib/copy-to-clipboard/copy-to-clipboard.html
  M	libs/core/copy-to-clipboard/src/lib/copy-to-clipboard/copy-to-clipboard.spec.ts
  M	libs/core/copy-to-clipboard/src/lib/copy-to-clipboard/copy-to-clipboard.ts
  M	libs/core/src/ssr-smoke.spec.ts
  M	libs/core/stepper/src/lib/stepper/stepper.html
  M	libs/core/stepper/src/lib/stepper/stepper.spec.ts
  M	libs/core/stepper/src/lib/stepper/stepper.ts
- **avatar:** name initials-only avatars, retry images on a new src  ([#584](https://github.com/N1XUS/malva-ui/pull/584), [#334](https://github.com/N1XUS/malva-ui/issues/334))
  an initials-only avatar (no name, no label) now
  renders role="img" with its trimmed, upper-cased initials as
  aria-label. A button, link or option wrapping one gains those initials
  in its accessible name, and a row beside the person's name gains an
  extra image stop (VERSIONING section 3 row 112). Hide a decorative
  avatar with aria-hidden="true". The image retry restores documented
  behaviour (row 117): a new src shows the skeleton and fades in, and a
  re-upload to the same URL needs a changed src, such as a cache-buster.
  See docs/migrations/2026-09-avatar-initials-accessible-name.md.
  Closes #334"
  M	.claude/projects/libs-avatar-group.md
  M	.claude/projects/libs-avatar.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/button/examples/7/index.html
  A	docs/migrations/2026-09-avatar-initials-accessible-name.md
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.html
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.spec.ts
  M	libs/core/avatar/src/lib/avatar/avatar.spec.ts
  M	libs/core/avatar/src/lib/avatar/avatar.ts
- **filter,i18n:** name each condition control by field, row and role  ([#579](https://github.com/N1XUS/malva-ui/pull/579), [#330](https://github.com/N1XUS/malva-ui/issues/330))
  every free-form condition control gets a new default
  accessible name at an unchanged API (VERSIONING row 112); routing the
  names through MLV_FILTER_I18N, as the docs promised, is the row 117
  half, and the new optional keys are row 115. Specs and e2e locating
  "Status 1" or "Remove condition" find nothing; a hand-written pack still
  compiles but announces the five new names in English, repeats a plain
  removeCondition per row, and has removeCondition ICU-parsed once it
  contains a brace, where an unquoted brace or a placeholder other than
  label / index throws and the condition editor fails to render; code
  building MlvFilterValueEditorContext by hand fails with TS2739. See
  docs/migrations/2026-09-filter-condition-control-names.md.
  Closes #330"
  M	.claude/projects/libs-filter.md
  M	.claude/projects/libs-i18n.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/filter/examples/4/index.html
  M	apps/docs/src/app/pages/filter/examples/4/index.mdx
  A	docs/migrations/2026-09-filter-condition-control-names.md
  M	libs/core/filter/src/lib/filter/filter-value-editor.ts
  M	libs/core/filter/src/lib/filter/filter.html
  M	libs/core/filter/src/lib/filter/filter.spec.ts
  M	libs/core/filter/src/lib/filter/filter.ts
  M	libs/i18n/de/src/lib/de.ts
  M	libs/i18n/en/src/lib/en.ts
  M	libs/i18n/es/src/lib/es.ts
  M	libs/i18n/fr/src/lib/fr.ts
  M	libs/i18n/id/src/lib/id.ts
  M	libs/i18n/it/src/lib/it.ts
  M	libs/i18n/ja/src/lib/ja.ts
  M	libs/i18n/nl/src/lib/nl.ts
  M	libs/i18n/pl/src/lib/pl.ts
  M	libs/i18n/pt/src/lib/pt.ts
  M	libs/i18n/ro/src/lib/ro.ts
  M	libs/i18n/src/lib/tokens/filter.ts
  M	libs/i18n/tr/src/lib/tr.ts
  M	libs/i18n/uk/src/lib/uk.ts
  M	libs/i18n/zh-Hans/src/lib/zh-Hans.ts
- **kbd:** read shortcuts by key name, not a prohibited aria-label  ([#574](https://github.com/N1XUS/malva-ui/pull/574), [#331](https://github.com/N1XUS/malva-ui/issues/331))
- **editor:** render no toolbar while the editor is readonly  ([#573](https://github.com/N1XUS/malva-ui/pull/573), [#498](https://github.com/N1XUS/malva-ui/issues/498))
  VERSIONING row 112. A readonly editor with
  toolbarAppearance="bar" (the default) no longer renders its toolbar, so
  zoom, the toolbar tab stop, consumer toolbar content and the sticky
  modifier are gone while readonly, and focus on a toolbar control moves
  to the content. A consumer overlay opened from a directly projected slot
  control is not closed by the editor. See
  docs/migrations/2026-09-editor-readonly-no-toolbar.md.
  Closes #498"
  M	.claude/projects/libs-editor.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/editor/examples/12/index.mdx
  M	apps/docs/src/app/pages/editor/examples/3/index.mdx
  M	apps/docs/src/app/pages/editor/examples/6/index.mdx
  A	docs/migrations/2026-09-editor-readonly-no-toolbar.md
  M	libs/editor/e2e/editor-layout.spec.ts
  M	libs/editor/src/lib/ai/editor-ai-menu.spec.ts
  M	libs/editor/src/lib/ai/editor-ai-menu.ts
  M	libs/editor/src/lib/editor-toolbar-context.ts
  M	libs/editor/src/lib/editor/editor-bubble.spec.ts
  M	libs/editor/src/lib/editor/editor-bubble.ts
  A	libs/editor/src/lib/editor/editor-readonly-toolbar.spec.ts
  M	libs/editor/src/lib/editor/editor-ssr.spec.ts
  M	libs/editor/src/lib/editor/editor.html
  M	libs/editor/src/lib/editor/editor.ts
  M	libs/editor/src/lib/toolbar/editor-formatting-popovers.spec.ts
  M	libs/editor/src/lib/toolbar/editor-table.spec.ts
  M	libs/editor/src/lib/toolbar/editor-toolbar.spec.ts
  M	libs/editor/src/lib/toolbar/editor-zoom.spec.ts
- **search-field:** keep a static role off the host  ([#571](https://github.com/N1XUS/malva-ui/pull/571), [#329](https://github.com/N1XUS/malva-ui/issues/329))
- **editor:** keep the author's image alt and finish the upload status  ([#567](https://github.com/N1XUS/malva-ui/pull/567), [#448](https://github.com/N1XUS/malva-ui/issues/448))
- **popup:** give full-screen sheets dialog semantics  ([#562](https://github.com/N1XUS/malva-ui/pull/562), [#322](https://github.com/N1XUS/malva-ui/issues/322))
- **avatar-group,popup:** keep the +N counter out of an interactive host  ([#557](https://github.com/N1XUS/malva-ui/pull/557), [#328](https://github.com/N1XUS/malva-ui/issues/328))
  ARIA and focus change at an unchanged API (VERSIONING
  section 3 row 112; one BEM element added, row 114). The interactive
  host is role="group" and not focusable; the action is
  `.mlv-avatar-group__action`. Host focus styles no longer match. A
  scripted keydown on the counter no longer emits overflowClick.
  Activating the counter no longer closes the member popup. Selectors
  on div.__overflow, [role="button"] or div.__item stop matching. See
  docs/migrations/2026-09-avatar-group-inner-action-button.md.
  Closes #328"
  M	.claude/projects/libs-avatar-group.md
  M	.claude/projects/libs-popup.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/avatar-group/examples/4/index.html
  M	apps/docs/src/app/pages/avatar-group/examples/4/index.mdx
  A	docs/migrations/2026-09-avatar-group-inner-action-button.md
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.html
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.scss
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.spec.ts
  M	libs/core/avatar-group/src/lib/avatar-group/avatar-group.ts
  M	libs/core/popup/src/lib/popup-trigger/popup-trigger.spec.ts
  M	libs/core/popup/src/lib/popup-trigger/popup-trigger.ts
- **form-utils:** report touched when focus leaves the control  ([#553](https://github.com/N1XUS/malva-ui/pull/553), [#347](https://github.com/N1XUS/malva-ui/issues/347))
  on the eight controls above, touched arrives when
  focus leaves the control instead of on selection or on each part's
  blur. See docs/migrations/2026-09-touched-on-focus-leave.md.
  Closes #347"
  M	.claude/projects/libs-color-picker.md
  M	.claude/projects/libs-file-upload.md
  M	.claude/projects/libs-form-utils.md
  M	.claude/projects/libs-pin-input.md
  M	.claude/projects/libs-radio.md
  M	.claude/projects/libs-rating.md
  M	.claude/projects/libs-segmented.md
  M	.claude/projects/libs-slider.md
  M	.claude/projects/libs-tokenizer.md
  M	CLAUDE.md
  A	docs/migrations/2026-09-touched-on-focus-leave.md
  A	libs/core/color-picker/src/lib/color-picker/color-picker-touched.spec.ts
  M	libs/core/color-picker/src/lib/color-picker/color-picker.ts
  A	libs/core/file-upload/src/lib/file-upload/file-upload-touched.spec.ts
  M	libs/core/file-upload/src/lib/file-upload/file-upload.ts
  A	libs/core/form-utils/src/lib/form-control-base/focus-leaves-control.spec.ts
  M	libs/core/form-utils/src/lib/form-control-base/signal-form-control-base.ts
  M	libs/core/pin-input/src/lib/pin-input/pin-input-binding-matrix.spec.ts
  A	libs/core/pin-input/src/lib/pin-input/pin-input-touched.spec.ts
  M	libs/core/pin-input/src/lib/pin-input/pin-input.html
  M	libs/core/pin-input/src/lib/pin-input/pin-input.ts
  M	libs/core/radio/src/lib/radio-group/radio-group-binding-matrix.spec.ts
  A	libs/core/radio/src/lib/radio-group/radio-group-touched.spec.ts
  M	libs/core/radio/src/lib/radio-group/radio-group.ts
  M	libs/core/rating/src/lib/rating/rating-binding-matrix.spec.ts
  A	libs/core/rating/src/lib/rating/rating-touched.spec.ts
  M	libs/core/rating/src/lib/rating/rating.ts
  M	libs/core/segmented/src/lib/segmented/segmented-binding-matrix.spec.ts
  A	libs/core/segmented/src/lib/segmented/segmented-touched.spec.ts
  M	libs/core/segmented/src/lib/segmented/segmented.ts
  M	libs/core/slider/src/lib/slider/slider-binding-matrix.spec.ts
  A	libs/core/slider/src/lib/slider/slider-touched.spec.ts
  M	libs/core/slider/src/lib/slider/slider.html
  M	libs/core/slider/src/lib/slider/slider.ts
  M	libs/core/tokenizer/src/lib/tokenizer/tokenizer-binding-matrix.spec.ts
  A	libs/core/tokenizer/src/lib/tokenizer/tokenizer-touched.spec.ts
  M	libs/core/tokenizer/src/lib/tokenizer/tokenizer.html
  M	libs/core/tokenizer/src/lib/tokenizer/tokenizer.ts
- **checkbox,switch:** put a consumer id on the native input  ([#542](https://github.com/N1XUS/malva-ui/pull/542), [#323](https://github.com/N1XUS/malva-ui/issues/323))
- **button:** keep focus and tab stop on a loading button  ([#533](https://github.com/N1XUS/malva-ui/pull/533), [#324](https://github.com/N1XUS/malva-ui/issues/324))
- **tooltip:** describe the host from init, beside its own description  ([#532](https://github.com/N1XUS/malva-ui/pull/532), [#321](https://github.com/N1XUS/malva-ui/issues/321))
- **progress:** render the label in both shapes and name the progressbar  ([#508](https://github.com/N1XUS/malva-ui/pull/508), [#258](https://github.com/N1XUS/malva-ui/issues/258))
  projected content without ariaLabel now names the
  progressbar in both shapes, and the default bar renders it (VERSIONING
  row 112, with row 117 for the bar's documented slot). See
  docs/migrations/2026-09-progress-label-slot.md.
  Closes #258"
  M	.claude/projects/libs-progress.md
  M	.claude/projects/page-progress.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/progress/examples/4/index.html
  M	apps/docs/src/app/pages/progress/examples/4/index.mdx
  M	apps/docs/src/app/pages/progress/examples/6/index.mdx
  A	docs/migrations/2026-09-progress-label-slot.md
  M	libs/core/progress/src/lib/progress/progress.html
  M	libs/core/progress/src/lib/progress/progress.spec.ts
  M	libs/core/progress/src/lib/progress/progress.ts
  M	libs/core/src/ssr-smoke.spec.ts
- **form-utils:** expose toggle validation state and the field error  ([#504](https://github.com/N1XUS/malva-ui/pull/504), [#320](https://github.com/N1XUS/malva-ui/issues/320))
  default ARIA and rendering change at an unchanged API
  (VERSIONING section 3, row 112): aria-invalid and a new
  aria-describedby token appear, and state="error" on a checkbox, switch
  or slider now paints and announces. Checkbox and switch description
  and message rendering restores documented behaviour (row 117); the new
  BEM elements and the slider state and has-text modifiers are additive
  (row 114). See docs/migrations/2026-09-toggle-validation-state.md.
  Closes #320"
  M	.claude/projects/libs-checkbox.md
  M	.claude/projects/libs-form-utils.md
  M	.claude/projects/libs-radio.md
  M	.claude/projects/libs-rating.md
  M	.claude/projects/libs-slider.md
  M	.claude/projects/libs-switch.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/checkbox/examples/2/index.mdx
  A	docs/migrations/2026-09-toggle-validation-state.md
  A	libs/core/checkbox/src/lib/checkbox/checkbox-validation.spec.ts
  M	libs/core/checkbox/src/lib/checkbox/checkbox.html
  M	libs/core/checkbox/src/lib/checkbox/checkbox.scss
  M	libs/core/checkbox/src/lib/checkbox/checkbox.ts
  M	libs/core/form-utils/src/lib/form-control-base/signal-form-control-base.ts
  A	libs/core/form-utils/src/lib/form-field/form-field-error-association.spec.ts
  M	libs/core/form-utils/src/lib/form-field/form-field.ts
  M	libs/core/form-utils/src/lib/models/form-field-connector.ts
  A	libs/core/input/src/lib/input/input-field-error.spec.ts
  A	libs/core/radio/src/lib/radio-group/radio-group-validation.spec.ts
  M	libs/core/radio/src/lib/radio-group/radio-group.ts
  A	libs/core/rating/src/lib/rating/rating-validation.spec.ts
  M	libs/core/rating/src/lib/rating/rating.ts
  A	libs/core/slider/src/lib/slider/slider-validation.spec.ts
  M	libs/core/slider/src/lib/slider/slider.html
  M	libs/core/slider/src/lib/slider/slider.scss
  M	libs/core/slider/src/lib/slider/slider.ts
  A	libs/core/switch/src/lib/switch/switch-validation.spec.ts
  M	libs/core/switch/src/lib/switch/switch.html
  M	libs/core/switch/src/lib/switch/switch.scss
  M	libs/core/switch/src/lib/switch/switch.ts
- **tooltip:** dismiss only the tooltip on Escape, wherever focus is  ([#499](https://github.com/N1XUS/malva-ui/pull/499), [#319](https://github.com/N1XUS/malva-ui/issues/319))
- **button:** block a disabled a[mlvButton] and drop its tab stop  ([#490](https://github.com/N1XUS/malva-ui/pull/490), [#460](https://github.com/N1XUS/malva-ui/issues/460))
  a disabled or loading a[mlvButton] no longer carries
  the disabled attribute and gets tabindex="-1", restored to its own
  tabindex (or none) when re-enabled; a tabindex bound with
  [attr.tabindex] on an anchor host overwrites the -1 when its value
  changes while inert and is removed on re-enable. A scripted or
  screen-reader click on a disabled button, anchor or <button>, no longer
  reaches its own (click) or a co-hosted directive such as
  mlvMenuTrigger. Select .mlv-button--disabled or [aria-disabled="true"]
  instead of a[disabled]; keep the button enabled and branch, or listen
  in the capture phase, to observe such clicks. See
  docs/migrations/2026-09-button-anchor-disabled-activation.md.
  Closes #460"
  M	.claude/projects/libs-button.md
  M	CLAUDE.md
  A	docs/migrations/2026-09-button-anchor-disabled-activation.md
  M	docs/migrations/2026-09-link-native-activation.md
  A	libs/core/button/src/lib/button/button-ssr.spec.ts
  M	libs/core/button/src/lib/button/button.spec.ts
  M	libs/core/button/src/lib/button/button.ts
  M	libs/core/src/ssr-smoke.spec.ts
- **stepper:** treat an explicit step state as decoration, not selection  ([#484](https://github.com/N1XUS/malva-ui/pull/484), [#312](https://github.com/N1XUS/malva-ui/issues/312))
  MlvStep's `state` is decoration only. state="active"
  no longer selects a step; the open step is always the one at
  activeIndex. Choose it with [initialIndex], selectStep() or
  activeIndex.set(). Selectors reading selection from
  .mlv-stepper__step-header--active or .mlv-stepper__label--active should
  read [aria-selected="true"] or the --active content panel. See
  docs/migrations/2026-09-stepper-state-decoration.md.
  Closes #312"
  M	.claude/projects/libs-stepper.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/stepper/examples/3/index.ts
  M	apps/docs/src/app/pages/stepper/examples/5/index.mdx
  A	docs/migrations/2026-09-stepper-state-decoration.md
  M	libs/core/stepper/src/lib/stepper/step.ts
  M	libs/core/stepper/src/lib/stepper/stepper.html
  M	libs/core/stepper/src/lib/stepper/stepper.spec.ts
  M	libs/core/stepper/src/lib/stepper/stepper.ts
  M	libs/core/stepper/src/lib/stepper/stepper.types.ts
- **editor:** add height and toolbar placement inputs; uncapped editors grow  ([#478](https://github.com/N1XUS/malva-ui/pull/478), [#416](https://github.com/N1XUS/malva-ui/issues/416))
  an editor without height or maxHeight no longer
  scrolls internally, zoom reflows it instead of scrolling it, the zoom
  transition is gone, and the toolbar root moves one element deeper
  (.mlv-editor__surface > .mlv-editor__toolbar-band > .mlv-editor__toolbar).
  See docs/migrations/2026-09-editor-layout-toolbar-placement.md.
  Closes #416"
  M	.claude/projects/app-docs.md
  M	.claude/projects/libs-editor.md
  M	.claude/projects/libs-floating-container.md
  M	CLAUDE.md
  A	apps/docs/src/app/pages/editor/examples/12/index.html
  A	apps/docs/src/app/pages/editor/examples/12/index.mdx
  A	apps/docs/src/app/pages/editor/examples/12/index.ts
  M	apps/docs/src/app/pages/editor/index.spec.ts
  M	apps/docs/src/app/pages/editor/index.ts
  M	apps/docs/src/app/shared/example-container/example-container.component.ts
  A	docs/migrations/2026-09-editor-layout-toolbar-placement.md
  M	libs/cdk/floating-container/src/lib/floating-container.mixins.scss
  M	libs/cdk/floating-container/src/lib/floating-container.spec.ts
  A	libs/editor/e2e/editor-layout.spec.ts
  M	libs/editor/e2e/editor.spec.ts
  M	libs/editor/src/lib/editor.types.ts
  A	libs/editor/src/lib/editor/editor-layout.spec.ts
  A	libs/editor/src/lib/editor/editor-layout.ts
  M	libs/editor/src/lib/editor/editor.html
  M	libs/editor/src/lib/editor/editor.scss
  M	libs/editor/src/lib/editor/editor.ts
  M	libs/editor/src/lib/extensions/editor-block-handle.spec.ts
  M	libs/editor/src/lib/extensions/editor-block-handle.ts
  M	libs/editor/src/lib/toolbar/editor-toolbar.spec.ts
  M	libs/editor/src/lib/toolbar/editor-toolbar.ts
- **link:** block a disabled routerLink and let enabled links activate  ([#465](https://github.com/N1XUS/malva-ui/pull/465), [#309](https://github.com/N1XUS/malva-ui/issues/309))
  a[mlvLink] no longer cancels activation on an enabled
  link. A plain href now follows on click and Enter, modifier clicks and
  target="_blank" open a new tab, and Space scrolls the page, so an
  href="#" pseudo-button now navigates to "#". A disabled link's scripted
  or screen-reader click no longer reaches its own (click) or bubble-phase
  listeners on ancestors. Use button[mlvButton] for actions, a real href
  or routerLink for links, or cancel explicitly with
  (click)="...; $event.preventDefault()". See
  docs/migrations/2026-09-link-native-activation.md.
  Closes #309"
  M	.claude/projects/libs-link.md
  M	.claude/projects/page-link.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/link/examples/1/index.html
  M	apps/docs/src/app/pages/link/examples/1/index.ts
  M	apps/docs/src/app/pages/link/examples/2/index.html
  M	apps/docs/src/app/pages/link/examples/2/index.ts
  A	docs/migrations/2026-09-link-native-activation.md
  M	libs/core/link/src/lib/link/link.spec.ts
  M	libs/core/link/src/lib/link/link.ts
- **drawer:** render service and routable drawers in the component shell  ([#449](https://github.com/N1XUS/malva-ui/pull/449), [#305](https://github.com/N1XUS/malva-ui/issues/305))
  on service-opened and routable drawers the .mlv-drawer
  classes, role, aria-modal, tabindex, aria-label and aria-labelledby move
  from the CDK pane to a <div> inside it, the opened component's host gets
  mlv-drawer__content, and resizable: true now renders the handle, opens at
  defaultSnap (ignoring size) and focuses the handle first. A closed
  <mlv-drawer> no longer loads drawer.scss for [mlvDrawerBody] or
  [mlvDrawerFooter] rendered outside a drawer. Classified major under
  VERSIONING §3; on the 0.x line it releases as 0.2.0. See
  docs/migrations/2026-09-drawer-service-shell.md.
  Closes #305"
  M	.claude/projects/libs-drawer.md
  M	.claude/projects/libs-overlay.md
  M	CLAUDE.md
  A	docs/migrations/2026-09-drawer-service-shell.md
  M	libs/cdk/overlay/src/lib/overlay-ref.ts
  M	libs/cdk/overlay/src/lib/overlay-service-base.ts
  M	libs/cdk/overlay/src/lib/overlay.spec.ts
  A	libs/core/drawer/src/lib/drawer-header.scss
  M	libs/core/drawer/src/lib/drawer-header.ts
  M	libs/core/drawer/src/lib/drawer-ref.ts
  M	libs/core/drawer/src/lib/drawer.service.spec.ts
  M	libs/core/drawer/src/lib/drawer.service.ts
  A	libs/core/drawer/src/lib/drawer/drawer-geometry.ts
  A	libs/core/drawer/src/lib/drawer/drawer-panel.ts
  M	libs/core/drawer/src/lib/drawer/drawer-styles.spec.ts
  M	libs/core/drawer/src/lib/drawer/drawer.html
  M	libs/core/drawer/src/lib/drawer/drawer.scss
  M	libs/core/drawer/src/lib/drawer/drawer.ts
  A	libs/core/drawer/src/lib/routable-drawer.spec.ts
- **i18n:** format plurals and dates with the active language pack's locale  ([#434](https://github.com/N1XUS/malva-ui/pull/434), [#306](https://github.com/N1XUS/malva-ui/issues/306))
  plural categories, MLV_DATE_LOCALE's default, the
  native adapter's locale after a language switch and mlv-chat's
  formatting locale change; mlvTranslate is impure; constructing
  MlvI18nResolverService with new outside an injection context now
  throws NG0203. See docs/migrations/2026-09-mlv-locale-pack-formatting.md.
  Fixes #306"
  M	.claude/projects/libs-chat.md
  M	.claude/projects/libs-date.md
  M	.claude/projects/libs-i18n.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/date/index.ts
  M	apps/docs/src/app/pages/scheduler/examples/7/index.mdx
  A	docs/migrations/2026-09-mlv-locale-pack-formatting.md
  M	libs/core/chat/src/lib/chat-date/chat-date.ts
  A	libs/core/chat/src/lib/chat-locale-format.ts
  M	libs/core/chat/src/lib/chat-message/chat-message.html
  M	libs/core/chat/src/lib/chat-message/chat-message.ts
  A	libs/core/chat/src/lib/chat/chat-locale.spec.ts
  M	libs/core/chat/src/lib/chat/chat.html
  M	libs/core/chat/src/lib/chat/chat.ts
  M	libs/core/date/src/lib/date-adapter.ts
  A	libs/core/date/src/lib/date-locale-default.ts
  A	libs/core/date/src/lib/date-locale.spec.ts
  M	libs/core/date/src/lib/native-date-adapter.ts
  M	libs/i18n/README.md
  M	libs/i18n/de/src/lib/de.ts
  M	libs/i18n/en/src/lib/en.ts
  M	libs/i18n/es/src/lib/es.ts
  M	libs/i18n/fr/src/lib/fr.ts
  M	libs/i18n/id/src/lib/id.ts
  M	libs/i18n/it/src/lib/it.ts
  M	libs/i18n/ja/src/lib/ja.ts
  M	libs/i18n/nl/src/lib/nl.ts
  M	libs/i18n/pl/src/lib/pl.ts
  M	libs/i18n/pt/src/lib/pt.ts
  M	libs/i18n/ro/src/lib/ro.ts
  M	libs/i18n/src/index.ts
  M	libs/i18n/src/lib/i18n-resolver.service.ts
  M	libs/i18n/src/lib/i18n.service.ts
  A	libs/i18n/src/lib/locale.spec.ts
  A	libs/i18n/src/lib/locale.ts
  A	libs/i18n/src/lib/plural-locale.spec.ts
  M	libs/i18n/src/lib/translate.pipe.ts
  M	libs/i18n/src/lib/types.ts
  M	libs/i18n/tests/locale-contract.spec.ts
  M	libs/i18n/tr/src/lib/tr.ts
  M	libs/i18n/uk/src/lib/uk.ts
  M	libs/i18n/zh-Hans/src/lib/zh-Hans.ts
  M	scripts/malva-ui-translate.mjs
- **accessibility:** emit MlvClick once per activation on native buttons and links  ([#421](https://github.com/N1XUS/malva-ui/pull/421), [#299](https://github.com/N1XUS/malva-ui/issues/299))
  MlvClick emits once per activation. A script-dispatched
  keydown on a native host now emits nothing, a native host whose keydown another
  listener cancels emits nothing, the native-host payload is the browser's click
  (a PointerEvent with detail 0) rather than a KeyboardEvent, and Space on a
  non-native host is defaultPrevented. See
  docs/migrations/2026-09-mlv-click-single-activation.md."
  M	.claude/projects/libs-accessibility.md
  M	.claude/projects/libs-notification.md
  M	.claude/projects/libs-pagination.md
  M	.claude/rules/angular-directive.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/notification/examples/4/index.html
  M	apps/docs/src/app/pages/notification/examples/4/index.ts
  M	apps/docs/src/app/pages/slider/examples/4/index.html
  M	apps/docs/src/app/pages/slider/examples/4/index.ts
  M	apps/docs/src/app/pages/tabs/examples/3/index.html
  M	apps/docs/src/app/pages/tabs/examples/3/index.ts
  M	apps/docs/src/app/pages/toast/examples/3/index.html
  M	apps/docs/src/app/pages/toast/examples/3/index.ts
  A	docs/migrations/2026-09-mlv-click-single-activation.md
  M	libs/cdk/README.md
  M	libs/cdk/accessibility/src/lib/click.spec.ts
  M	libs/cdk/accessibility/src/lib/click.ts
  M	libs/core/notification/src/lib/notification-item/notification-item.html
  M	libs/core/notification/src/lib/notification-item/notification-item.spec.ts
  M	libs/core/notification/src/lib/notification-item/notification-item.ts
  M	libs/core/pagination/src/lib/pagination/pagination.html
  M	libs/core/pagination/src/lib/pagination/pagination.spec.ts
  M	libs/core/pagination/src/lib/pagination/pagination.ts
- **data-table:** key row edits by row identity and stop copying rows to flatten the tree  ([#420](https://github.com/N1XUS/malva-ui/pull/420))
  behaviour only; no public member renamed, removed or
  retyped (MlvEditEvent and MlvEditSaveEvent gain an optional sourceRow;
  rows, and the internal row type, no longer carry the internal
  _mlvDepth/_mlvRef keys). No call site of a public member fails to compile;
  a typed read of the internal keys does. Rows the table hands out
  (rowClick.row, display-template row, tone(row), flatRows()) are the
  consumer's own objects, not copies; with nothing expanded flatRows() is the
  displayRows() array. The edit draft (event row) and originalRow are shallow
  clones that keep the row's prototype. A save not yet written back renders
  pre-edit values. A refetch that rebuilds rows ends an open edit without
  rowEditCancel. A row object listed twice edits at both positions.
  isEditing(i) answers for the row now at i. When the next data emission
  holds the saved row in place of sourceRow, selectedRows swaps to the saved
  object and selectionChange emits once more. With an MlvDataSource the
  carry-over sees only the connected page: a sort, filter, search or page
  change before the write-back, or a write-back that moves the row to another
  page, leaves the saved row unselected while selectedRows keeps the pre-edit
  object, and a save-as-copy that pushes the source off the page moves the
  selection to the copy."
  M	.claude/projects/libs-data-table.md
  M	CLAUDE.md
  M	apps/docs/src/app/pages/data-table/examples/6/index.ts
  A	docs/migrations/2026-09-data-table-row-identity.md
  A	libs/core/data-table/src/lib/data-table/data-table-editing.spec.ts
  M	libs/core/data-table/src/lib/data-table/data-table-layout.spec.ts
  M	libs/core/data-table/src/lib/data-table/data-table-layout.ts
  M	libs/core/data-table/src/lib/data-table/data-table.html
  M	libs/core/data-table/src/lib/data-table/data-table.ts
  M	libs/core/data-table/src/lib/data-table/services/data-table-editing.service.ts
  M	libs/core/data-table/src/lib/types.ts
- **editor:** raise the Tiptap peer floor to 3.31 for three security advisories  ([#405](https://github.com/N1XUS/malva-ui/pull/405), [#291](https://github.com/N1XUS/malva-ui/issues/291))
  @malva-ui/editor requires @tiptap/* ^3.31.0,
  prosemirror-view ^1.42.5 and prosemirror-model ^1.25.12, with exactly
  one copy of each ProseMirror package. See
  docs/migrations/2026-09-editor-tiptap-3-31.md.
  Closes #291"
  M	.claude/projects/libs-editor.md
  M	CLAUDE.md
  M	VERSIONING.md
  M	apps/docs/src/app/pages/editor/examples/1/index.mdx
  M	apps/docs/tools/playground-corpus.spec.ts
  A	docs/migrations/2026-09-editor-tiptap-3-31.md
  M	libs/editor/README.md
  M	libs/editor/e2e/editor.spec.ts
  M	libs/editor/package.json
  M	libs/editor/src/lib/editor/editor.spec.ts
  A	libs/editor/src/lib/extensions/editor-upstream-behaviour.spec.ts
  M	package.json
  M	scripts/widen-peer-range.spec.mjs
  M	yarn.lock
- **list:** derive the item group's ARIA from the enclosing list's role  ([#274](https://github.com/N1XUS/malva-ui/pull/274), [#224](https://github.com/N1XUS/malva-ui/issues/224))
- **popup:** release a container trigger's registration when the trigger is destroyed  ([#284](https://github.com/N1XUS/malva-ui/pull/284), [#230](https://github.com/N1XUS/malva-ui/issues/230))
  with triggers A then B in one container, destroying B
  used to leave the next open anchored on the container host with B's
  backdrop; it now anchors on A with A's backdrop. Every distinct element
  registered directly through `registerTrigger` is retained until it is
  unregistered or the container is destroyed, so a direct caller that
  registers re-created elements must call `unregisterTrigger`. See
  docs/migrations/2026-09-popup-container-trigger-registration.md.
  Adjacent: `mlv-items-more` registered each opener on every open and never
  withdrew; it now withdraws the previous opener before registering another
  and when the panel closes.
  Follow-ups: #282 (the activating trigger should win when two are live),
  #283 (an open overlay whose origin trigger is destroyed jumps to 0,0 on
  reposition).
  Closes #230"
  M	.claude/projects/libs-items-more.md
  M	.claude/projects/libs-popup.md
  M	CLAUDE.md
  A	docs/migrations/2026-09-popup-container-trigger-registration.md
  M	libs/core/items-more/src/lib/items-more/items-more.spec.ts
  M	libs/core/items-more/src/lib/items-more/items-more.ts
  M	libs/core/popup/src/lib/popup-container/popup-container.spec.ts
  M	libs/core/popup/src/lib/popup-container/popup-container.token.ts
  M	libs/core/popup/src/lib/popup-container/popup-container.ts
  M	libs/core/popup/src/lib/popup-trigger/popup-trigger.ts
- **select:** claim the server <select> when hydrating native="auto"  ([#285](https://github.com/N1XUS/malva-ui/pull/285), [#218](https://github.com/N1XUS/malva-ui/issues/218))
  during a hydrating desktop's first render
  labelTarget() is labelable, the host carries mlv-select--native and
  the label a for attribute; openDropdown()/toggleDropdown() leave
  isOpen() false until the switch lands; focus on the claimed <select>
  moves to the trigger in the same tick without a touch, and the hook and
  openDropdown() cases fire focus on the <select> first; any hydrating
  select whose native turns false during its first render hands focus the
  same way; the server renders native whatever its breakpoint service
  answers; native-mode triggers carry no id attribute. See
  docs/migrations/2026-09-select-native-auto-hydration.md.
  Closes #218"
  M	.claude/projects/libs-select.md
  M	CLAUDE.md
  A	docs/migrations/2026-09-select-native-auto-hydration.md
  A	libs/core/select/src/lib/select/select-ssr.spec.ts
  M	libs/core/select/src/lib/select/select.html
  M	libs/core/select/src/lib/select/select.ts
  M	libs/core/src/ssr-smoke.spec.ts
- **page:** rebuild mlv-page on a measured geometry contract, add mlv-items-more  ([#275](https://github.com/N1XUS/malva-ui/pull/275))
  see docs/migrations/2026-09-page-rebuild.md,
  docs/migrations/2026-09-layout-removal.md,
  docs/migrations/2026-09-fluid-heading-scale.md and
  docs/migrations/2026-09-action-bar-density.md.
- **core:** let a form field resolve the checkbox and switch groups, and name them  ([#266](https://github.com/N1XUS/malva-ui/pull/266))
- **popup,tooltip:** mirror the inline position offset in RTL  ([#265](https://github.com/N1XUS/malva-ui/pull/265))
- **list:** take collapsed group content out of the tab order and the a11y tree  ([#264](https://github.com/N1XUS/malva-ui/pull/264))
- **core:** stop emitting a label `for` that names no labelable element  ([#261](https://github.com/N1XUS/malva-ui/pull/261))
- **form-utils:** drop the vitest import from the published testing entry point  ([#260](https://github.com/N1XUS/malva-ui/pull/260))
- **list:** coerce the group's open attribute and drop the toggler inset pins  ([#253](https://github.com/N1XUS/malva-ui/pull/253))
- **core:** declare the @angular/router peer nine entry points already need  ([#246](https://github.com/N1XUS/malva-ui/pull/246))
- **popup:** anchor every open to a live trigger, not a destroyed one  ([#237](https://github.com/N1XUS/malva-ui/pull/237))
- **sidebar:** replace the trigger component with a directive and fix collapse animation  ([#234](https://github.com/N1XUS/malva-ui/pull/234))

### ❤️ Thank You

- Denys Severyn

## 0.1.15 (2026-09-02)

### 🩹 Fixes

- **docs:** expect MlvButton's selected input in the api-extractor spec ([#72](https://github.com/N1XUS/malva-ui/pull/72))
- **dropdown:** key the fold origin map by code unit, not code point ([#66](https://github.com/N1XUS/malva-ui/pull/66))
- **scrollbar:** reveal the track, not just the thumb, while scrolling ([#97](https://github.com/N1XUS/malva-ui/pull/97))
- **scrollbar:** scope host-state rules to the host's own parts ([#99](https://github.com/N1XUS/malva-ui/pull/99))
- **textarea:** render a working scrollbar by decorating the field itself ([#95](https://github.com/N1XUS/malva-ui/pull/95))

### 🔥 Performance

- **cdk/utils:** memoize isUp()/isDown() per resolved breakpoint index ([#88](https://github.com/N1XUS/malva-ui/pull/88))
- **chat:** floor the audio playback tick and bind its listeners to DestroyRef ([#91](https://github.com/N1XUS/malva-ui/pull/91))
- **data-source:** memoize the search haystack per dataset ([#65](https://github.com/N1XUS/malva-ui/pull/65))
- **data-source:** hoist the sort collator and decorate once per row ([#84](https://github.com/N1XUS/malva-ui/pull/84))
- **dropdown:** fold option labels once instead of per code point ([#57](https://github.com/N1XUS/malva-ui/pull/57))
- **dropdown:** resolve reconciliation membership through sets ([#68](https://github.com/N1XUS/malva-ui/pull/68))
- **editor:** resolve the hovered block by binary search ([#77](https://github.com/N1XUS/malva-ui/pull/77))
- **menu:** index DOM order once per resync and filter mutations ([#55](https://github.com/N1XUS/malva-ui/pull/55))
- **menu:** skip syncOrder reconciliation when the order is unchanged ([#94](https://github.com/N1XUS/malva-ui/pull/94))
- **scrollbar:** cache track metrics out of the scroll fast path ([#71](https://github.com/N1XUS/malva-ui/pull/71))
- **textarea:** skip the auto-resize reflow bracket on a pure append ([#80](https://github.com/N1XUS/malva-ui/pull/80))

### 💅 Refactors

- ⚠️  **scrollbar:** make viewportTabIndex a passthrough, drop the tabbability scan ([#62](https://github.com/N1XUS/malva-ui/pull/62))

### ⚠️  Breaking Changes

- **scrollbar:** make viewportTabIndex a passthrough, drop the tabbability scan  ([#62](https://github.com/N1XUS/malva-ui/pull/62))

### ❤️ Thank You

- Denys Severyn

## 0.1.14 (2026-08-31)

### 🩹 Fixes

- **ci:** restore jsdom DOM globals clobbered by platform-server ([3acdc54](https://github.com/N1XUS/malva-ui/commit/3acdc54))
- **editor:** stub canvas getContext once instead of per spec ([db8fc55](https://github.com/N1XUS/malva-ui/commit/db8fc55))
- **editor:** install canvas so jsdom implements getContext ([3d5e8a6](https://github.com/N1XUS/malva-ui/commit/3d5e8a6))

### 📖 Documentation

- add contributing guide, code of conduct, security policy and templates ([65283c4](https://github.com/N1XUS/malva-ui/commit/65283c4))

### 📦 Build

- **release:** add repository, homepage and bugs to published manifests ([ede0519](https://github.com/N1XUS/malva-ui/commit/ede0519))

### ❤️ Thank You

- Denys Severyn

## 0.1.12 (2026-08-17)

### 🚀 Features

- **autocomplete:** accept MlvDataSource options, lazy paging, stale results kept while searching ([d19c5f72](https://github.com/N1XUS/malva-ui/commit/d19c5f72))
- **cdk:** add @malva-ui/cdk/data-source with loading and natural-field search ([3a4549c0](https://github.com/N1XUS/malva-ui/commit/3a4549c0))
- **combobox:** async option sources, searchFn, loading variant, lazy paging, i18n empty copy ([cad0a49e](https://github.com/N1XUS/malva-ui/commit/cad0a49e))
- **density:** add MLV_DENSITY_CONTEXT so containers can project density to descendants ([8e35f237](https://github.com/N1XUS/malva-ui/commit/8e35f237))
- **dialog:** dialog surface, header/body/footer/close parts and MlvDialogRef on CDK DialogRef ([271ae16c](https://github.com/N1XUS/malva-ui/commit/271ae16c))
- **dialog:** rebuild MlvDialogService on @angular/cdk/dialog with MlvDialogContainer ([be1c7cdd](https://github.com/N1XUS/malva-ui/commit/be1c7cdd))
- **dialog:** confirm() composes the surface with a titled header, body and footer ([092eaf79](https://github.com/N1XUS/malva-ui/commit/092eaf79))
- **dialog:** ng-template[mlvDialog] two-way sugar over MlvDialogService ([8d094d5e](https://github.com/N1XUS/malva-ui/commit/8d094d5e))
- **dialog:** hint the size presets in MlvDialogSize ([9e7c02a1](https://github.com/N1XUS/malva-ui/commit/9e7c02a1))
- **dialog:** confirm describes its message, alertdialog for destructive, replayed answer ([ec106b00](https://github.com/N1XUS/malva-ui/commit/ec106b00))
- **dialog:** expose keydownEvents() and backdropClick() on MlvDialogRef; stacking specs ([433e3c46](https://github.com/N1XUS/malva-ui/commit/433e3c46))
- **dropdown:** add MlvSelectDataSource, an unpaged in-memory source for option controls ([05c9c66b](https://github.com/N1XUS/malva-ui/commit/05c9c66b))
- **dropdown:** add MlvOptionsAdapter for arrays, observables, data sources and searchFn ([85e00227](https://github.com/N1XUS/malva-ui/commit/85e00227))
- **dropdown:** panel loading dim, aria-busy, loading-more row and infinite-scroll sentinel ([aa36030f](https://github.com/N1XUS/malva-ui/commit/aa36030f))
- **form:** add @malva-ui/core/form with form[mlvForm] density-projecting layout shell ([1a74ec4f](https://github.com/N1XUS/malva-ui/commit/1a74ec4f))
- **form:** add mlvFormHeader and mlvFormActions rows ([0e3195ab](https://github.com/N1XUS/malva-ui/commit/0e3195ab))
- **form:** add fieldset[mlvFieldset] grid group and bare fieldset fallback styles ([42d62307](https://github.com/N1XUS/malva-ui/commit/42d62307))
- **form:** add mlvFieldsetSpan for fieldset grid children ([4c6fbb0a](https://github.com/N1XUS/malva-ui/commit/4c6fbb0a))
- **i18n:** select/combobox search, no-results, loading and result-count keys in all locales ([c75da5ef](https://github.com/N1XUS/malva-ui/commit/c75da5ef))
- **popup:** pinned content slot; select search row pinned above the option list ([4efe4c03](https://github.com/N1XUS/malva-ui/commit/4efe4c03))
- **segmented:** scaffold @malva-ui/core/segmented with radio-mode selection ([45a22894](https://github.com/N1XUS/malva-ui/commit/45a22894))
- **segmented:** arrow/Home/End navigation via FocusKeyManager ([1173721b](https://github.com/N1XUS/malva-ui/commit/1173721b))
- **segmented:** link mode — router-derived active state and aria-current ([15516a04](https://github.com/N1XUS/malva-ui/commit/15516a04))
- **segmented:** measure the sliding pill via afterRenderEffect + ResizeObserver ([b846ec66](https://github.com/N1XUS/malva-ui/commit/b846ec66))
- **segmented:** boxed-tabs styling — track, sliding pill, pale tones, separators, density ([1133fd7f](https://github.com/N1XUS/malva-ui/commit/1133fd7f))
- **segmented:** dark-theme surfaces — lifted neutral track and lighter pill ([251e8f60](https://github.com/N1XUS/malva-ui/commit/251e8f60))
- **segmented:** add @malva-ui/core/segmented segmented control (mlv-segmented, mlvSegmentedItem) ([c73055fa](https://github.com/N1XUS/malva-ui/commit/c73055fa))
- **select:** compareWith, option-instance normalisation, shared reconciliation guard ([059e760e](https://github.com/N1XUS/malva-ui/commit/059e760e))
- **select:** async option sources, in-dropdown loading, value-await variant, lazy paging ([1762ea97](https://github.com/N1XUS/malva-ui/commit/1762ea97))
- **select:** searchable mode — in-dropdown search field with activedescendant navigation ([9fad06f2](https://github.com/N1XUS/malva-ui/commit/9fad06f2))

### 🩹 Fixes

- **autocomplete:** repaint local observables, seed remote results, tolerate searchFn re-binding ([03958094](https://github.com/N1XUS/malva-ui/commit/03958094))
- **combobox:** keep the query while remote results land, reset remote search on commit/clear ([e020695e](https://github.com/N1XUS/malva-ui/commit/e020695e))
- **dialog:** pad the scroll viewport and stack body content vertically ([30ee2ea5](https://github.com/N1XUS/malva-ui/commit/30ee2ea5))
- **dialog:** reword the body-scrollbar comment to drop a literal flex-direction: inherit ([d2197323](https://github.com/N1XUS/malva-ui/commit/d2197323))
- **dialog:** give the dialog header its own margin and padding ([785bb568](https://github.com/N1XUS/malva-ui/commit/785bb568))
- **dialog:** label the dialog only when the header renders a title ([2b815280](https://github.com/N1XUS/malva-ui/commit/2b815280))
- **dialog:** eager change detection for the container, confirm header, size coercion ([43e8c830](https://github.com/N1XUS/malva-ui/commit/43e8c830))
- **dialog:** mlvDialog template does not emit after its host is destroyed ([33c56cfc](https://github.com/N1XUS/malva-ui/commit/33c56cfc))
- **dialog:** strip the native title attribute from the header host ([d92cd4d3](https://github.com/N1XUS/malva-ui/commit/d92cd4d3))
- **dialog:** make size fullscreen edge-to-edge on desktop ([68bb52b7](https://github.com/N1XUS/malva-ui/commit/68bb52b7))
- **dialog:** header label follows the rendered title ([64a70003](https://github.com/N1XUS/malva-ui/commit/64a70003))
- **dialog:** mlvDialog subscribes before emitting opened; close/ref docs ([889bcc8c](https://github.com/N1XUS/malva-ui/commit/889bcc8c))
- **dialog:** unique header title ids ([82c10554](https://github.com/N1XUS/malva-ui/commit/82c10554))
- **dialog:** mlvDialog honours a re-open requested while leaving ([3953dff8](https://github.com/N1XUS/malva-ui/commit/3953dff8))
- **dialog:** defensive reopen reset, ref cleared on destroy, self-sufficient message id ([bd7e0250](https://github.com/N1XUS/malva-ui/commit/bd7e0250))
- **docs:** extract injection tokens re-exported by annotated alias ([780edc9a](https://github.com/N1XUS/malva-ui/commit/780edc9a))
- **docs:** keep focus inside route-opened dialogs ([a51f6fd6](https://github.com/N1XUS/malva-ui/commit/a51f6fd6))
- **docs:** keep restored focus after a route dialog closes; cover the focus guard ([a3bace64](https://github.com/N1XUS/malva-ui/commit/a3bace64))
- **dropdown:** page-aware accumulation and searchFn reset in MlvOptionsAdapter ([4a9758b9](https://github.com/N1XUS/malva-ui/commit/4a9758b9))
- **dropdown:** contrast-safe loading dim, sentinel loading gate tests ([6711c2f2](https://github.com/N1XUS/malva-ui/commit/6711c2f2))
- **dropdown:** parent-mode paging spec + dev warning, migration note for loading, doc/JSDoc sweeps ([e0d69ebe](https://github.com/N1XUS/malva-ui/commit/e0d69ebe))
- **form:** clamp the capped fieldset grid to the container width ([48ceac6c](https://github.com/N1XUS/malva-ui/commit/48ceac6c))
- **form:** give bare legends the form's own density and merge authored aria-describedby ([5d745928](https://github.com/N1XUS/malva-ui/commit/5d745928))
- **segmented:** stop router navigation on disabled links; cover link-mode keyboard inertness ([f14f3da9](https://github.com/N1XUS/malva-ui/commit/f14f3da9))
- **segmented:** flag the pill as measured only after a non-zero measurement ([7c56bd06](https://github.com/N1XUS/malva-ui/commit/7c56bd06))
- **segmented:** hide the active segment's leading separator (specificity) ([5c5f2eec](https://github.com/N1XUS/malva-ui/commit/5c5f2eec))
- **segmented:** type the item click handler as Event for host-binding type checking ([5f3a2935](https://github.com/N1XUS/malva-ui/commit/5f3a2935))
- **segmented:** pressed (:active) feedback on idle segments ([960f2879](https://github.com/N1XUS/malva-ui/commit/960f2879))
- **segmented:** declare neutral pill defaults on the block ([5088742c](https://github.com/N1XUS/malva-ui/commit/5088742c))
- **select:** keep clear X while awaiting, close from trigger while inert, paging/keydown specs ([4a767792](https://github.com/N1XUS/malva-ui/commit/4a767792))
- **select:** scope panel mousedown guard, button role while open, search z-index, active reset ([9962d143](https://github.com/N1XUS/malva-ui/commit/9962d143))
- **styles:** use --mlv-padding-\* pairs only as the whole padding value ([58605211](https://github.com/N1XUS/malva-ui/commit/58605211))

### 💅 Refactors

- **cdk:** move normalizeForMatch to @malva-ui/cdk/utils (dropdown re-exports) ([dec6ba4f](https://github.com/N1XUS/malva-ui/commit/dec6ba4f))
- **cdk:** rename data-source filter operator type ([babbe04a](https://github.com/N1XUS/malva-ui/commit/babbe04a))
- **docs:** switch doc-page Examples/API and the Page record-editor header to mlv-segmented ([14ccc60b](https://github.com/N1XUS/malva-ui/commit/14ccc60b))
- **dropdown:** share toOptionsResult and the aria reconciliation guard ([f57e205e](https://github.com/N1XUS/malva-ui/commit/f57e205e))
- **editor:** image upload dialog renders the mlv-dialog surface and parts ([f8e368ae](https://github.com/N1XUS/malva-ui/commit/f8e368ae))
- **editor:** drop redundant dialog host flex rules; pin dialog part nesting ([458f2ca4](https://github.com/N1XUS/malva-ui/commit/458f2ca4))

### 📖 Documentation

- **core:** form layout design spec — mlvForm, mlvFieldset, density context, scroll-clip fix ([c41efeb3](https://github.com/N1XUS/malva-ui/commit/c41efeb3))
- **core:** add the form layout implementation plan ([ddab1c4e](https://github.com/N1XUS/malva-ui/commit/ddab1c4e))
- **core:** fix the density project name in the form layout plan ([0b445639](https://github.com/N1XUS/malva-ui/commit/0b445639))
- **core:** segmented control design spec (mlv-segmented, mlvSegmentedItem) ([df5cf2bc](https://github.com/N1XUS/malva-ui/commit/df5cf2bc))
- **core:** segmented control implementation plan ([ce6df180](https://github.com/N1XUS/malva-ui/commit/ce6df180))
- **core:** segmented control design spec (mlv-segmented, mlvSegmentedItem) ([b2ee52a6](https://github.com/N1XUS/malva-ui/commit/b2ee52a6))
- **core:** segmented control implementation plan ([9c7ae362](https://github.com/N1XUS/malva-ui/commit/9c7ae362))
- **core:** clamp the capped fieldset grid formula in the form layout spec and plan ([044963e8](https://github.com/N1XUS/malva-ui/commit/044963e8))
- **core:** mark the form layout spec as implemented ([9e931ad9](https://github.com/N1XUS/malva-ui/commit/9e931ad9))
- **core:** refresh dialog mentions in sibling library docs ([187b09fd](https://github.com/N1XUS/malva-ui/commit/187b09fd))
- **density:** describe the five-level scale and context fallback for the restricted directives ([fa5daee6](https://github.com/N1XUS/malva-ui/commit/fa5daee6))
- **dialog:** add dialog body flex-row bug to the form layout spec ([29e8a11d](https://github.com/N1XUS/malva-ui/commit/29e8a11d))
- **dialog:** design spec for the composition model on @angular/cdk/dialog ([78bdc3e5](https://github.com/N1XUS/malva-ui/commit/78bdc3e5))
- **dialog:** implementation plan for the composition model on @angular/cdk/dialog ([c4ae58b4](https://github.com/N1XUS/malva-ui/commit/c4ae58b4))
- **dialog:** record Task 1 execution amendments in the plan ([55715086](https://github.com/N1XUS/malva-ui/commit/55715086))
- **dialog:** rewrite dialog examples on the composition model ([6cda9c3d](https://github.com/N1XUS/malva-ui/commit/6cda9c3d))
- **dialog:** migration guide and project docs for the composition model ([b759dfcf](https://github.com/N1XUS/malva-ui/commit/b759dfcf))
- **dialog:** programmatic example clears its active ref ([53574f39](https://github.com/N1XUS/malva-ui/commit/53574f39))
- **dialog:** unnamed-dialog guidance, fullscreen coupling, stale mentions, spec notes ([487ed08c](https://github.com/N1XUS/malva-ui/commit/487ed08c))
- **dialog:** plan for the post-rebuild follow-ups ([53ee3daa](https://github.com/N1XUS/malva-ui/commit/53ee3daa))
- **dialog:** header id form, size hints, confirm a11y, deferred re-open ([f60e93a4](https://github.com/N1XUS/malva-ui/commit/f60e93a4))
- **dialog:** ref lifetime after destroy, confirm size type, message-id fallback ([9af09bc2](https://github.com/N1XUS/malva-ui/commit/9af09bc2))
- **dialog:** header id form in the migration guide; first-registered-header naming note ([ba939e0a](https://github.com/N1XUS/malva-ui/commit/ba939e0a))
- **dialog:** confirm spec count and axe guards in the testing table ([d4d958c0](https://github.com/N1XUS/malva-ui/commit/d4d958c0))
- **dialog:** plan for the stacked-dialogs example ([6218a2dd](https://github.com/N1XUS/malva-ui/commit/6218a2dd))
- **dialog:** stacking paragraph corrections; dispose the raw overlay in finally ([7bcdae7d](https://github.com/N1XUS/malva-ui/commit/7bcdae7d))
- **dialog:** stacked dialogs example with a guarded form and discard confirmation ([7bf2fdce](https://github.com/N1XUS/malva-ui/commit/7bf2fdce))
- **dialog:** stacked example disarms its guard once closing; note what counts as an edit ([b172d6b9](https://github.com/N1XUS/malva-ui/commit/b172d6b9))
- **dialog:** close-guard recipe disarms on beforeClose; example 9 notes ([d51dc087](https://github.com/N1XUS/malva-ui/commit/d51dc087))
- **docs:** async options, searchable select, data-source paging examples + migration note ([573d8863](https://github.com/N1XUS/malva-ui/commit/573d8863))
- **drawer:** disambiguate the drawer panel name sentence ([6971e599](https://github.com/N1XUS/malva-ui/commit/6971e599))
- **form:** add the form layout page and use mlvForm in the drawer example ([2822eebb](https://github.com/N1XUS/malva-ui/commit/2822eebb))
- **form:** tighten the form docs and examples after review ([9f9ed843](https://github.com/N1XUS/malva-ui/commit/9f9ed843))
- **popup:** dialog fallback constant name in comments ([8bb8b2ae](https://github.com/N1XUS/malva-ui/commit/8bb8b2ae))
- **segmented:** segmented page with basic, links, forms, tones and layout examples ([8dd2a46a](https://github.com/N1XUS/malva-ui/commit/8dd2a46a))
- **segmented:** make the first link the default active view in the links example ([45a2254f](https://github.com/N1XUS/malva-ui/commit/45a2254f))
- **segmented:** public API reference, core entry-point lists, monorepo index row ([f387c305](https://github.com/N1XUS/malva-ui/commit/f387c305))
- **segmented:** reconcile linkActiveOptions usage with the docs example; precision fixes ([2ffc55ae](https://github.com/N1XUS/malva-ui/commit/2ffc55ae))
- **segmented:** correct linkActiveOptions rationale, active override caveat, test counts ([35e660cb](https://github.com/N1XUS/malva-ui/commit/35e660cb))
- **select:** spec + plan for async option sources, searchable select, lazy paging ([ad69d867](https://github.com/N1XUS/malva-ui/commit/ad69d867))

### ❤️ Thank You

- Denys Severyn

## 0.1.11 (2026-08-15)

### 🩹 Fixes

- **page:** remap the sidebar state surfaces onto the shell chrome ([703fed69](https://github.com/N1XUS/malva-ui/commit/703fed69))
- **sidebar:** paint row states from --mlv-sidebar-\* state variables ([4555a861](https://github.com/N1XUS/malva-ui/commit/4555a861))
- **sidebar:** close the group flyout on child activation and gate the accordion ([e47ce010](https://github.com/N1XUS/malva-ui/commit/e47ce010))

### 📖 Documentation

- **sidebar:** document the state surfaces and the page-shell chrome remap ([23da9cf7](https://github.com/N1XUS/malva-ui/commit/23da9cf7))

### ❤️ Thank You

- Denys Severyn

## 0.1.10 (2026-08-15)

### 🚀 Features

- **action-bar:** add a wrap input so crowded bars reflow instead of overflowing ([c2c8b40e](https://github.com/N1XUS/malva-ui/commit/c2c8b40e))
- **badge:** add the mlvBadgeIcon slot ([83c0df03](https://github.com/N1XUS/malva-ui/commit/83c0df03))
- **button:** infer icon-only buttons and default them to secondary ([63dc3a0a](https://github.com/N1XUS/malva-ui/commit/63dc3a0a))
- **card:** add bodyLayout for a stacked card body ([37c189d8](https://github.com/N1XUS/malva-ui/commit/37c189d8))
- **core:** wire required, description and ariaLabel through every signal control ([55187c00](https://github.com/N1XUS/malva-ui/commit/55187c00))
- **data-table:** add error state and per-column value labels/tones ([2ff845f0](https://github.com/N1XUS/malva-ui/commit/2ff845f0))
- **dialog:** add MlvDialogService.confirm() confirmation primitive ([84f909d4](https://github.com/N1XUS/malva-ui/commit/84f909d4))
- **file-upload:** add mlvFileUploadAction slot for extra zone actions ([964c0874](https://github.com/N1XUS/malva-ui/commit/964c0874))
- **file-upload:** add cover preview mode with a floating replace/remove toolbar ([036f360c](https://github.com/N1XUS/malva-ui/commit/036f360c))
- **form-utils:** add required, description and ariaLabel to the signal control base ([cf858519](https://github.com/N1XUS/malva-ui/commit/cf858519))
- **i18n:** translate the new dialog, sidebar, data-table, form-utils and file-upload strings ([bd029cf5](https://github.com/N1XUS/malva-ui/commit/bd029cf5))
- **overlay:** shared initialFocus resolution for dialogs and drawers ([32414d67](https://github.com/N1XUS/malva-ui/commit/32414d67))
- **search-field:** add combobox role, aria wiring, navigate and commit hooks ([422f815c](https://github.com/N1XUS/malva-ui/commit/422f815c))
- **sidebar:** add collapseBelow breakpoint that switches the sidebar to offcanvas ([36af520a](https://github.com/N1XUS/malva-ui/commit/36af520a))

### 🩹 Fixes

- **avatar:** use the real --mlv-font-size-s token for the label word ([c42dae7b](https://github.com/N1XUS/malva-ui/commit/c42dae7b))
- **button:** give mlv-button-close its own focus-visible ring ([3f198b4c](https://github.com/N1XUS/malva-ui/commit/3f198b4c))
- **chat:** drop the dead size attribute from the audio toggle button ([76bb138c](https://github.com/N1XUS/malva-ui/commit/76bb138c))
- **checkbox,switch:** render the label input as visible text ([98e23472](https://github.com/N1XUS/malva-ui/commit/98e23472))
- **color-picker:** use the real --mlv-spacing-2 token for the format tab body ([a02d6c23](https://github.com/N1XUS/malva-ui/commit/a02d6c23))
- **dialog:** service-opened dialogs render a header row and get an accessible name ([4dfac038](https://github.com/N1XUS/malva-ui/commit/4dfac038))
- **docs:** replace invented --mlv-\* tokens in examples and shell styles ([d430a06d](https://github.com/N1XUS/malva-ui/commit/d430a06d))
- **docs:** use font-size instead of a size-only font shorthand in examples ([8cc744c5](https://github.com/N1XUS/malva-ui/commit/8cc744c5))
- **drawer:** clamp the panel to the viewport and honour maxSize when not resizable ([c440364c](https://github.com/N1XUS/malva-ui/commit/c440364c))
- **drawer:** render the sections navigator only above one section ([41c90183](https://github.com/N1XUS/malva-ui/commit/41c90183))
- **editor:** let the image upload dialog use the shared dialog header row ([1c305ce7](https://github.com/N1XUS/malva-ui/commit/1c305ce7))
- **file-upload:** translate the file rejection messages ([64edbd80](https://github.com/N1XUS/malva-ui/commit/64edbd80))
- **file-upload:** drop the crop demo and the title-attribute tooltip ([e3e54200](https://github.com/N1XUS/malva-ui/commit/e3e54200))
- **page:** make the dock floating appearance, geometry, and height real ([ce0ffa8a](https://github.com/N1XUS/malva-ui/commit/ce0ffa8a))
- **scrollbar:** viewport is a tab stop only when its content is not ([e466cd0c](https://github.com/N1XUS/malva-ui/commit/e466cd0c))
- **sidebar:** add ariaLabel input so authors can name the nav landmark ([f3513890](https://github.com/N1XUS/malva-ui/commit/f3513890))
- **sidebar:** align group and item row heights on one density-aware token ([93f2cc82](https://github.com/N1XUS/malva-ui/commit/93f2cc82))
- **sidebar:** stop an offcanvas sidebar from reserving inline layout width ([3cd0cdbd](https://github.com/N1XUS/malva-ui/commit/3cd0cdbd))
- **tabs:** let the tab group shrink so header overflow engages in grid/flex parents ([539094af](https://github.com/N1XUS/malva-ui/commit/539094af))
- **textarea:** render the character counter and repair aria-describedby ([324660d1](https://github.com/N1XUS/malva-ui/commit/324660d1))
- **toast:** keep stacks clear of sticky page chrome ([ba96bea5](https://github.com/N1XUS/malva-ui/commit/ba96bea5))

### 💅 Refactors

- **cdk:** extract the floating-container backdrop recipe into shared mixins ([eeedd47d](https://github.com/N1XUS/malva-ui/commit/eeedd47d))
- **sidebar:** delete the unexported, unused MlvSidebarGroupLabel marker ([5f90d1c8](https://github.com/N1XUS/malva-ui/commit/5f90d1c8))

### 📖 Documentation

- index the 2026-08 migrations, i18n key changes and missing commit scopes ([538d7df6](https://github.com/N1XUS/malva-ui/commit/538d7df6))
- **badge:** mark the no-op rounded input as deprecated ([257987e8](https://github.com/N1XUS/malva-ui/commit/257987e8))
- **core:** document and demo the shared field surface ([04f54e0d](https://github.com/N1XUS/malva-ui/commit/04f54e0d))
- **core:** align the form-control references with the signal-forms API ([19e011c2](https://github.com/N1XUS/malva-ui/commit/19e011c2))
- **core:** correct the remaining public-API drift the check found ([10a885aa](https://github.com/N1XUS/malva-ui/commit/10a885aa))
- **docs:** log the page dock and toast default-behaviour changes ([73db0c57](https://github.com/N1XUS/malva-ui/commit/73db0c57))
- **expand:** correct docstrings that contradict the declared API ([934cdec2](https://github.com/N1XUS/malva-ui/commit/934cdec2))
- **file-upload:** show extra zone actions via mlvFileUploadAction ([5ce7526a](https://github.com/N1XUS/malva-ui/commit/5ce7526a))
- **file-upload:** document the mlvFileUploadAction slot ([ad1f2ca9](https://github.com/N1XUS/malva-ui/commit/ad1f2ca9))
- **file-upload:** add a cover preview example with the floating toolbar ([4cdb44f4](https://github.com/N1XUS/malva-ui/commit/4cdb44f4))
- **file-upload:** index the cover preview example on the page doc ([8d1afc4f](https://github.com/N1XUS/malva-ui/commit/8d1afc4f))
- **file-upload:** document cover preview mode and the replaceFile key ([9fba8cc6](https://github.com/N1XUS/malva-ui/commit/9fba8cc6))
- **overlay:** record initialFocus, dialog chrome, confirm(), drawer clamp and scrollbar tab stop ([150a34e7](https://github.com/N1XUS/malva-ui/commit/150a34e7))
- **pagination:** rewrite the API docs against the declared inputs ([3ff77cb3](https://github.com/N1XUS/malva-ui/commit/3ff77cb3))
- **sidebar:** document collapseBelow, ariaLabel and the shared row height ([18466fdc](https://github.com/N1XUS/malva-ui/commit/18466fdc))
- **styles:** generate a complete --mlv-\* token reference and check for invented names ([13f5838e](https://github.com/N1XUS/malva-ui/commit/13f5838e))

### ❤️ Thank You

- Denys Severyn

## 0.1.9 (2026-08-07)

### 🩹 Fixes

- **dialog:** service-opened dialogs load the dialog stylesheet ([5d13fb2b](https://github.com/N1XUS/malva-ui/commit/5d13fb2b))
- **editor:** status row puts projected content first, counts last ([b904774d](https://github.com/N1XUS/malva-ui/commit/b904774d))

### ❤️ Thank You

- Denys Severyn

## 0.1.8 (2026-08-04)

### 🩹 Fixes

- **popup:** a same-tick close no longer wedges the overlay open ([182bd1dd](https://github.com/N1XUS/malva-ui/commit/182bd1dd))

### ❤️ Thank You

- Claude Fable 5
- Denys Severyn

## 0.1.7 (2026-08-04)

### 🚀 Features

- **core:** pill shape across buttons/controls/action bar, glass page chrome ([ca668df4](https://github.com/N1XUS/malva-ui/commit/ca668df4))
- **page:** begin record-editor page shell redesign ([43888db9](https://github.com/N1XUS/malva-ui/commit/43888db9))
- **page:** record-editor page shell — header v2, summary strip, dock ([aba2d31c](https://github.com/N1XUS/malva-ui/commit/aba2d31c))
- **page:** scroll-scrubbed snap timeline, header snap controls, cdk floating-container ([4860f2b6](https://github.com/N1XUS/malva-ui/commit/4860f2b6))
- **page:** single-surface chrome, origin-aware pinning ([1c23c617](https://github.com/N1XUS/malva-ui/commit/1c23c617))

### 🩹 Fixes

- **docs:** keep the record-editor dock pill contents inside the pill ([b729be0e](https://github.com/N1XUS/malva-ui/commit/b729be0e))
- **page:** full-bleed top chrome, snap condensing, control stacking ([3067901f](https://github.com/N1XUS/malva-ui/commit/3067901f))
- **page:** snap controls ride the chrome's bottom edge, sticky summary ([897f7d32](https://github.com/N1XUS/malva-ui/commit/897f7d32))
- **page:** transparent floating dock, pill-only chrome, narrow-canvas layout ([abbfc1e3](https://github.com/N1XUS/malva-ui/commit/abbfc1e3))
- **page:** chrome keeps border and soft shadow expanded, deeper when snapped ([26f34a23](https://github.com/N1XUS/malva-ui/commit/26f34a23))
- **release:** include the editor package in release versioning ([9e499969](https://github.com/N1XUS/malva-ui/commit/9e499969))

### 💅 Refactors

- **docs:** record-editor Draft/Live switch uses boxed compact tabs ([4b6bc09f](https://github.com/N1XUS/malva-ui/commit/4b6bc09f))

### ❤️ Thank You

- Claude Fable 5
- Denys Severyn

## 0.1.6 (2026-08-02)

### 🚀 Features

- **editor:** let hosts own the AI menu's action list ([3552269d](https://github.com/N1XUS/malva-ui/commit/3552269d))

### 📖 Documentation

- **editor:** document and demo the host-owned AI action list ([bc2c029a](https://github.com/N1XUS/malva-ui/commit/bc2c029a))

### ❤️ Thank You

- Denys Severyn

## 0.1.5 (2026-08-01)

### 🚀 Features

- **docs:** give the editor its own sidebar group with an AI Kit page ([da798ce8](https://github.com/N1XUS/malva-ui/commit/da798ce8))
- **editor:** add json serialization format ([7321ee7c](https://github.com/N1XUS/malva-ui/commit/7321ee7c))
- **editor:** add centred content measure with reserved gutter ([e7c7e5c1](https://github.com/N1XUS/malva-ui/commit/e7c7e5c1))
- **editor:** add top-level block move commands and keymap ([4b6319b5](https://github.com/N1XUS/malva-ui/commit/4b6319b5))
- **editor:** wire the block handle into the default preset ([4e455227](https://github.com/N1XUS/malva-ui/commit/4e455227))
- **editor:** render a floating block drag handle in the gutter ([4fbef978](https://github.com/N1XUS/malva-ui/commit/4fbef978))
- **editor:** reorder blocks by dragging the gutter handle ([9f685983](https://github.com/N1XUS/malva-ui/commit/9f685983))
- **editor:** preview a block drag with a ghost and motion ([c9786a65](https://github.com/N1XUS/malva-ui/commit/c9786a65))
- **editor:** scaffold the @malva-ui/editor/ai entry point contracts ([ecfed1d5](https://github.com/N1XUS/malva-ui/commit/ecfed1d5))
- **editor:** draft the AI streaming session engine ([03fd3ff7](https://github.com/N1XUS/malva-ui/commit/03fd3ff7))
- **editor:** add the framework-free AI streaming session engine ([839e8602](https://github.com/N1XUS/malva-ui/commit/839e8602))
- **editor:** provide the per-editor Angular AI context ([e23534a8](https://github.com/N1XUS/malva-ui/commit/e23534a8))
- **editor:** add the AI transforms toolbar menu ([47e805ff](https://github.com/N1XUS/malva-ui/commit/47e805ff))
- **editor:** land AI replacements as reviewable tracked suggestions ([8677ca59](https://github.com/N1XUS/malva-ui/commit/8677ca59))
- **editor:** make the review output mode land AI results as suggestions ([f9e58ae3](https://github.com/N1XUS/malva-ui/commit/f9e58ae3))
- **editor:** add the AI review bar with current-suggestion navigation ([40feb412](https://github.com/N1XUS/malva-ui/commit/40feb412))
- **editor:** give the current AI suggestion an announced, inspectable equivalent ([b925b9a1](https://github.com/N1XUS/malva-ui/commit/b925b9a1))
- **editor:** pace and animate AI streamed text ([bcf37a31](https://github.com/N1XUS/malva-ui/commit/bcf37a31))
- **i18n:** add editor block drag and move-announcement copy ([ff07ac28](https://github.com/N1XUS/malva-ui/commit/ff07ac28))

### 🩹 Fixes

- **button:** render the native pressed state ([48937fbc](https://github.com/N1XUS/malva-ui/commit/48937fbc))
- **color-picker:** use the transparent button variant for the popup trigger ([26d43b5b](https://github.com/N1XUS/malva-ui/commit/26d43b5b))
- **dialog:** give service-opened dialogs a real surface ([be29b0b0](https://github.com/N1XUS/malva-ui/commit/be29b0b0))
- **docs:** keep the ToC out of editable example content ([cf417d5e](https://github.com/N1XUS/malva-ui/commit/cf417d5e))
- **docs:** repoint the editor API extraction at the standalone package ([a13a627a](https://github.com/N1XUS/malva-ui/commit/a13a627a))
- **editor:** keep atom blocks selected across consecutive block moves ([3635a698](https://github.com/N1XUS/malva-ui/commit/3635a698))
- **editor:** anchor the block handle to the text column and retract it when disabled ([b7cb7e76](https://github.com/N1XUS/malva-ui/commit/b7cb7e76))
- **editor:** abandon the whole block drag when the document changes ([ce30457b](https://github.com/N1XUS/malva-ui/commit/ce30457b))
- **editor:** skip every top-level widget when resolving a drop target ([c8fb9e29](https://github.com/N1XUS/malva-ui/commit/c8fb9e29))
- **editor:** remove a stranded drag image on a repeated dragstart ([3c86171e](https://github.com/N1XUS/malva-ui/commit/3c86171e))
- **editor:** restore image resizing ([c4669353](https://github.com/N1XUS/malva-ui/commit/c4669353))
- **editor:** sit the image selection ring on the image ([5125cdcb](https://github.com/N1XUS/malva-ui/commit/5125cdcb))
- **editor:** repoint the remaining SCSS mixin imports after the move ([9d2fb432](https://github.com/N1XUS/malva-ui/commit/9d2fb432))
- **editor:** flatten toolbar buttons onto the elevated surface ([24bf9eeb](https://github.com/N1XUS/malva-ui/commit/24bf9eeb))
- **editor:** parse streamed Markdown at commit and cancel on Escape ([8b047560](https://github.com/N1XUS/malva-ui/commit/8b047560))
- **editor:** give the AI streaming region its documented tint ([4a486442](https://github.com/N1XUS/malva-ui/commit/4a486442))
- **editor:** name the AI output-mode radiogroup ([e4545f78](https://github.com/N1XUS/malva-ui/commit/e4545f78))
- **editor:** route echoed whole-region AI reviews to the no-changes path ([765bb76b](https://github.com/N1XUS/malva-ui/commit/765bb76b))
- **editor:** make the AI review bar's [hidden] idle state actually hide it ([a9759241](https://github.com/N1XUS/malva-ui/commit/a9759241))
- **editor:** re-guard the AI review application after collection settles ([4a825774](https://github.com/N1XUS/malva-ui/commit/4a825774))
- **editor:** keep external value applications out of undo history ([0abef656](https://github.com/N1XUS/malva-ui/commit/0abef656))
- **i18n:** populate icuParams on editor blockMoved context ([8395a925](https://github.com/N1XUS/malva-ui/commit/8395a925))
- **i18n:** allow the live-announcement translation usage ([7da36303](https://github.com/N1XUS/malva-ui/commit/7da36303))
- **release:** repair lite-build exports maps and preflight them before publish ([0e5d335b](https://github.com/N1XUS/malva-ui/commit/0e5d335b))
- **sidebar:** pad the flyout and tooltip popup surfaces ([97b16db8](https://github.com/N1XUS/malva-ui/commit/97b16db8))

### 💅 Refactors

- **editor:** keep the block handle plugin key out of the public API ([508a2399](https://github.com/N1XUS/malva-ui/commit/508a2399))
- ⚠️ **editor:** extract the editor into @malva-ui/editor ([8a52df34](https://github.com/N1XUS/malva-ui/commit/8a52df34))

### 📖 Documentation

- list @malva-ui/editor among the public package families ([f095471b](https://github.com/N1XUS/malva-ui/commit/f095471b))
- **editor:** add json and format-switch examples ([0de4dda1](https://github.com/N1XUS/malva-ui/commit/0de4dda1))
- **editor:** add content-surface design spec ([594164f9](https://github.com/N1XUS/malva-ui/commit/594164f9))
- **editor:** add content-surface implementation plan ([a182fcf2](https://github.com/N1XUS/malva-ui/commit/a182fcf2))
- **editor:** fix two plan defects found in pre-flight scan ([070074d4](https://github.com/N1XUS/malva-ui/commit/070074d4))
- **editor:** document contentWidth and the content-measure geometry ([2f197e73](https://github.com/N1XUS/malva-ui/commit/2f197e73))
- **editor:** document the content surface and block reordering ([6dc1ff48](https://github.com/N1XUS/malva-ui/commit/6dc1ff48))
- **editor:** specify block drag ghost and movement motion ([ef8c2c59](https://github.com/N1XUS/malva-ui/commit/ef8c2c59))
- **editor:** add AI toolkit design spec ([ab0094b5](https://github.com/N1XUS/malva-ui/commit/ab0094b5))
- **editor:** showcase the AI assistant with a mock provider ([d3011c83](https://github.com/N1XUS/malva-ui/commit/d3011c83))
- **editor:** correct the AI example's mid-stream edit description ([5697b6f7](https://github.com/N1XUS/malva-ui/commit/5697b6f7))
- **editor:** record the AI barrel deviation the build enforces ([17a79b2a](https://github.com/N1XUS/malva-ui/commit/17a79b2a))
- **editor:** demo and verify the AI suggestion review flow ([c4c20de5](https://github.com/N1XUS/malva-ui/commit/c4c20de5))
- **editor:** correct the word-diff export claim and record the projection deviation ([1ac2e5b9](https://github.com/N1XUS/malva-ui/commit/1ac2e5b9))
- **editor:** record streaming pacing, chunk, and caret surface ([365ff9ba](https://github.com/N1XUS/malva-ui/commit/365ff9ba))
- **editor:** point the AI showcase references at the AI Kit page ([765cbe37](https://github.com/N1XUS/malva-ui/commit/765cbe37))

### ⚠️ Breaking Changes

- **editor:** extract the editor into @malva-ui/editor ([8a52df34](https://github.com/N1XUS/malva-ui/commit/8a52df34))
  `@malva-ui/core/editor` no longer resolves and the
  `@malva-ui/core` root barrel no longer re-exports the editor. Install
  `@malva-ui/editor` and rewrite the import specifier; every exported
  symbol keeps its name and the component behaves identically. No
  deprecated alias, matching the Mlv prefix migration's precedent. See
  docs/migrations/2026-08-editor-package.md.
  The editor was the only part of core that pulled eleven `@tiptap/*`
  peers into the package manifest. They were marked optional in
  `peerDependenciesMeta` so that consumers who never touch the editor
  would not be warned about them — muting a packaging decision rather than
  fixing it. Core now declares no Tiptap peers and no
  `peerDependenciesMeta` at all, and the Tiptap set is a plain required
  peer group of the package that actually requires it.
  The dependency direction made the split clean: the editor composes
  core's button, dialog, popup, input, menu, toolbar and colour-picker
  surfaces, but nothing in core imported the editor apart from that single
  barrel line. `@malva-ui/editor` peer-depends on `@malva-ui/core`, and a
  new `family:editor` boundary rule enforces the direction — `family:core`
  cannot reach `family:editor`, so this cannot silently regrow into a
  cycle.
  Source moved `libs/core/editor` -> `libs/editor`, which is one directory
  shallower, so every relative path that escaped the library had to move
  with it: the SCSS `@use` of the styles mixins, the tsconfig/vite/coverage
  paths, and the `CLAUDE.md` symlink, which had been pointing outside the
  repository since the move. The Nx project is renamed `core-editor` ->
  `editor` and gains a real `build` target and package root; ng-packagr
  previously built it as part of core.
  Verified: lint clean across editor, core, docs, cdk and i18n; editor
  tests 300 passed with only the known pre-existing link-mark failure;
  `build editor` and `build core` both succeed, with core's dist carrying
  no editor entry point and no Tiptap peers, and the editor's dist
  manifest carrying all eleven; docs application builds; e2e typecheck
  passes from the new root.

### ❤️ Thank You

- Denys Severyn

## 0.1.4 (2026-07-30)

### 🚀 Features

- **editor:** scaffold editor leaf and tiptap dependencies ([419e2eec](https://github.com/N1XUS/malva-ui/commit/419e2eec))
- **editor:** define nullable editor and upload contracts ([38117610](https://github.com/N1XUS/malva-ui/commit/38117610))
- **editor:** add composable tiptap extension factories ([ddc793af](https://github.com/N1XUS/malva-ui/commit/ddc793af))
- **editor:** add nullable ssr-safe editor form control ([f292b78a](https://github.com/N1XUS/malva-ui/commit/f292b78a))
- **editor:** add composite focus and command context ([2595a217](https://github.com/N1XUS/malva-ui/commit/2595a217))
- **editor:** add replaceable command toolbar modules ([40abf092](https://github.com/N1XUS/malva-ui/commit/40abf092))
- **editor:** add view-only zoom and responsive toolbar ([214d4c14](https://github.com/N1XUS/malva-ui/commit/214d4c14))
- **editor:** add color highlight and link controls ([49ec7c18](https://github.com/N1XUS/malva-ui/commit/49ec7c18))
- **editor:** add resizable table controls ([aaffbe2b](https://github.com/N1XUS/malva-ui/commit/aaffbe2b))
- **editor:** add unified cancellable image uploads ([500e33e8](https://github.com/N1XUS/malva-ui/commit/500e33e8))
- **editor:** add image dialog paste and drop ui ([39840ca8](https://github.com/N1XUS/malva-ui/commit/39840ca8))
- **editor:** preserve rich markdown formatting ([c179109a](https://github.com/N1XUS/malva-ui/commit/c179109a))
- **editor:** finish status theme and accessibility ([f56f4151](https://github.com/N1XUS/malva-ui/commit/f56f4151))
- **i18n:** add editor translations ([c75c1445](https://github.com/N1XUS/malva-ui/commit/c75c1445))

### 🩹 Fixes

- **color-picker:** square popup trigger at tight density ([68f35e60](https://github.com/N1XUS/malva-ui/commit/68f35e60))
- **editor:** preserve nonempty serialization failures ([ba2474bf](https://github.com/N1XUS/malva-ui/commit/ba2474bf))
- **editor:** harden extension factory behavior ([3cbd69f7](https://github.com/N1XUS/malva-ui/commit/3cbd69f7))
- **editor:** harden form shell synchronization ([24f5f8ee](https://github.com/N1XUS/malva-ui/commit/24f5f8ee))
- **editor:** validate markdown and initialization order ([a043eab6](https://github.com/N1XUS/malva-ui/commit/a043eab6))
- **editor:** harden disabled focus cleanup ([2b979879](https://github.com/N1XUS/malva-ui/commit/2b979879))
- **editor:** harden toolbar command interactions ([0edc0c1b](https://github.com/N1XUS/malva-ui/commit/0edc0c1b))
- **editor:** compose projected toolbar widgets ([4e8a0845](https://github.com/N1XUS/malva-ui/commit/4e8a0845))
- **editor:** restore toolbar compatibility API ([cf5f9b47](https://github.com/N1XUS/malva-ui/commit/cf5f9b47))
- **editor:** bridge standalone toolbar revisions ([05ad1405](https://github.com/N1XUS/malva-ui/commit/05ad1405))
- **editor:** harden zoom and responsive overflow ([0ff6a2d2](https://github.com/N1XUS/malva-ui/commit/0ff6a2d2))
- **editor:** preflight link policy before text replacement ([b9d7449f](https://github.com/N1XUS/malva-ui/commit/b9d7449f))
- **editor:** abort uploads when readonly ([329a1522](https://github.com/N1XUS/malva-ui/commit/329a1522))
- **editor:** preserve upload content and terminal state ([ef1527eb](https://github.com/N1XUS/malva-ui/commit/ef1527eb))
- **editor:** isolate file handling and upload control ([fc11bf08](https://github.com/N1XUS/malva-ui/commit/fc11bf08))
- **editor:** reject markdown extension lookalikes ([5756a1e5](https://github.com/N1XUS/malva-ui/commit/5756a1e5))
- **editor:** limit placeholder to empty documents ([c1512df2](https://github.com/N1XUS/malva-ui/commit/c1512df2))
- **editor:** restore compact toolbar layout ([a465fd4a](https://github.com/N1XUS/malva-ui/commit/a465fd4a))
- **editor:** enforce responsive toolbar visibility ([505e7850](https://github.com/N1XUS/malva-ui/commit/505e7850))
- **editor:** harden e2e integration coverage ([78e70ac5](https://github.com/N1XUS/malva-ui/commit/78e70ac5))
- **editor:** square toolbar controls at tight density ([f4f28f6a](https://github.com/N1XUS/malva-ui/commit/f4f28f6a))
- **i18n:** pluralize editor count messages ([73ae6da8](https://github.com/N1XUS/malva-ui/commit/73ae6da8))
- **testing-e2e:** use ESM Playwright configs ([d3f94318](https://github.com/N1XUS/malva-ui/commit/d3f94318))

### 📖 Documentation

- **core:** add approved editor design spec ([a1c14690](https://github.com/N1XUS/malva-ui/commit/a1c14690))
- **core:** add editor implementation plan ([389ab16f](https://github.com/N1XUS/malva-ui/commit/389ab16f))
- **editor:** add editor project documentation ([41393a85](https://github.com/N1XUS/malva-ui/commit/41393a85))
- **editor:** align implementation contracts ([6b1bb1c5](https://github.com/N1XUS/malva-ui/commit/6b1bb1c5))
- **editor:** close toolbar implementation task ([8cb4fbda](https://github.com/N1XUS/malva-ui/commit/8cb4fbda))
- **editor:** record zoom review completion ([d29c294d](https://github.com/N1XUS/malva-ui/commit/d29c294d))
- **editor:** record formatting review completion ([5833663e](https://github.com/N1XUS/malva-ui/commit/5833663e))
- **editor:** record table review completion ([cff74cc1](https://github.com/N1XUS/malva-ui/commit/cff74cc1))
- **editor:** record upload coordinator review completion ([ee9cbbb8](https://github.com/N1XUS/malva-ui/commit/ee9cbbb8))
- **editor:** record image ui review completion ([01395895](https://github.com/N1XUS/malva-ui/commit/01395895))
- **editor:** record markdown compatibility review ([5768a968](https://github.com/N1XUS/malva-ui/commit/5768a968))
- **editor:** record status accessibility review ([d81d739e](https://github.com/N1XUS/malva-ui/commit/d81d739e))
- **editor:** add editor showcase and api ([8953272c](https://github.com/N1XUS/malva-ui/commit/8953272c))
- **editor:** record showcase review completion ([fb817d2b](https://github.com/N1XUS/malva-ui/commit/fb817d2b))
- **editor:** document editor api and integration ([9f80ad34](https://github.com/N1XUS/malva-ui/commit/9f80ad34))
- **i18n:** document the twelve undocumented locale entry points ([529dca52](https://github.com/N1XUS/malva-ui/commit/529dca52))

### ❤️ Thank You

- Denys Severyn

## 0.1.3 (2026-07-28)

### 🚀 Features

- **chat:** scaffold core-chat leaf and @malva-ui/core/chat entry point ([37a2ba7b](https://github.com/N1XUS/malva-ui/commit/37a2ba7b))
- **chat:** add data model and render-list computation ([d6ee64f5](https://github.com/N1XUS/malva-ui/commit/d6ee64f5))
- **chat:** add mlv-chat-message bubble with statuses and retry ([a90230e4](https://github.com/N1XUS/malva-ui/commit/a90230e4))
- **chat:** render embedded replies as condensed quotes ([058be6da](https://github.com/N1XUS/malva-ui/commit/058be6da))
- **chat:** add media grid with image/gif/video cells and upload overlay ([1d6e2677](https://github.com/N1XUS/malva-ui/commit/1d6e2677))
- **chat:** add audio message player with exclusive playback ([3a8fb6ee](https://github.com/N1XUS/malva-ui/commit/3a8fb6ee))
- **chat:** add template defs, date separator, and typing indicator ([fadbba49](https://github.com/N1XUS/malva-ui/commit/fadbba49))
- **chat:** add mlv-chat container with groups, defs, skeletons, typing ([0261fc91](https://github.com/N1XUS/malva-ui/commit/0261fc91))
- **chat:** add scroll engine with windowing, loadOlder, and new-message pill ([e30b13ab](https://github.com/N1XUS/malva-ui/commit/e30b13ab))
- **chat:** add enter/leave animations, reduced motion, and density support ([7ce53e72](https://github.com/N1XUS/malva-ui/commit/7ce53e72))
- **docs:** define localized preferences ([055d841c](https://github.com/N1XUS/malva-ui/commit/055d841c))
- **docs:** group display preferences ([067dea06](https://github.com/N1XUS/malva-ui/commit/067dea06))
- **docs:** expose expanded locale packs ([7de11b31](https://github.com/N1XUS/malva-ui/commit/7de11b31))
- **i18n:** add six language packs ([0a703dd0](https://github.com/N1XUS/malva-ui/commit/0a703dd0))
- **i18n:** add Japanese language pack ([0fdc5fb4](https://github.com/N1XUS/malva-ui/commit/0fdc5fb4))
- **i18n:** add Dutch language pack ([6ce5864a](https://github.com/N1XUS/malva-ui/commit/6ce5864a))
- **i18n:** add chat translation pack across all locales ([9fb5b6cb](https://github.com/N1XUS/malva-ui/commit/9fb5b6cb))
- **i18n:** add Polish language pack ([a8dc3f56](https://github.com/N1XUS/malva-ui/commit/a8dc3f56))
- **i18n:** add Turkish language pack ([7b8e103f](https://github.com/N1XUS/malva-ui/commit/7b8e103f))
- **i18n:** add Simplified Chinese language pack ([a2f80f6d](https://github.com/N1XUS/malva-ui/commit/a2f80f6d))
- **i18n:** add Indonesian language pack ([cab00cef](https://github.com/N1XUS/malva-ui/commit/cab00cef))
- **i18n:** add chat strings to id, nl, pl, tr, and zh-Hans packs ([317ca5f8](https://github.com/N1XUS/malva-ui/commit/317ca5f8))
- **input:** add password strength directive ([14aeab07](https://github.com/N1XUS/malva-ui/commit/14aeab07))
- **layout:** add automatic theme mode ([e2eda6c5](https://github.com/N1XUS/malva-ui/commit/e2eda6c5))

### 🩹 Fixes

- **chat:** keep newest message pinned and correct bubble text colours ([48b2fd7f](https://github.com/N1XUS/malva-ui/commit/48b2fd7f))
- **i18n:** keep the latest language switch ([7658c4e2](https://github.com/N1XUS/malva-ui/commit/7658c4e2))

### 📖 Documentation

- design localized preferences popover ([e58729d2](https://github.com/N1XUS/malva-ui/commit/e58729d2))
- **chat:** add chat sublib design spec ([125ec193](https://github.com/N1XUS/malva-ui/commit/125ec193))
- **chat:** add chat sublib implementation plan ([361cfe02](https://github.com/N1XUS/malva-ui/commit/361cfe02))
- **chat:** document chat sublib and add docs-app showcase ([227eefea](https://github.com/N1XUS/malva-ui/commit/227eefea))
- **i18n:** require synchronized locale packs ([cd793165](https://github.com/N1XUS/malva-ui/commit/cd793165))
- **i18n:** design expanded locale packs ([ac01f3ea](https://github.com/N1XUS/malva-ui/commit/ac01f3ea))
- **i18n:** plan expanded locale packs ([b4b83b3c](https://github.com/N1XUS/malva-ui/commit/b4b83b3c))
- **i18n:** document fourteen locale packs ([d27d126e](https://github.com/N1XUS/malva-ui/commit/d27d126e))

### ❤️ Thank You

- Denys Severyn

## 0.1.2 (2026-07-27)

### 🚀 Features

- **core:** propagate density into detached popover panels ([c30496aa](https://github.com/N1XUS/malva-ui/commit/c30496aa))

### 🩹 Fixes

- **menu:** keep a submenu open when the cursor returns to its parent item ([b9f69f35](https://github.com/N1XUS/malva-ui/commit/b9f69f35))
- **menu:** resolve submenu hover intent from the pointer, not geometry alone ([3dd77296](https://github.com/N1XUS/malva-ui/commit/3dd77296))
- **styles:** one padding and hover vocabulary for popover list surfaces ([02f34a3f](https://github.com/N1XUS/malva-ui/commit/02f34a3f))

### ❤️ Thank You

- Denys Severyn

## 0.1.1 (2026-07-27)

### 🩹 Fixes

- **popup:** drop the popup surface's own padding ([c8e48408](https://github.com/N1XUS/malva-ui/commit/c8e48408))

### 💅 Refactors

- **pagination:** use the shared dropdown panel for items-per-page ([4b365821](https://github.com/N1XUS/malva-ui/commit/4b365821))

### ❤️ Thank You

- Denys Severyn

## 0.1.0 (2026-07-27)

### 🚀 Features

- add lumi-accordion on aria accordion pattern ([731298ad](https://github.com/N1XUS/malva-ui/commit/731298ad))
- smt ([bb422dbb](https://github.com/N1XUS/malva-ui/commit/bb422dbb))
- **action-bar:** add lumiActionBarActions directive and externalize logo styles ([39d99765](https://github.com/N1XUS/malva-ui/commit/39d99765))
- **autocomplete:** typeahead directive for any text input ([68454097](https://github.com/N1XUS/malva-ui/commit/68454097))
- **autocomplete:** inline completion and floating panel surface ([11265eac](https://github.com/N1XUS/malva-ui/commit/11265eac))
- **color-picker:** redesign popup as input popover ([e2ba7fad](https://github.com/N1XUS/malva-ui/commit/e2ba7fad))
- **color-picker:** support selectable output formats ([c0a335cb](https://github.com/N1XUS/malva-ui/commit/c0a335cb))
- **color-picker:** add deferred popup updates ([14455a21](https://github.com/N1XUS/malva-ui/commit/14455a21))
- **combobox:** option groups and in-sheet search input for fullscreen mode ([d38dabde](https://github.com/N1XUS/malva-ui/commit/d38dabde))
- **core:** date and time pickers adopt popup mobileMode auto ([42fc2f85](https://github.com/N1XUS/malva-ui/commit/42fc2f85))
- **core:** add page layout and refine sidebar collapse ([6ed0e170](https://github.com/N1XUS/malva-ui/commit/6ed0e170))
- **core:** add signal forms support ([29f0fe89](https://github.com/N1XUS/malva-ui/commit/29f0fe89))
- **docs:** add a fullscreen toggle to example containers ([de872e7b](https://github.com/N1XUS/malva-ui/commit/de872e7b))
- **docs:** build-time API extraction pipeline (ts-morph) ([80920b43](https://github.com/N1XUS/malva-ui/commit/80920b43))
- **docs:** add examples/api tabs, a componentless api route, and observer-based toc ([988c28d2](https://github.com/N1XUS/malva-ui/commit/988c28d2))
- **docs:** add a public Properties section to the API viewer ([56552142](https://github.com/N1XUS/malva-ui/commit/56552142))
- **docs:** unify navigation and global preferences ([b6298362](https://github.com/N1XUS/malva-ui/commit/b6298362))
- **dropdown:** option groups, shared option matcher, and match-highlight pipe ([37b7e966](https://github.com/N1XUS/malva-ui/commit/37b7e966))
- **dropdown:** rank prefix matches first in shared option filter ([90ae3a34](https://github.com/N1XUS/malva-ui/commit/90ae3a34))
- **form-utils:** aria CVA bridge + input forwarding groundwork ([240b3597](https://github.com/N1XUS/malva-ui/commit/240b3597))
- **form-utils:** value-gated clear button, inline X before chevron, chip backspace ([4f3b9b34](https://github.com/N1XUS/malva-ui/commit/4f3b9b34))
- **form-utils:** signal forms phase 0 — matrix helper, formField proof, dead token removal ([f80a91df](https://github.com/N1XUS/malva-ui/commit/f80a91df))
- **form-utils:** signal forms phase 1 — signal control bases + dual-path form-field ([aca147f7](https://github.com/N1XUS/malva-ui/commit/aca147f7))
- **i18n:** localize hard-coded aria strings across components ([62771202](https://github.com/N1XUS/malva-ui/commit/62771202))
- **i18n:** popup close label and sidebar status strings ([1f91398e](https://github.com/N1XUS/malva-ui/commit/1f91398e))
- **input:** migrate mlv-input to SignalFormControlBase (signal forms slice 1) ([7d35010b](https://github.com/N1XUS/malva-ui/commit/7d35010b))
- **menu:** menubar component (File/Edit/View pattern) ([a703925e](https://github.com/N1XUS/malva-ui/commit/a703925e))
- **page:** add lumi-page-shell app-shell component ([5f8ba25d](https://github.com/N1XUS/malva-ui/commit/5f8ba25d))
- **page:** add shell contrast color helpers ([75e44422](https://github.com/N1XUS/malva-ui/commit/75e44422))
- **page:** support adaptive shell colors ([92427ae8](https://github.com/N1XUS/malva-ui/commit/92427ae8))
- **popup:** mobile fullscreen sheet mode and leave-animation fallback ([838da41c](https://github.com/N1XUS/malva-ui/commit/838da41c))
- **select:** option groups and mobile fullscreen popover wiring ([652194da](https://github.com/N1XUS/malva-ui/commit/652194da))
- **sidebar:** status indicator in collapsed state, badges in expanded rows and flyout titles ([8ec996e3](https://github.com/N1XUS/malva-ui/commit/8ec996e3))
- **status-indicator:** semantic status dot with optional ripple pulse ([dafcf2a9](https://github.com/N1XUS/malva-ui/commit/dafcf2a9))
- **styles:** adopt CSS cascade layers for global stylesheets ([366868d0](https://github.com/N1XUS/malva-ui/commit/366868d0))
- **tabs:** add boxed appearance and routable mode ([36fe7d4c](https://github.com/N1XUS/malva-ui/commit/36fe7d4c))
- **tabs:** content density, segmented boxed restyle, hover polish ([9e9ca766](https://github.com/N1XUS/malva-ui/commit/9e9ca766))
- **tokenizer:** backspace arms and removes the last chip ([850869c4](https://github.com/N1XUS/malva-ui/commit/850869c4))
- **toolbar:** add opt-in aria roving focus directives ([6bef7331](https://github.com/N1XUS/malva-ui/commit/6bef7331))

### 🩹 Fixes

- keyboard operability, roles, and focus management across components ([47492fc6](https://github.com/N1XUS/malva-ui/commit/47492fc6))
- smt ([b3d40709](https://github.com/N1XUS/malva-ui/commit/b3d40709))
- smt ([dd69ff0b](https://github.com/N1XUS/malva-ui/commit/dd69ff0b))
- **avatar:** expose avatars as a labelled role=img ([b386f8c8](https://github.com/N1XUS/malva-ui/commit/b386f8c8))
- **breadcrumb:** render projected item labels via a single content slot ([ccf0cc11](https://github.com/N1XUS/malva-ui/commit/ccf0cc11))
- **button:** theme-aware text colour for outlined/transparent variants ([547dbe0d](https://github.com/N1XUS/malva-ui/commit/547dbe0d))
- **checkbox:** forward host aria-label to the inner input, add ariaLabel inputs ([66e4e5a8](https://github.com/N1XUS/malva-ui/commit/66e4e5a8))
- **color-picker:** restore mode-tabs tablist semantics ([36c02ba5](https://github.com/N1XUS/malva-ui/commit/36c02ba5))
- **combobox:** audit-driven behavior, a11y, and layout fixes ([2d9836c6](https://github.com/N1XUS/malva-ui/commit/2d9836c6))
- **combobox:** full-screen sheet opens on click, not focus ([36cacc79](https://github.com/N1XUS/malva-ui/commit/36cacc79))
- **core:** boolean coercion, narrowed import catch, stroke tokens ([584e31b3](https://github.com/N1XUS/malva-ui/commit/584e31b3))
- **core:** harden package and interaction contracts ([cdaeecd5](https://github.com/N1XUS/malva-ui/commit/cdaeecd5))
- **core:** open the search overlay from click/Enter/Space, not focus ([01d230f3](https://github.com/N1XUS/malva-ui/commit/01d230f3))
- **data-table:** sort-button headers, named actions column, checkbox labels ([b28c59c9](https://github.com/N1XUS/malva-ui/commit/b28c59c9))
- **docs:** add accessible names to icon-only buttons ([bb77e2eb](https://github.com/N1XUS/malva-ui/commit/bb77e2eb))
- **docs:** make the api child route valid so the app boots ([cd3bbb50](https://github.com/N1XUS/malva-ui/commit/cd3bbb50))
- **docs:** clear file-upload demo intervals on destroy ([921da024](https://github.com/N1XUS/malva-ui/commit/921da024))
- **drawer:** accessible-name fallback via ariaLabel/ariaLabelledBy ([1a76d579](https://github.com/N1XUS/malva-ui/commit/1a76d579))
- **drawer:** import button icon directive ([6b693461](https://github.com/N1XUS/malva-ui/commit/6b693461))
- **form-utils:** decouple LumiFocusableGroupItem from FocusableOption ([3d007918](https://github.com/N1XUS/malva-ui/commit/3d007918))
- **input:** align constraint inputs with the signal-forms FormUiControl contract ([09825766](https://github.com/N1XUS/malva-ui/commit/09825766))
- **list:** forward consumer listbox id into aria Listbox ([2feb5aeb](https://github.com/N1XUS/malva-ui/commit/2feb5aeb))
- **page:** stop an offcanvas sidebar from claiming the whole shell body ([388062e5](https://github.com/N1XUS/malva-ui/commit/388062e5))
- **radio:** forward host aria-label to the inner input, add ariaLabel inputs ([e60a476f](https://github.com/N1XUS/malva-ui/commit/e60a476f))
- **sidebar:** offcanvas content, interactive title rows, flyout keyboard, aria-current ([460fba2c](https://github.com/N1XUS/malva-ui/commit/460fba2c))
- **sidebar:** collapsed-mode arrows, avatar text, indicator position ([8f91f0a0](https://github.com/N1XUS/malva-ui/commit/8f91f0a0))
- **split-pane:** add ARIA window-splitter values to resize handles ([9b184ff1](https://github.com/N1XUS/malva-ui/commit/9b184ff1))
- **stepper:** name step tabs and inert inactive vertical panels ([a0587556](https://github.com/N1XUS/malva-ui/commit/a0587556))
- **stepper:** move vertical tabpanels out of the tablist subtree ([7b1e8727](https://github.com/N1XUS/malva-ui/commit/7b1e8727))
- **styles:** define the missing mlv-slide-down keyframes ([0b818bcb](https://github.com/N1XUS/malva-ui/commit/0b818bcb))
- **switch:** forward host aria-label to the inner input, add ariaLabel inputs ([20b195e7](https://github.com/N1XUS/malva-ui/commit/20b195e7))
- **switch:** roving tab stop follows arrow-key focus in switch group ([5f1bb18b](https://github.com/N1XUS/malva-ui/commit/5f1bb18b))
- **tabs:** pin active tab through overflow repartition and damp recalc jitter ([9c8a637a](https://github.com/N1XUS/malva-ui/commit/9c8a637a))
- **tabs:** sliding boxed pill and drop the routed header anchor ([d3265ae1](https://github.com/N1XUS/malva-ui/commit/d3265ae1))
- **tree:** label row checkboxes via the lumi-checkbox ariaLabel input ([2c717e8a](https://github.com/N1XUS/malva-ui/commit/2c717e8a))

### 🔥 Performance

- **cdk:** fade scroll handling outside the zone with rAF coalescing ([ceb77805](https://github.com/N1XUS/malva-ui/commit/ceb77805))
- **color-picker:** fix pointer-listener leak, cache drag rect, token cleanups ([1c07c891](https://github.com/N1XUS/malva-ui/commit/1c07c891))
- **core:** tree selection set, slider track viewChild, outside-zone drags ([262a080e](https://github.com/N1XUS/malva-ui/commit/262a080e))
- **data-table:** memoize cell styles/contexts/templates, outside-zone resize ([ba3629e0](https://github.com/N1XUS/malva-ui/commit/ba3629e0))

### 💅 Refactors

- apply code-quality conventions (OnPush, naming, hygiene) ([a1492c85](https://github.com/N1XUS/malva-ui/commit/a1492c85))
- ⚠️ unify semantic tone and size vocabularies ([f915f6d5](https://github.com/N1XUS/malva-ui/commit/f915f6d5))
- ⚠️ rebrand Lumina UI as Malva UI ([95890786](https://github.com/N1XUS/malva-ui/commit/95890786))
- ⚠️ prefix public API with Mlv, redesign toast, add overlay search ([1a6ec4dd](https://github.com/N1XUS/malva-ui/commit/1a6ec4dd))
- ⚠️ **button:** remove the dead size input and ButtonSize type ([7a045576](https://github.com/N1XUS/malva-ui/commit/7a045576))
- **cdk:** overlay base lib, shared utils, dialog/drawer dedup ([82a67d3e](https://github.com/N1XUS/malva-ui/commit/82a67d3e))
- **color-picker:** canvas drag via fromEvent streams ([ea57b2ea](https://github.com/N1XUS/malva-ui/commit/ea57b2ea))
- **combobox:** bridge CVA values to aria listbox panel ([cbfd9083](https://github.com/N1XUS/malva-ui/commit/cbfd9083))
- **core:** replace hand-rolled id counters with lumiNextId ([b4401749](https://github.com/N1XUS/malva-ui/commit/b4401749))
- **core:** own-template querySelector lookups become signal view queries ([1dbe5110](https://github.com/N1XUS/malva-ui/commit/1dbe5110))
- **core:** enforce library quality contracts ([7c85e7d4](https://github.com/N1XUS/malva-ui/commit/7c85e7d4))
- **core:** streamline libraries and docs UI ([280f5a37](https://github.com/N1XUS/malva-ui/commit/280f5a37))
- **data-table:** prototype aria grid cell navigation behind flag ([f9d78951](https://github.com/N1XUS/malva-ui/commit/f9d78951))
- **dropdown:** shared ActiveDescendant helper and optionId ([487991f1](https://github.com/N1XUS/malva-ui/commit/487991f1))
- **form-utils:** migrate rating/radio-group/color-picker to CVA ([9c152234](https://github.com/N1XUS/malva-ui/commit/9c152234))
- **form-utils:** alias component state types to FormState ([16288b34](https://github.com/N1XUS/malva-ui/commit/16288b34))
- **list:** migrate lumi-list selection to @angular/aria listbox ([489461e5](https://github.com/N1XUS/malva-ui/commit/489461e5))
- **menu:** add type-ahead; document aria menu non-adoption ([92598b39](https://github.com/N1XUS/malva-ui/commit/92598b39))
- **select:** bridge CVA values to aria listbox panel ([a1d86411](https://github.com/N1XUS/malva-ui/commit/a1d86411))
- **styles:** tidy BEM classes, token fixes, reduced-motion ([e79732fa](https://github.com/N1XUS/malva-ui/commit/e79732fa))
- **tabs:** migrate tab group to @angular/aria tabs ([9dc6af07](https://github.com/N1XUS/malva-ui/commit/9dc6af07))
- **time-picker:** migrate columns to aria activedescendant listbox ([a41539ea](https://github.com/N1XUS/malva-ui/commit/a41539ea))
- **tree:** migrate to @angular/aria tree pattern ([4ac167a9](https://github.com/N1XUS/malva-ui/commit/4ac167a9))
- **utils:** move lumi-spacer styles into an external stylesheet ([a96b6fb1](https://github.com/N1XUS/malva-ui/commit/a96b6fb1))

### 📖 Documentation

- sync project documentation, plans, and symlinks ([74cb90dd](https://github.com/N1XUS/malva-ui/commit/74cb90dd))
- tick aria migration wave-2 checkboxes ([6c27332b](https://github.com/N1XUS/malva-ui/commit/6c27332b))
- aria phase-3 plan notes and QA memory ([d2f3e4ab](https://github.com/N1XUS/malva-ui/commit/d2f3e4ab))
- example pages and project docs for the mobile/menubar/indicator phase ([9a1ce546](https://github.com/N1XUS/malva-ui/commit/9a1ce546))
- record a11y fixes and known axe exceptions per library ([c278a512](https://github.com/N1XUS/malva-ui/commit/c278a512))
- restore intended button sizing via lumiDensity ([0e72f473](https://github.com/N1XUS/malva-ui/commit/0e72f473))
- normalize every example to a heading + description ([f9bb34f8](https://github.com/N1XUS/malva-ui/commit/f9bb34f8))
- document page-shell, action-bar actions, and spacer changes ([bb488277](https://github.com/N1XUS/malva-ui/commit/bb488277))
- design spec for docs API tabs, boxed & routable tabs, ToC fix ([1dd3c306](https://github.com/N1XUS/malva-ui/commit/1dd3c306))
- clarify Examples/API panels are mutually exclusive in the spec ([e2a185c5](https://github.com/N1XUS/malva-ui/commit/e2a185c5))
- **button:** define close density behavior ([84620449](https://github.com/N1XUS/malva-ui/commit/84620449))
- **button:** plan close density implementation ([50781922](https://github.com/N1XUS/malva-ui/commit/50781922))
- **color-picker:** design input popup trigger ([cf8b60f5](https://github.com/N1XUS/malva-ui/commit/cf8b60f5))
- **color-picker:** define formats and live behavior ([3ad4304b](https://github.com/N1XUS/malva-ui/commit/3ad4304b))
- **docs:** encapsulation exemption for docs app, protected-prefix policy, stale tokens ([35a3c71a](https://github.com/N1XUS/malva-ui/commit/35a3c71a))
- **docs:** signal forms migration plan (inventory, phases, risk gates) ([2791f378](https://github.com/N1XUS/malva-ui/commit/2791f378))
- **page:** design custom shell colors ([b3792fc9](https://github.com/N1XUS/malva-ui/commit/b3792fc9))
- **page:** document adaptive shell colors ([2f4c14a5](https://github.com/N1XUS/malva-ui/commit/2f4c14a5))
- **page:** design shell color demo controls ([aa6f442b](https://github.com/N1XUS/malva-ui/commit/aa6f442b))
- **page:** add shell color controls ([372be26e](https://github.com/N1XUS/malva-ui/commit/372be26e))
- **tabs:** drop stale LocationStrategy dep row, add cdk/density ([0aadbdae](https://github.com/N1XUS/malva-ui/commit/0aadbdae))

### 📦 Build

- **release:** surface every commit type in the generated changelog ([33deb6ca](https://github.com/N1XUS/malva-ui/commit/33deb6ca))

### ⚠️ Breaking Changes

- prefix public API with Mlv, redesign toast, add overlay search ([1a6ec4dd](https://github.com/N1XUS/malva-ui/commit/1a6ec4dd))
  every public export from `libs/` has been renamed. See
  docs/migrations/2026-07-mlv-prefix.md for the complete old -> new mapping.
  `resolveToastRole()` is now `resolveToastPoliteness()`; toast and notification
  items no longer set `role` and require the `.cdk-visually-hidden` rules from
  `styles/malva-ui.css`.
- rebrand Lumina UI as Malva UI ([95890786](https://github.com/N1XUS/malva-ui/commit/95890786))
- **button:** remove the dead size input and ButtonSize type ([7a045576](https://github.com/N1XUS/malva-ui/commit/7a045576))
  the button size input and the exported ButtonSize type are
  removed. Use lumiDensity (compact/spacious/etc.) to size buttons.
- unify semantic tone and size vocabularies ([f915f6d5](https://github.com/N1XUS/malva-ui/commit/f915f6d5))
  display-surface tone and size APIs were renamed with no
  deprecated aliases. See docs/migrations/2026-07-api-unification-tone-size.md.

### ❤️ Thank You

- Denis Severin
- Denys Severyn

# Changelog

All notable changes to the Malva UI Library will be documented in this file.

This changelog is automatically generated by [Nx Release](https://nx.dev/features/manage-releases) from [Conventional Commits](https://www.conventionalcommits.org/).

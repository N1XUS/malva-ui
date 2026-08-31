import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/** Marks the breadcrumb template rendered at the start of a page header. */
@Directive({ selector: '[mlvPageBreadcrumb]' })
export class MlvPageBreadcrumb extends MlvStructural {}

/** Marks the decorative leading icon beside the page title. */
@Directive({ selector: '[mlvPageHeaderIcon]' })
export class MlvPageHeaderIcon extends MlvStructural {}

/** Marks the page title template. Consumers should project one semantic `<h1>`. */
@Directive({ selector: '[mlvPageTitle]' })
export class MlvPageTitle extends MlvStructural {}

/**
 * Marks inline status content rendered directly after the page title,
 * such as draft/live badges or an unsaved-changes indicator.
 */
@Directive({ selector: '[mlvPageHeaderStatus]' })
export class MlvPageHeaderStatus extends MlvStructural {}

/** Marks the primary actions rendered after the page title. */
@Directive({ selector: '[mlvPageHeaderActions]' })
export class MlvPageHeaderActions extends MlvStructural {}

/** Marks supporting descriptive content below the title row. */
@Directive({ selector: '[mlvPageHeaderDescription]' })
export class MlvPageHeaderDescription extends MlvStructural {}

/** Marks page metadata such as ownership, visibility, or last-updated time. */
@Directive({ selector: '[mlvPageHeaderMeta]' })
export class MlvPageHeaderMeta extends MlvStructural {}

/** Marks navigation tabs rendered at the bottom of the header. */
@Directive({ selector: '[mlvPageHeaderTabs]' })
export class MlvPageHeaderTabs extends MlvStructural {}

/** Marks actions aligned to the trailing edge of the page-tabs row. */
@Directive({ selector: '[mlvPageHeaderTabsActions]' })
export class MlvPageHeaderTabsActions extends MlvStructural {}

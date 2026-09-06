import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Writes the live `muted` property on a `<video>` the moment Angular creates
 * it. Applied beside the static `muted` content attribute the template also
 * carries — today both halves are load-bearing and neither is redundant:
 *
 * - the **attribute** is what serialises into the server payload, so an
 *   autoplaying `gif` cell cannot make noise in the window between parse and
 *   hydration. It replaces a `[muted]="true"` property binding that could
 *   never serialise and logged one NG0303 per rendered `<video>` on every
 *   server render — `'muted' in element` is `false` on domino's
 *   `HTMLVideoElement` (issue #136, the `indeterminate` defect class of #124);
 * - this **property write** is what actually silences an element the browser
 *   created with `createElement` rather than the parser, and what Chrome's
 *   muted-autoplay allowance reads. Without it the `gif` cell is an unmuted
 *   `autoplay` video and the browser refuses to play it.
 *
 * The second half is an **engine divergence in flight, not a spec invariant**,
 * and it is expected to expire. The current HTML Standard gives a media
 * element a tristate *muted state* (`true` / `false` / `"default"`, initially
 * `"default"`) and calls the element muted when "its muted state is
 * `"default"` and it has a muted content attribute" — under that text
 * `createElement` + `setAttribute('muted', '')` already reports
 * `muted === true` and the attribute alone would be the whole fix. Gecko
 * implemented it in Firefox 153 (bugzilla 2037015). Chromium and jsdom 22 have
 * not: measured in Chrome 152, `createElement` + `setAttribute` leaves
 * `muted === false` (`defaultMuted === true`), and a parsed `<video muted>`
 * still reports `muted === true` after `removeAttribute('muted')` — a result
 * only the older one-time-transfer model produces. Delete this directive when
 * the engines the library targets have all landed the tristate; until then,
 * dropping it silently unmutes every client-rendered chat video in Chrome.
 *
 * Deliberately a directive rather than an `afterRenderEffect` in
 * `MlvChatMediaGrid`: `mlv-chat` does not virtualise, so a long thread holds
 * one live grid per message carrying media (plus one per quoted reply), and an
 * after-render sequence per grid would be walked on every
 * `ApplicationRef.tick()` — the cost `libs/core/CLAUDE.md` warns about for a
 * repeated child element. A constructor write costs nothing after creation and
 * covers a cell that arrives on a later render for free, because a later cell
 * is a new element with its own directive instance.
 */
@Directive({ selector: 'video[mlvChatMuted]' })
export class MlvChatMutedVideo {
  constructor() {
    // Not a template binding, so it never reaches the unknown-property check
    // that raises NG0303. On the server this writes a harmless expando onto
    // the domino element and changes no markup — the attribute in the template
    // is what the payload carries.
    inject(ElementRef<HTMLVideoElement>).nativeElement.muted = true;
  }
}

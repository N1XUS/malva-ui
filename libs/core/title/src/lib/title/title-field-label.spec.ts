import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvTitle } from './title';

/**
 * The idiom `apps/docs` already ships four times over
 * (`pages/page/examples/1`, `…/4`, `…/2` twice): a section names itself from
 * its heading, and the heading carries `[mlvTitle]`. `id` is an inherited
 * `input<string>`, and a **static** attribute both feeds the directive input
 * and stays in the DOM — so the id the section points at is the host's, while
 * the control's own focus target must carry a different one.
 */
@Component({
  imports: [MlvTitle],
  template: `
    <section aria-labelledby="overview-title">
      <h2 id="overview-title" mlvTitle editable ariaLabel="Section heading">
        Overview
      </h2>
    </section>
  `,
})
class SectionHeadingHost {}

/** The same title composed into a field, to pin what the `for` resolves to. */
@Component({
  imports: [MlvFormField, MlvLabel, MlvTitle],
  template: `
    <mlv-form-field>
      <mlv-label>Document title</mlv-label>
      <h2 id="doc-title" mlvTitle editable>Overview</h2>
    </mlv-form-field>
  `,
})
class FieldHost {}

describe('MlvTitle — id ownership when the host already has one (#197 review)', () => {
  async function render<T>(host: new () => T): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('gives the editor a different id from the heading the consumer named', async () => {
    const host = await render(SectionHeadingHost);

    const heading = host.querySelector('h2') as HTMLElement;
    const textarea = host.querySelector('textarea') as HTMLTextAreaElement;

    expect(heading.id).toBe('overview-title');
    expect(textarea.id).not.toBe('');
    // Two elements sharing one id is not a style question: the section's
    // `aria-labelledby` resolves to whichever comes first in the document.
    expect(textarea.id).not.toBe(heading.id);
    expect(host.querySelectorAll('[id="overview-title"]').length).toBe(1);
  });

  it('has no axe violations for a heading whose id is ARIA-referenced', async () => {
    const host = await render(SectionHeadingHost);

    // Note this sweep is *not* what catches the duplicate id: `duplicate-id`
    // ships deprecated-off in axe-core 4.12, and `duplicate-id-aria` resolves
    // to `incomplete` under jsdom (measured), which `expectNoAxeViolations`
    // does not assert on. The id assertion above is the load-bearing one; this
    // guards everything else about the shape.
    await expectNoAxeViolations(host);
  });

  it('points a projected <mlv-label> at the editor, not at the heading', async () => {
    const host = await render(FieldHost);

    const label = host.querySelector('label') as HTMLLabelElement;
    const textarea = host.querySelector('textarea') as HTMLTextAreaElement;

    // `for` must name the labelable element — the <textarea> — and a heading
    // is not labelable, so resolving to the host id would be a dangling
    // association dressed up as a working one.
    expect(label.getAttribute('for')).toBe(textarea.id);
    expect(label.getAttribute('for')).not.toBe('doc-title');
  });
});

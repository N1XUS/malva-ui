import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvTitle } from './title';

@Component({
  imports: [MlvTitle],
  template: `<h3 mlvTitle>Release Notes</h3>`,
})
class HeadingHostComponent {}

@Component({
  imports: [MlvTitle],
  template: `<div mlvTitle level="4">System Overview</div>`,
})
class ExplicitLevelHostComponent {}

@Component({
  imports: [MlvTitle],
  template: `<h2 mlvTitle [editable]="true">Draft heading</h2>`,
})
class EditableProjectionHostComponent {}

@Component({
  imports: [MlvTitle, FormsModule],
  template: `<h2 mlvTitle editable name="headline" [(ngModel)]="title">
    {{ title }}
  </h2>`,
})
class NgModelHostComponent {
  title = 'Template Driven';
}

@Component({
  imports: [MlvTitle, ReactiveFormsModule],
  template: `<h2
    mlvTitle
    editable
    [formControl]="control"
    aria-label="Document title"
  ></h2>`,
})
class ReactiveFormsHostComponent {
  readonly control = new FormControl('Reactive Headline', {
    nonNullable: true,
  });
}

@Component({
  imports: [MlvTitle],
  template: `
    <h1 mlvTitle [value]="headline()" (valueChange)="headline.set($event)">
      {{ headline() }}
    </h1>
  `,
})
class ModelHostComponent {
  readonly headline = signal('Model Value');
}

describe('MlvTitle', () => {
  async function createFixture<T>(
    component: new () => T,
  ): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [
        component,
        HeadingHostComponent,
        ExplicitLevelHostComponent,
        EditableProjectionHostComponent,
        NgModelHostComponent,
        ReactiveFormsHostComponent,
        ModelHostComponent,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('infers level from the host heading tag', async () => {
    const fixture = await createFixture(HeadingHostComponent);
    const title = fixture.nativeElement.querySelector('h3');

    expect(title?.getAttribute('data-level')).toBe('3');
    expect(title?.getAttribute('role')).toBeNull();
  });

  it('applies heading semantics when used on a non-heading element', async () => {
    const fixture = await createFixture(ExplicitLevelHostComponent);
    const title = fixture.nativeElement.querySelector('div');

    expect(title?.getAttribute('data-level')).toBe('4');
    expect(title?.getAttribute('role')).toBe('heading');
    expect(title?.getAttribute('aria-level')).toBe('4');
  });

  it('hydrates editable mode from projected content and syncs textarea edits', async () => {
    const fixture = await createFixture(EditableProjectionHostComponent);
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe('Draft heading');

    textarea.value = 'Published heading';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const pre = fixture.nativeElement.querySelector(
      '.mlv-title__pre',
    ) as HTMLPreElement;
    expect(pre.textContent).toContain('Published heading');
  });

  it('keeps editable mode visually neutral without textarea chrome', async () => {
    const fixture = await createFixture(EditableProjectionHostComponent);
    const title = fixture.nativeElement.querySelector('h2') as HTMLElement;
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    expect(title.classList.contains('mlv-title--editable')).toBe(true);
    expect(textarea.getAttribute('rows')).toBe('1');
  });

  it('supports template-driven forms through ngModel', async () => {
    const fixture = await createFixture(NgModelHostComponent);
    const component = fixture.componentInstance;
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe('Template Driven');

    textarea.value = 'Template Updated';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.title).toBe('Template Updated');
  });

  it('supports reactive forms updates and writes control values into the textarea', async () => {
    const fixture = await createFixture(ReactiveFormsHostComponent);
    const component = fixture.componentInstance;
    const textarea = fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;

    expect(textarea.value).toBe('Reactive Headline');

    component.control.setValue('Reactive Updated');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(textarea.value).toBe('Reactive Updated');
  });

  it('renders the signal model value when bound through the value model', async () => {
    const fixture = await createFixture(ModelHostComponent);
    const title = fixture.nativeElement.querySelector('h1');

    expect(title?.textContent?.trim()).toContain('Model Value');
  });
});

/**
 * Accessibility sweep.
 *
 * `[mlvTitle]` decorates the host itself, so it has two quite different shapes.
 * Static: a native `h1`–`h6` keeps its own semantics and the component adds
 * nothing, while a non-heading host is given `role="heading"` + `aria-level`,
 * which is the branch `aria-required-attr` and `heading-order` judge. Editable:
 * a real `<textarea>` is overlaid on an `aria-hidden` `<pre>` INSIDE the
 * heading, and the projected content is hidden behind
 * `[attr.aria-hidden]` — so the heading's accessible text and the textarea's
 * accessible name come from different places and both have to hold.
 *
 * The editable hosts below are named, and deliberately: `MlvTitle` cannot
 * invent a name, and `label` accepts `aria-label` or a non-empty `placeholder`.
 * An editable title given neither is a real, live gap — see the note on the
 * bare-editable case below.
 */
describe('MlvTitle accessibility', () => {
  @Component({
    imports: [MlvTitle],
    template: `
      <h1 mlvTitle>Quarterly roadmap</h1>
      <h2 mlvTitle>Revenue</h2>
      <h3 mlvTitle>Detail</h3>
      <div mlvTitle level="4" id="synthetic">Section heading</div>
    `,
  })
  class StaticTitleA11yHost {}

  @Component({
    imports: [MlvTitle],
    template: `
      <!-- The docs' model-bound editable heading: named by its placeholder. -->
      <h2
        mlvTitle
        editable
        placeholder="Add a headline"
        [value]="headline()"
        (valueChange)="headline.set($event)"
        id="by-placeholder"
      >
        {{ headline() }}
      </h2>

      <!--
        Explicitly named, the form-field-free way to label one. The projected
        text is what a static heading would have read; editable mode hides it
        behind aria-hidden, so it is invisible to the sweep either way and is
        here because a heading element with no content is its own lint error.
      -->
      <h2 mlvTitle editable ariaLabel="Document title" id="by-label">
        Document title
      </h2>

      <!-- Read-only and disabled still render the textarea. -->
      <h3 mlvTitle editable readonly ariaLabel="Locked title" id="ro">
        Locked title
      </h3>
      <h3 mlvTitle editable disabled ariaLabel="Disabled title" id="off">
        Disabled title
      </h3>
    `,
  })
  class EditableTitleA11yHost {
    readonly headline = signal('Draft heading');
  }

  it('has no axe violations for static headings, inferred and synthetic', async () => {
    await TestBed.configureTestingModule({
      imports: [StaticTitleA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(StaticTitleA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: the three native headings claim no ARIA of their own (their tag
    // already says it), and the `<div>` host is a synthetic level-4 heading.
    expect(host.querySelector('h1')?.getAttribute('role')).toBeNull();
    expect(host.querySelector('h1')?.getAttribute('aria-level')).toBeNull();
    const synthetic = host.querySelector('#synthetic') as HTMLElement;
    expect(synthetic.getAttribute('role')).toBe('heading');
    expect(synthetic.getAttribute('aria-level')).toBe('4');

    await expectNoAxeViolations(host);
  });

  it('has no axe violations in editable mode', async () => {
    await TestBed.configureTestingModule({
      imports: [EditableTitleA11yHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(EditableTitleA11yHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    // State: four textareas inside headings, each with a name from one of the
    // two sources `label` accepts, and each paired with an `aria-hidden`
    // measuring `<pre>` so the heading is not read twice.
    const areas = [
      ...host.querySelectorAll('textarea.mlv-title__textarea'),
    ] as HTMLTextAreaElement[];
    expect(areas).toHaveLength(4);
    expect(host.querySelector('#by-placeholder textarea')).toHaveProperty(
      'placeholder',
      'Add a headline',
    );
    expect(
      host.querySelector('#by-label textarea')?.getAttribute('aria-label'),
    ).toBe('Document title');
    expect(
      [...host.querySelectorAll('pre.mlv-title__pre')].every(
        (el) => el.getAttribute('aria-hidden') === 'true',
      ),
    ).toBe(true);
    // Projected content is hidden while editable so the heading's name comes
    // from one place only.
    expect(
      host
        .querySelector('#by-placeholder .mlv-title__projection')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');

    await expectNoAxeViolations(host);
  });
});

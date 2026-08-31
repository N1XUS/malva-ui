import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
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

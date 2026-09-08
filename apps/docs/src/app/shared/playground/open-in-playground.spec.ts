import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { vi } from 'vitest';
import { OpenInPlaygroundComponent } from './open-in-playground';
import type { PlaygroundSourceFile } from './playground-project';

const PORTABLE: readonly PlaygroundSourceFile[] = [
  {
    type: 'TypeScript',
    content: `import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton],
  templateUrl: './index.html',
})
export default class ButtonBasicExampleComponent {}
`,
  },
  { type: 'HTML', content: '<button mlvButton>Save</button>\n' },
];

const NON_PORTABLE: readonly PlaygroundSourceFile[] = [
  {
    type: 'TypeScript',
    content: PORTABLE[0].content.replace(
      "from '@malva-ui/core/button'",
      "from '../../../../shared'",
    ),
  },
];

describe('OpenInPlaygroundComponent', () => {
  const createFixture = async (
    files: readonly PlaygroundSourceFile[],
    heading = 'Button',
  ) => {
    const fixture = TestBed.configureTestingModule({
      imports: [OpenInPlaygroundComponent],
      providers: [provideMlvI18nTesting()],
    }).createComponent(OpenInPlaygroundComponent);

    fixture.componentRef.setInput('files', files);
    fixture.componentRef.setInput('heading', heading);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  const trigger = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.open-in-playground',
    );

  it('renders nothing before any source has resolved', async () => {
    const fixture = await createFixture([]);

    expect(trigger(fixture)).toBeNull();
  });

  it('renders nothing for an example that cannot be lifted out of the docs app', async () => {
    const fixture = await createFixture(NON_PORTABLE);

    expect(trigger(fixture)).toBeNull();
  });

  it('renders a named, keyboard-operable button for a portable example', async () => {
    const fixture = await createFixture(PORTABLE);
    const button = trigger(fixture) as HTMLButtonElement;

    expect(button.tagName).toBe('BUTTON');
    // Not `submit`: the docs app renders forms, and a default-type button
    // inside one would submit it instead of opening the playground.
    expect(button.type).toBe('button');
    expect(button.textContent?.trim()).toBe('Open in StackBlitz');
    expect(button.disabled).toBe(false);
  });

  it('posts the generated project when activated', async () => {
    // Pushed rather than aliased to a local: `@typescript-eslint/no-this-alias`.
    const submittedForms: HTMLFormElement[] = [];
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(function (this: HTMLFormElement) {
        submittedForms.push(this);
      });

    try {
      const fixture = await createFixture(PORTABLE);
      (trigger(fixture) as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(submit).toHaveBeenCalledOnce();
      expect(submittedForms).toHaveLength(1);

      const fields = Object.fromEntries(
        [...submittedForms[0].querySelectorAll('input')].map((input) => [
          input.name,
          input.value,
        ]),
      );

      expect(fields['project[title]']).toBe('Malva UI — Button');
      expect(fields['project[files][src/example/index.ts]']).toBe(
        PORTABLE[0].content,
      );
      // The real, generated version table — not the specs' fixture.
      expect(
        JSON.parse(fields['project[files][package.json]']) as {
          dependencies: Record<string, string>;
        },
      ).toHaveProperty('dependencies.@malva-ui/core');
    } finally {
      submit.mockRestore();
    }
  });

  it('has no axe violations', async () => {
    const fixture = await createFixture(PORTABLE);

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});

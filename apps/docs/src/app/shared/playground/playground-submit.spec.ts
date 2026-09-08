import { vi } from 'vitest';
import {
  STACKBLITZ_RUN_URL,
  submitPlaygroundProject,
} from './playground-submit';
import type { PlaygroundProject } from './playground-project';

const PROJECT: PlaygroundProject = {
  title: 'Malva UI — Button',
  description: 'Basic button example.',
  template: 'node',
  files: {
    'package.json': '{ "name": "malva-ui-playground" }\n',
    'src/main.ts': "import Example from './example/index';\n",
    'src/example/index.ts': 'export default class X {}\n',
  },
  openFile: 'src/example/index.ts',
};

describe('submitPlaygroundProject', () => {
  const submittedForms: HTMLFormElement[] = [];
  let submit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    submittedForms.length = 0;
    // jsdom does not implement form submission, so the form is captured here
    // instead. `this` inside the mock is the form the code under test built —
    // pushed straight into the array rather than aliased to a local, which
    // `@typescript-eslint/no-this-alias` forbids.
    submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(function (this: HTMLFormElement) {
        submittedForms.push(this);
      });
  });

  afterEach(() => submit.mockRestore());

  /** The single form the code under test submitted. */
  const submittedForm = (): HTMLFormElement => {
    if (submittedForms.length !== 1) {
      throw new Error(
        `expected 1 submitted form, got ${submittedForms.length}`,
      );
    }
    return submittedForms[0];
  };

  /** Field name → value, read off the captured form. */
  const fields = (): Record<string, string> =>
    Object.fromEntries(
      [...submittedForm().querySelectorAll('input')].map((input) => [
        input.name,
        input.value,
      ]),
    );

  it('posts to the StackBlitz run endpoint, opening the example source', () => {
    submitPlaygroundProject(PROJECT, document);
    const form = submittedForm();

    expect(form.method).toBe('post');
    expect(form.action).toBe(
      `${STACKBLITZ_RUN_URL}?file=src%2Fexample%2Findex.ts`,
    );
    expect(form.target).toBe('_blank');
  });

  it('opens the new context with no opener and no referrer', () => {
    submitPlaygroundProject(PROJECT, document);

    // Read off the IDL property rather than `getAttribute('rel')`: jsdom 22
    // does not reflect `HTMLFormElement.rel` to the content attribute, while a
    // browser does. What is under test is that the code states it at all.
    expect(submittedForm().rel).toBe('noopener noreferrer');
  });

  it('carries every project file as its own field, keyed by path', () => {
    submitPlaygroundProject(PROJECT, document);

    expect(fields()['project[files][src/example/index.ts]']).toBe(
      'export default class X {}\n',
    );
    expect(fields()['project[files][package.json]']).toBe(
      '{ "name": "malva-ui-playground" }\n',
    );
    expect(fields()['project[files][src/main.ts]']).toBe(
      "import Example from './example/index';\n",
    );
  });

  it('carries the project metadata', () => {
    submitPlaygroundProject(PROJECT, document);

    expect(fields()['project[title]']).toBe('Malva UI — Button');
    expect(fields()['project[description]']).toBe('Basic button example.');
    expect(fields()['project[template]']).toBe('node');
  });

  it('leaves no form behind in the document', () => {
    submitPlaygroundProject(PROJECT, document);

    expect(submit).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('form')).toHaveLength(0);
  });

  it('submits into the document it was given, not the ambient one', () => {
    // The same reason library code injects DOCUMENT: under server rendering the
    // ambient global is a different object no teardown reaches.
    const other = document.implementation.createHTMLDocument();

    submitPlaygroundProject(PROJECT, other);

    expect(submittedForm().ownerDocument).toBe(other);
    expect(document.querySelectorAll('form')).toHaveLength(0);
  });
});

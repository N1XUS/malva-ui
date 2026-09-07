/**
 * Hands a generated project to StackBlitz.
 *
 * StackBlitz boots a project from files by accepting a normal HTML form POST on
 * `/run`, with one `project[files][<path>]` field per file. That is exactly what
 * `@stackblitz/sdk`'s `openProject` builds, so this is the same request without
 * the dependency — and it keeps the payload builder's output, rather than a
 * mocked SDK call, as the thing the specs assert.
 *
 * Isolated in its own module so swapping in `@stackblitz/sdk` later is a
 * one-file change: nothing else in the docs app knows how the hand-off happens.
 */
import type { PlaygroundProject } from './playground-project';

/** StackBlitz's "boot a project from POSTed files" endpoint. */
export const STACKBLITZ_RUN_URL = 'https://stackblitz.com/run';

/**
 * Opens `project` in a new StackBlitz tab.
 *
 * Must be called from a user gesture: the form targets `_blank`, and a popup
 * blocker will swallow a submission that is not one.
 *
 * @param project The payload from `createPlaygroundProject`.
 * @param doc The document to build the form in — injected rather than the
 *   ambient global, so a server-side render cannot reach a different `document`
 *   that no teardown owns.
 */
export function submitPlaygroundProject(
  project: PlaygroundProject,
  doc: Document,
): void {
  const form = doc.createElement('form');
  form.method = 'post';
  // A cross-origin POST to a third party. There is no Content-Security-Policy on
  // the docs app today; adding one means adding `form-action
  // https://stackblitz.com` with it, or this submission is silently blocked.
  form.action = `${STACKBLITZ_RUN_URL}?file=${encodeURIComponent(
    project.openFile,
  )}`;
  form.target = '_blank';
  // Stated, not relied on. HTML's "get an element's noopener" is defined for
  // `form` as well as `a`, so a spec-compliant browser already severs
  // `window.opener` for a `_blank` form with no `opener` in its rel — this makes
  // that the code's intent rather than the default's, and drops the referrer
  // while it is here.
  form.rel = 'noopener noreferrer';
  form.style.display = 'none';

  const append = (name: string, value: string): void => {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  append('project[title]', project.title);
  append('project[description]', project.description);
  append('project[template]', project.template);
  for (const [path, contents] of Object.entries(project.files)) {
    append(`project[files][${path}]`, contents);
  }

  doc.body.appendChild(form);
  try {
    form.submit();
  } finally {
    // `finally`, not a trailing statement: a blocked or throwing submit must
    // not leave a hidden form (and a copy of every example source) in the page.
    form.remove();
  }
}

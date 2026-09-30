import type { Type } from '@angular/core';
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { Editor } from '@tiptap/core';
import type { MlvEditorToolbarContext } from '../editor-toolbar-context';
import { mlvEditorDefaultExtensions } from '../extensions/editor-extensions';
import { MlvEditorToc } from '../toc/editor-toc';
import { MlvEditor } from './editor';

/** Server-renders `host` as the whole application and returns the markup. */
function renderOnServer(
  host: Type<unknown>,
  selector: string,
): Promise<string> {
  return renderApplication(
    (context) =>
      bootstrapApplication(
        host,
        {
          providers: [provideMlvI18nTesting()],
        },
        context,
      ),
    {
      document: `<${selector}></${selector}>`,
      url: '/',
    },
  );
}

describe('MlvEditor SSR safety', () => {
  it('server-renders the shell without constructing browser editor state', async () => {
    @Component({
      selector: 'mlv-editor-ssr-host',
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" />',
    })
    class SsrHost {}

    const html = await renderOnServer(SsrHost, 'mlv-editor-ssr-host');

    expect(html).toContain('<mlv-editor');
    expect(html).toContain('mlv-form-control-wrapper');
    expect(html).not.toContain('ProseMirror');
  });

  it('server-renders a floating toolbar as nothing: the bubble is browser-only', async () => {
    @Component({
      selector: 'mlv-editor-ssr-floating-host',
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" toolbarAppearance="floating" />',
    })
    class SsrFloatingHost {}

    const html = await renderOnServer(
      SsrFloatingHost,
      'mlv-editor-ssr-floating-host',
    );

    expect(html).toContain('mlv-editor--toolbar-floating');
    // The toolbar is stamped only into the bubble's overlay pane, which is
    // created after the first browser render, so the server emits no band,
    // no pane and no contenteditable to carry `aria-keyshortcuts`.
    expect(html).not.toContain('mlv-editor__toolbar-band');
    expect(html).not.toContain('mlv-editor-bubble');
    expect(html).not.toContain('aria-keyshortcuts');
    expect(html).not.toContain('ProseMirror');
  });

  it('server-renders a clean editor with no bubble, gutter "+" or open command menu (#516)', async () => {
    @Component({
      selector: 'mlv-editor-ssr-clean-host',
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" toolbarAppearance="clean" />',
    })
    class SsrCleanHost {}

    const html = await renderOnServer(
      SsrCleanHost,
      'mlv-editor-ssr-clean-host',
    );

    expect(html).toContain('mlv-editor--toolbar-clean');
    // The menu host renders (it carries the gutter stylesheet), but its
    // panel, the "+" and the target preview are browser-only.
    expect(html).toContain('mlv-editor-insert-menu');
    expect(html).not.toContain('mlv-menu__panel');
    expect(html).not.toContain('mlv-editor__block-add');
    expect(html).not.toContain('mlv-editor__block-target');
    expect(html).not.toContain('class="mlv-editor-bubble');
    expect(html).not.toContain('aria-keyshortcuts');
    expect(html).not.toContain('ProseMirror');
  });

  it('server-renders a readonly docked bar as nothing (#498)', async () => {
    @Component({
      selector: 'mlv-editor-ssr-readonly-host',
      imports: [MlvEditor],
      template: `
        <mlv-editor label="Editable" toolbarSticky />
        <mlv-editor label="Readonly" readonly toolbarSticky />
      `,
    })
    class SsrReadonlyHost {}

    const html = await renderOnServer(
      SsrReadonlyHost,
      'mlv-editor-ssr-readonly-host',
    );
    const [editable, readonly] = html.split('<mlv-editor ').slice(1);

    // The editable twin proves the server does stamp a bar.
    expect(editable).toContain('mlv-editor__toolbar-band');
    expect(editable).toContain('mlv-editor--toolbar-sticky');
    expect(readonly).toBeDefined();
    expect(readonly).not.toContain('mlv-editor__toolbar-band');
    expect(readonly).not.toContain('role="toolbar"');
    expect(readonly).not.toContain('mlv-editor--toolbar-sticky');
  });

  it('server-renders block IDs and heading anchors as the shell, with no copy-link button', async () => {
    @Component({
      selector: 'mlv-editor-ssr-anchors-host',
      imports: [MlvEditor],
      template: `
        <mlv-editor
          label="Body"
          blockIds
          headingAnchors
          readonly
          value="<h2>Getting started</h2><p>Body</p>"
        />
      `,
    })
    class SsrAnchorsHost {}

    const html = await renderOnServer(
      SsrAnchorsHost,
      'mlv-editor-ssr-anchors-host',
    );

    // Both extensions live inside the browser-only Tiptap instance; the
    // server emits the shell and never builds a copy-link button.
    expect(html).toContain('<mlv-editor');
    expect(html).not.toContain('mlv-editor__heading-link');
    expect(html).not.toContain('ProseMirror');
  });

  it('server-renders TOC items with no href: links are built after the first browser render (#516, D-B10)', async () => {
    // A headless Tiptap instance stands in for a context that has an editor
    // on the server; `mlv-editor` itself builds none there (next spec).
    @Component({
      selector: 'mlv-editor-ssr-toc-host',
      imports: [MlvEditorToc],
      template: '<nav mlvEditorToc [context]="context"></nav>',
    })
    class SsrTocHost {
      readonly context = {
        editor: signal(
          new Editor({
            element: null,
            extensions: mlvEditorDefaultExtensions({ headingAnchors: true }),
            content: {
              type: 'doc',
              content: [
                {
                  type: 'heading',
                  attrs: { level: 1, anchor: 'intro' },
                  content: [{ type: 'text', text: 'Intro' }],
                },
                {
                  type: 'heading',
                  attrs: { level: 2, anchor: 'setup' },
                  content: [{ type: 'text', text: 'Setup' }],
                },
              ],
            },
          }),
        ),
        disabled: signal(false),
        readonly: signal(false),
      } as unknown as MlvEditorToolbarContext;
    }

    const html = await renderOnServer(SsrTocHost, 'mlv-editor-ssr-toc-host');

    expect(html).toContain('aria-label="Table of contents"');
    expect(html).toContain('mlv-editor-toc__link');
    expect(html).toContain('>Intro</a>');
    expect(html).toContain('>Setup</a>');
    expect(html).not.toContain('href=');
  });

  it('server-renders an mlv-editor TOC as a named landmark with no list and no empty text (#516)', async () => {
    @Component({
      selector: 'mlv-editor-ssr-editor-toc-host',
      imports: [MlvEditor, MlvEditorToc],
      template: `
        <mlv-editor #doc label="Body" headingAnchors value="<h2>Setup</h2>" />
        <nav mlvEditorToc [context]="doc"></nav>
      `,
    })
    class SsrEditorTocHost {}

    const html = await renderOnServer(
      SsrEditorTocHost,
      'mlv-editor-ssr-editor-toc-host',
    );

    expect(html).toContain('aria-label="Table of contents"');
    expect(html).not.toContain('mlv-editor-toc__list');
    expect(html).not.toContain('mlv-editor-toc__empty');
  });
});

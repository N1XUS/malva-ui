import type { Type } from '@angular/core';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
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
});

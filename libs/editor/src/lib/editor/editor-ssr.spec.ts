import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvEditor } from './editor';

describe('MlvEditor SSR safety', () => {
  it('server-renders the shell without constructing browser editor state', async () => {
    @Component({
      selector: 'mlv-editor-ssr-host',
      imports: [MlvEditor],
      template: '<mlv-editor label="Body" />',
    })
    class SsrHost {}

    const html = await renderApplication(
      (context) =>
        bootstrapApplication(
          SsrHost,
          {
            providers: [provideMlvI18nTesting()],
          },
          context,
        ),
      {
        document: '<mlv-editor-ssr-host></mlv-editor-ssr-host>',
        url: '/',
      },
    );

    expect(html).toContain('<mlv-editor');
    expect(html).toContain('mlv-form-control-wrapper');
    expect(html).not.toContain('ProseMirror');
  });
});

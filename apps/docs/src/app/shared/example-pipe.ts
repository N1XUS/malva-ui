import type { PipeTransform } from '@angular/core';
import { inject, Pipe } from '@angular/core';
import { DocPageComponent } from './doc-page';
import { kebabCase } from 'lodash-es';

type RawLoaderContent = Promise<{ readonly default: unknown }> | string;

const EMPTY = { default: '' };

@Pipe({
  name: 'docsExample',
})
export class ExamplePipe implements PipeTransform {
  private readonly page = inject(DocPageComponent);
  transform(
    index: number,
    formats:
      | 'html,scss'
      | 'html,ts,scss'
      | 'html,ts'
      | 'html'
      | 'ts' = 'html,ts,scss',
    additionalFiles?: Record<string, RawLoaderContent>,
  ) {
    const type = this.page.type();
    const directory = `${type ? type + '/' : ''}${kebabCase(this.page.header())}/examples/${index}`;
    const ts = import(`../pages/${directory}/index.ts`, {
      with: { loader: 'text' },
    }).catch(() => EMPTY);

    return Object.fromEntries(
      formats
        .split(',')
        .map((format) => [
          format === 'ts' ? 'TypeScript' : format.toUpperCase(),
          format === 'ts' ? ts : load(`${directory}/index.${format}`),
        ])
        .concat(additionalFiles ? Object.entries(additionalFiles) : [])
        // TODO(v6): remove `.map(...)` after update Angular to >= 20.0.0
        .map(([name, content]) => [
          name,
          content && typeof content !== 'string'
            ? // During server side rendering it ignores import attributes for `.ts` files and loads its class instead of file content
              content.then((x) => (typeof x.default === 'string' ? x : EMPTY))
            : content,
        ]),
    );
  }
}

async function load(path: string): Promise<{ default: string }> {
  try {
    return await import(`../pages/${path}`, { with: { loader: 'text' } });
  } catch {
    return EMPTY;
  }
}

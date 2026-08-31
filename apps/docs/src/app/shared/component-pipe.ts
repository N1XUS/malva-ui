import type { PipeTransform, Type } from '@angular/core';
import { inject, Pipe } from '@angular/core';
import { DocPageComponent } from './doc-page';
import { kebabCase } from 'lodash-es';

@Pipe({
  name: 'docsComponent',
})
export class ComponentPipe implements PipeTransform {
  private readonly page = inject(DocPageComponent);

  public async transform(index: number): Promise<Type<unknown>> {
    const type = this.page.type();
    return import(
      `../pages/${type ? type + '/' : ''}${kebabCase(this.page.header())}/examples/${index}/index.ts`
    ).then((module) => module.default);
  }
}

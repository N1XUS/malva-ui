import type { PipeTransform } from '@angular/core';
import { inject, Pipe } from '@angular/core';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';
import { ShikiHighlightService } from './shiki-highlight.service';

@Pipe({
  name: 'highlight',
})
export class HighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly highlighter = inject(ShikiHighlightService);

  transform(
    code: string | null | undefined,
    lang = 'typescript',
    theme: 'light' | 'dark' = 'light',
  ): Promise<SafeHtml> {
    if (!code) return Promise.resolve('');

    return this.highlighter
      .highlight(code, lang, theme)
      .then((html) => this.sanitizer.bypassSecurityTrustHtml(html));
  }
}

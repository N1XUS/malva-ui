import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pageRoot = dirname(fileURLToPath(import.meta.url));
const pageTemplate = readFileSync(resolve(pageRoot, 'index.html'), 'utf8');
const pageClass = readFileSync(resolve(pageRoot, 'index.ts'), 'utf8');
const docsTailwindEntry = readFileSync(
  resolve(pageRoot, '../../../tailwind.css'),
  'utf8',
);

describe('Tailwind documentation guide', () => {
  it('documents the installer, managed boundaries, and token namespaces', () => {
    expect(pageClass).toContain('ng add @malva-ui/tailwind');
    expect(pageClass).toContain('malva-ui:tailwind:start');
    expect(pageClass).toContain('malva-ui:tailwind:end');
    expect(pageTemplate).toContain('--color-mlv-*');
    expect(pageTemplate).toContain('--spacing-mlv-*');
    expect(pageTemplate).toContain('--radius-mlv-*');
    expect(pageTemplate).toContain('--shadow-mlv-*');
    expect(pageTemplate).toContain('--font-mlv-*');
    expect(pageTemplate).toContain('--mlv-font-family-code');
    expect(pageTemplate).toContain('font-mlv-code');
    expect(pageTemplate).toContain('--font-weight-mlv-*');
    expect(pageTemplate).toContain('--text-mlv-*');
    expect(pageTemplate).toContain('--leading-mlv-*');
  });

  it('shows representative generated utility classes', () => {
    for (const utility of [
      'bg-mlv-surface-raised',
      'text-mlv-content',
      'border-mlv-normal',
      'p-mlv-5',
      'gap-mlv-4',
      'rounded-mlv-card',
      'shadow-mlv-raised',
      'font-mlv-code',
      'font-mlv-display',
      'leading-mlv-body-m',
      'hover:bg-mlv-primary-hover',
      'sm:grid-cols-[minmax(0,1fr)_auto]',
    ]) {
      expect(pageTemplate).toContain(utility);
    }
  });

  it('uses Shiki for block snippets while keeping inline code inline', () => {
    expect(pageClass).toContain('AsyncPipe');
    expect(pageClass).toContain('HighlightPipe');
    expect(pageTemplate).toContain("| highlight: 'bash' : codeTheme() | async");
    expect(pageTemplate).toContain("| highlight: 'json' : codeTheme() | async");
    expect(pageTemplate).toContain("| highlight: 'css' : codeTheme() | async");
    expect(pageTemplate).toContain("| highlight: 'html' : codeTheme() | async");
    expect(pageTemplate).toContain('[innerHTML]="highlighted"');
    expect(pageTemplate).not.toContain('<pre');
    expect(pageTemplate).toContain('<code>&#64;malva-ui/tailwind</code>');
  });

  it('gives the reference tables explicit presentation hooks', () => {
    expect(pageTemplate).toContain(
      'class="tailwind-page__table tailwind-page__table--options"',
    );
    expect(pageTemplate).toContain(
      'class="tailwind-page__table tailwind-page__table--namespaces"',
    );
  });

  it('imports only Tailwind theme and utility layers for the docs app', () => {
    expect(docsTailwindEntry).toContain("@import 'tailwindcss/theme.css';");
    expect(docsTailwindEntry).toContain(
      "@import '@malva-ui/tailwind/theme.css';",
    );
    expect(docsTailwindEntry).toContain("@import 'tailwindcss/utilities.css';");
    expect(docsTailwindEntry).not.toContain("@import 'tailwindcss';");
    expect(docsTailwindEntry).toContain('@source "./app";');
  });
});

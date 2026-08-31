import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  imports: [RouterLink, MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'not-found-page' },
  template: `
    <section class="not-found-page__content" aria-labelledby="not-found-title">
      <p class="not-found-page__eyebrow">404 · Page not found</p>
      <h1 id="not-found-title">This path has wandered off.</h1>
      <p class="not-found-page__description">
        The page may have moved, or the address may be incomplete. Return to the
        library overview or continue with the installation guide.
      </p>
      <nav class="not-found-page__actions" aria-label="Page recovery">
        <a mlvButton variant="primary" routerLink="/">Back to home</a>
        <a mlvButton variant="outlined" routerLink="/getting-started">
          Getting started
        </a>
      </nav>
    </section>
  `,
  styles: `
    :host {
      display: grid;
      min-height: min(42rem, calc(100vh - 10rem));
      place-items: center;
      padding: var(--mlv-spacing-8);
    }
    .not-found-page__content {
      display: grid;
      justify-items: start;
      width: min(100%, 42rem);
      gap: var(--mlv-spacing-4);
      padding: clamp(var(--mlv-spacing-6), 6vw, var(--mlv-spacing-12));
      border: var(--mlv-stroke-width) solid var(--mlv-border-normal);
      border-radius: var(--mlv-radius-2xl);
      background: var(--mlv-background-raised);
      box-shadow: var(--mlv-shadow-2);
    }
    .not-found-page__eyebrow {
      margin: 0;
      color: var(--mlv-text-action);
      font-size: var(--mlv-typography-label-size);
      font-weight: var(--mlv-font-weight-semibold);
      letter-spacing: var(--mlv-letter-spacing-wide);
      text-transform: uppercase;
    }
    .not-found-page__content h1 {
      max-width: 16ch;
      margin: 0;
      color: var(--mlv-text-heading);
      font-size: clamp(var(--mlv-font-size-4xl), 6vw, var(--mlv-font-size-6xl));
      line-height: var(--mlv-line-height-tight);
    }
    .not-found-page__description {
      max-width: 56ch;
      margin: 0;
      color: var(--mlv-text-secondary);
      line-height: 1.7;
    }
    .not-found-page__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mlv-spacing-3);
      margin-top: var(--mlv-spacing-2);
    }
  `,
})
export class NotFoundPageComponent {}

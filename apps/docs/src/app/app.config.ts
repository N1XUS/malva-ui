import type { ApplicationConfig } from '@angular/core';
import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
// The @malva-ui/i18n main entry is imported statically by design: only the language
// packs (@malva-ui/i18n/<lang>) are lazy-loaded, via the dynamic import below.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { provideMlvI18n } from '@malva-ui/i18n';
import { provideMlvDensity } from '@malva-ui/cdk/density';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Every Malva UI component is OnPush and signal-based, so the docs app —
    // which exercises all of them — runs as the workspace's zoneless proof.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideMlvDensity('comfortable'),
    provideMlvI18n(() => import('@malva-ui/i18n/en')),
  ],
};

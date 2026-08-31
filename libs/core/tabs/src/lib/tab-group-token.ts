import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';

export type MlvTabOrientation = 'horizontal' | 'vertical';

export interface MlvTabGroupAccessor {
  readonly activeTab: Signal<string>;
  readonly orientation: Signal<MlvTabOrientation>;
  selectTab(value: string): void;
  isActive(value: string): boolean;
}

export const TAB_GROUP = new InjectionToken<MlvTabGroupAccessor>('TAB_GROUP');

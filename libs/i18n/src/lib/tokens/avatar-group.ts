import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvAvatarGroupI18n {
  noMembers: string;
  memberCount: string;
  visibleMembers: string;
  moreMembers: string;
  allMembers: string;
}

export const MLV_AVATAR_GROUP_I18N = new InjectionToken<
  Signal<MlvAvatarGroupI18n>
>('MLV_AVATAR_GROUP_I18N');

export const MLV_AVATAR_GROUP_I18N_CONTEXT: Record<
  keyof MlvAvatarGroupI18n,
  MlvTranslationContext
> = {
  noMembers: { component: 'mlv-avatar-group', usage: 'aria-label' },
  memberCount: {
    component: 'mlv-avatar-group',
    usage: 'aria-label',
    icuParams: ['total'],
  },
  visibleMembers: {
    component: 'mlv-avatar-group',
    usage: 'aria-label',
    icuParams: ['total', 'visible'],
  },
  moreMembers: {
    component: 'mlv-avatar-group',
    usage: 'aria-label',
    icuParams: ['count'],
  },
  allMembers: { component: 'mlv-avatar-group', usage: 'aria-label' },
};

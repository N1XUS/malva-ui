// libs/cdk/testing-e2e/src/kit/applicability.ts

export type MlvCategory =
  | 'keyboard'
  | 'innerKeyboard'
  | 'states'
  | 'mouse'
  | 'dataFlow'
  | 'intents';

export type MlvCategoryApplicability = Record<MlvCategory, boolean>;

export interface MlvExpectedStateEntry {
  readonly example: number;
  readonly selector: string;
  readonly classes: readonly string[];
  readonly attributes?: Readonly<Record<string, string>>;
}

export interface MlvExpectedMouseEntry {
  readonly example: number;
  readonly trigger: string;
  readonly expectEvent?: string;
  readonly expectValue?: unknown;
  readonly whenDisabled?: boolean;
}

export interface MlvComponentManifest {
  readonly route: string;
  readonly label: string;
  readonly applies: MlvCategoryApplicability;
  readonly examples?: Partial<Record<MlvCategory, readonly number[]>>;
  readonly skipReasons?: Partial<Record<MlvCategory, string>>;
  readonly expectedStates?: readonly MlvExpectedStateEntry[];
  readonly expectedMouse?: readonly MlvExpectedMouseEntry[];
}

export const NO_CATEGORIES: MlvCategoryApplicability = {
  keyboard: false,
  innerKeyboard: false,
  states: false,
  mouse: false,
  dataFlow: false,
  intents: false,
};

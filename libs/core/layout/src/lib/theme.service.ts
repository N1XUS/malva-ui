/**
 * @deprecated since 0.2.0 — removed in 1.0. Import from
 * `@malva-ui/cdk/theme` instead. The theme service is a headless contract with no component, so it
 * lives in the CDK family alongside the date adapter; nothing in it ever
 * referenced `mlv-layout`, and applications that render no layout still need
 * it. Every identity is unchanged, so this is an import-path edit.
 */
export * from '@malva-ui/cdk/theme';

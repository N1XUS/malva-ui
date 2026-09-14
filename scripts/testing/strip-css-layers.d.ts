import type { Plugin } from 'postcss';

export declare function stripCssLayers(): Plugin;
export declare function dropContainerQueries(): Plugin;
export declare function stripCssLayersFromText(css: string): string;
export declare function flattenCssForJsdom(css: string): string;

import {
  compositeColors,
  parseComputedColor,
  type MlvRgbaColor,
} from './chrome-color.util';

/** Stable opaque base matching the default dark chrome background. */
const DEFAULT_CHROME_BACKGROUND: MlvRgbaColor = {
  red: 23,
  green: 23,
  blue: 23,
  alpha: 1,
};

/**
 * Resolves a CSS color in an element's actual inheritance context.
 * Two inherited sentinel colors distinguish a valid result from an unresolved
 * value that silently falls back to `inherit`.
 *
 * @param host Element whose cascade resolves custom properties.
 * @param value Candidate CSS color.
 * @returns Browser-resolved sRGB channels, or `null` when unresolved.
 */
export function resolveCssColor(
  host: HTMLElement,
  value: string | null,
): MlvRgbaColor | null {
  const rawCandidate = value?.trim();
  if (
    !rawCandidate ||
    /^(currentcolor|inherit|initial|unset|revert|revert-layer)$/i.test(
      rawCandidate,
    )
  ) {
    return null;
  }

  const view = host.ownerDocument.defaultView;
  if (!view) {
    return null;
  }

  const candidate = _resolveCustomProperties(host, rawCandidate);
  if (!candidate) {
    return null;
  }

  const first = _createColorProbe(host, 'rgb(1, 2, 3)', candidate);
  const second = _createColorProbe(host, 'rgb(4, 5, 6)', candidate);
  host.append(first.wrapper, second.wrapper);

  const firstColor = parseComputedColor(
    view.getComputedStyle(first.probe).color,
  );
  const secondColor = parseComputedColor(
    view.getComputedStyle(second.probe).color,
  );

  first.wrapper.remove();
  second.wrapper.remove();

  return firstColor && secondColor && _colorsEqual(firstColor, secondColor)
    ? firstColor
    : null;
}

/**
 * Resolves the visible backdrop beneath a translucent shell color.
 * Ancestor backgrounds are composited from nearest to farthest before the
 * stable shell default is used as the final opaque base.
 *
 * @param host Shell whose ancestor cascade supplies the backdrop.
 * @returns Opaque effective backdrop.
 */
export function resolveBackdropBackground(host: HTMLElement): MlvRgbaColor {
  const view = host.ownerDocument.defaultView;
  let backdrop: MlvRgbaColor = {
    red: 0,
    green: 0,
    blue: 0,
    alpha: 0,
  };
  let current = host.parentElement;

  while (view && current) {
    const ancestorBackground = parseComputedColor(
      view.getComputedStyle(current).backgroundColor,
    );
    if (ancestorBackground) {
      backdrop = compositeColors(backdrop, ancestorBackground);
      if (backdrop.alpha >= 1) {
        return backdrop;
      }
    }
    current = current.parentElement;
  }

  const fallback =
    resolveCssColor(host, 'var(--mlv-palette-neutral-900)') ??
    DEFAULT_CHROME_BACKGROUND;
  return compositeColors(backdrop, fallback);
}

/**
 * Resolves `var(...)` references from the host's computed cascade.
 * The browser remains responsible for the custom-property cascade; this
 * substitution handles CSSOM implementations that do not expand variables
 * when serializing a computed `color` value.
 *
 * @param host Element whose cascade owns the custom properties.
 * @param value CSS value that may contain custom-property references.
 * @param seen Custom properties currently being expanded, for cycle safety.
 * @param depth Expansion depth guard.
 * @returns Value with variables substituted, or `null` when unresolved.
 */
function _resolveCustomProperties(
  host: HTMLElement,
  value: string,
  seen = new Set<string>(),
  depth = 0,
): string | null {
  if (depth > 16) {
    return null;
  }

  const range = _findFirstVarFunction(value);
  if (!range) {
    return value;
  }

  const content = value.slice(range.contentStart, range.contentEnd);
  const [namePart, fallback] = _splitCustomPropertyArguments(content);
  const name = namePart.trim();
  if (!/^--[a-z0-9_-]+$/i.test(name)) {
    return null;
  }

  const view = host.ownerDocument.defaultView;
  let replacement =
    view?.getComputedStyle(host).getPropertyValue(name).trim() ?? '';

  if (!replacement || seen.has(name)) {
    replacement = fallback?.trim() ?? '';
  }
  if (!replacement) {
    return null;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(name);
  const resolvedReplacement = _resolveCustomProperties(
    host,
    replacement,
    nextSeen,
    depth + 1,
  );
  if (!resolvedReplacement) {
    if (!fallback) {
      return null;
    }
    const resolvedFallback = _resolveCustomProperties(
      host,
      fallback.trim(),
      seen,
      depth + 1,
    );
    if (!resolvedFallback) {
      return null;
    }
    return _resolveCustomProperties(
      host,
      `${value.slice(0, range.start)}${resolvedFallback}${value.slice(
        range.end,
      )}`,
      seen,
      depth + 1,
    );
  }

  return _resolveCustomProperties(
    host,
    `${value.slice(0, range.start)}${resolvedReplacement}${value.slice(
      range.end,
    )}`,
    seen,
    depth + 1,
  );
}

/**
 * Locates the first balanced CSS `var(...)` function.
 *
 * @param value CSS value to scan.
 * @returns Function and content offsets, or `null` when absent/malformed.
 */
function _findFirstVarFunction(value: string): {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
} | null {
  const start = value.toLowerCase().indexOf('var(');
  if (start < 0) {
    return null;
  }

  let parentheses = 1;
  for (let index = start + 4; index < value.length; index++) {
    if (value[index] === '(') {
      parentheses++;
    } else if (value[index] === ')') {
      parentheses--;
      if (parentheses === 0) {
        return {
          start,
          end: index + 1,
          contentStart: start + 4,
          contentEnd: index,
        };
      }
    }
  }

  return null;
}

/**
 * Splits a custom-property name from its optional top-level fallback.
 *
 * @param content Contents of a `var(...)` function.
 * @returns Name and optional fallback.
 */
function _splitCustomPropertyArguments(
  content: string,
): [string, string | undefined] {
  let parentheses = 0;
  for (let index = 0; index < content.length; index++) {
    if (content[index] === '(') {
      parentheses++;
    } else if (content[index] === ')') {
      parentheses--;
    } else if (content[index] === ',' && parentheses === 0) {
      return [content.slice(0, index), content.slice(index + 1)];
    }
  }
  return [content, undefined];
}

/**
 * Creates a hidden color probe and its sentinel-colored wrapper.
 *
 * @param host Element whose document creates the probes.
 * @param sentinel Inherited color used to detect unresolved candidates.
 * @param candidate Candidate assigned to the probe.
 * @returns Wrapper and probe elements.
 */
function _createColorProbe(
  host: HTMLElement,
  sentinel: string,
  candidate: string,
): { wrapper: HTMLSpanElement; probe: HTMLSpanElement } {
  const document = host.ownerDocument;
  const wrapper = document.createElement('span');
  const probe = document.createElement('span');

  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.cssText =
    `position:fixed;inline-size:0;block-size:0;overflow:hidden;` +
    `visibility:hidden;pointer-events:none;color:${sentinel}`;
  probe.style.color = candidate;
  wrapper.append(probe);

  return { wrapper, probe };
}

/**
 * Compares two normalized colors exactly as emitted by CSSOM.
 *
 * @param first First resolved color.
 * @param second Second resolved color.
 * @returns Whether all four channels match.
 */
function _colorsEqual(first: MlvRgbaColor, second: MlvRgbaColor): boolean {
  return (
    first.red === second.red &&
    first.green === second.green &&
    first.blue === second.blue &&
    first.alpha === second.alpha
  );
}

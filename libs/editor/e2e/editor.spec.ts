import { Buffer } from 'node:buffer';
import axe from 'axe-core';
import {
  defineComponentSpec,
  expect,
  test,
  type MlvE2ePage,
} from '@malva-ui/cdk/testing-e2e';
import { editorAiManifest, editorManifest } from './editor.manifest';

async function gotoEditor(mlv: MlvE2ePage, width = 1600): Promise<void> {
  await mlv.page.setViewportSize({ width, height: 1000 });
  await mlv.goto(editorManifest.route);
}

async function gotoEditorAi(mlv: MlvE2ePage, width = 1600): Promise<void> {
  await mlv.page.setViewportSize({ width, height: 1000 });
  await mlv.goto(editorAiManifest.route);
}

/**
 * Runs the review-mode custom-prompt transform of the AI review example and
 * waits until the mock provider's proofread diff (one replace, one delete,
 * one insert) is pending in the review bar.
 */
async function startAiReview(mlv: MlvE2ePage) {
  const scope = mlv.example(2);
  const editor = scope.locator('mlv-editor');
  const textbox = editor.getByRole('textbox', {
    name: 'Editor with reviewable AI suggestions',
  });
  const bar = editor.getByRole('group', { name: 'AI suggestion review' });

  await textbox.locator('p').first().click({ clickCount: 3 });
  await editor.getByRole('button', { name: 'AI assist' }).click();
  const menu = mlv.overlayRoot().getByRole('menu', { name: 'AI assist' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Custom prompt' }).click();

  const dialog = mlv.page.getByRole('dialog', { name: 'Custom prompt' });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('textbox', { name: 'Custom prompt' })
    .fill('Proofread the selected paragraph');
  await dialog.getByText('Review changes').click();
  await expect(
    dialog.getByRole('radio', { name: 'Review changes' }),
  ).toBeChecked();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(bar).toContainText('3 suggestions', { timeout: 10_000 });
  return { scope, editor, textbox, bar };
}

defineComponentSpec(editorManifest, () => {
  test('keeps the desktop icon toolbar on one fading row with fixed overflow', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const editor = mlv.example(1).locator('mlv-editor');
    const toolbar = editor.getByRole('toolbar', { name: 'Editor toolbar' });
    const fade = toolbar.locator(
      ':scope > .mlv-editor__toolbar-scroll.mlv-fade',
    );
    const row = fade.locator(':scope > .mlv-toolbar');
    const fixedOverflow = toolbar.locator(
      ':scope > mlv-editor-toolbar-overflow',
    );

    await expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(fade).toHaveCount(1);
    await expect(row).toHaveCount(1);
    await expect(fade.locator('mlv-editor-toolbar-overflow')).toHaveCount(0);
    await expect(fixedOverflow).toHaveCount(1);
    await expect(fixedOverflow).toBeHidden();
    expect(
      await row.evaluate((element) => getComputedStyle(element).flexWrap),
    ).toBe('nowrap');

    const buttons = row.locator('button[aria-label]:visible');
    expect(await buttons.count()).toBeGreaterThan(8);
    const presentation = await buttons.evaluateAll((elements) =>
      elements.map((element) => ({
        center:
          element.getBoundingClientRect().top +
          element.getBoundingClientRect().height / 2,
        hasIcon: element.querySelector('svg') !== null,
        name: element.getAttribute('aria-label') ?? '',
        styleTrigger: element.classList.contains(
          'mlv-editor-style-menu__trigger',
        ),
        text: element.textContent?.trim() ?? '',
      })),
    );
    expect(
      Math.max(...presentation.map(({ center }) => center)) -
        Math.min(...presentation.map(({ center }) => center)),
    ).toBeLessThan(2);
    for (const button of presentation) {
      // Font family and size triggers show their value as text, and their
      // name contains it (WCAG 2.5.3, #514).
      if (button.styleTrigger) {
        expect(button.text).not.toBe('');
        expect(button.name).toContain(button.text);
        continue;
      }
      const isZoomValue = /^\d+%$/.test(button.text);
      expect(button.text === '' || isZoomValue).toBe(true);
      if (!isZoomValue) expect(button.hasIcon).toBe(true);
    }
  });

  test('exposes a named narrow toolbar with roving focus and fixed More menu', async ({
    mlv,
  }) => {
    // Narrow mode is decided by the editor surface's width (< 640px, #416).
    // At 720px the docs stage leaves example 1 a 658px surface, so the width
    // has to sit clearly below the cut-over rather than on its edge.
    await gotoEditor(mlv, 680);
    const toolbar = mlv
      .example(1)
      .locator('mlv-editor')
      .getByRole('toolbar', { name: 'Editor toolbar' });
    const more = toolbar.getByRole('button', { name: 'More formatting' });

    await expect(toolbar).toHaveClass(/mlv-editor-toolbar--narrow/);
    await expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(more).toBeVisible();
    await expect(toolbar.locator('mlv-editor-inline-marks')).toBeHidden();
    await expect(toolbar.locator('mlv-editor-alignment')).toBeHidden();
    await expect(toolbar.locator('mlv-editor-block-insert')).toBeHidden();
    await expect(toolbar.locator('button[tabindex="0"]:visible')).toHaveCount(
      1,
    );

    const first = toolbar.locator('button:visible:not([disabled])').first();
    await first.focus();
    await first.press('End');
    await expect(more).toBeFocused();
    await more.press('Enter');

    const menu = mlv
      .overlayRoot()
      .getByRole('menu', { name: 'More formatting' });
    await expect(menu).toBeVisible();
    expect(await menu.getByRole('menuitem').count()).toBeGreaterThan(3);
    await mlv.page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
  });

  test('opens distinct accessible text and highlight color pickers', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const toolbar = mlv
      .example(1)
      .locator('mlv-editor')
      .getByRole('toolbar', { name: 'Editor toolbar' });
    const textColor = toolbar.getByRole('button', { name: 'Text color' });
    const highlight = toolbar.getByRole('button', {
      name: 'Highlight color',
    });

    await expect(textColor.locator('svg')).toHaveCount(1);
    await expect(highlight.locator('svg')).toHaveCount(1);
    await textColor.click();
    // `aria-controls` is bound only while the popup reports itself open
    // (`opened() ? _panelId : null`), which can land after `click()` resolves;
    // `getAttribute()` does not retry.
    await expect(textColor).toHaveAttribute('aria-controls', /\S/);
    const textPanelId = await textColor.getAttribute('aria-controls');
    const textDialog = mlv.page.getByRole('dialog', { name: 'Text color' });
    await expect(textDialog).toBeVisible();
    await mlv.page.keyboard.press('Escape');
    await expect(textDialog).toBeHidden();
    await expect(textColor).toBeFocused();

    await highlight.click();
    await expect(highlight).toHaveAttribute('aria-controls', /\S/);
    const highlightPanelId = await highlight.getAttribute('aria-controls');
    expect(highlightPanelId).not.toBe(textPanelId);
    const highlightDialog = mlv.page.getByRole('dialog', {
      name: 'Highlight color',
    });
    await expect(highlightDialog).toBeVisible();
    await mlv.page.keyboard.press('Escape');
    await expect(highlightDialog).toBeHidden();
    await expect(highlight).toBeFocused();
  });

  test('round-trips direct editor content through the nullable HTML model', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(1);
    const serialized = scope.locator('pre');
    const editor = scope.getByRole('textbox', {
      name: 'Release notes editor',
    });

    await scope.getByRole('button', { name: 'Clear to null' }).click();
    await expect(serialized).toHaveText('null');
    await editor.fill('Browser round trip');
    await expect(serialized).toHaveText('<p>Browser round trip</p>');
  });

  test('round-trips Markdown content and preserves null as the empty model', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(2);
    const serialized = scope.locator('pre');
    const editor = scope.getByRole('textbox', {
      name: 'Markdown draft editor',
    });

    await expect(serialized).toContainText('## Markdown draft');
    await scope.getByRole('button', { name: 'Clear Markdown' }).click();
    await expect(serialized).toHaveText('null');
    await editor.fill('Markdown browser round trip');
    await expect(serialized).toHaveText('Markdown browser round trip');
  });

  test('reflects reactive-form clearing and disabled state in the real editor', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const section = mlv.example(3).locator('section').first();
    const editor = section.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', { name: 'Reactive editor' });
    const textboxDom = editor.locator('[role="textbox"]');
    const value = section.locator('p').filter({ hasText: 'Value:' });

    await expect(textbox).toBeVisible();
    await section.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(value).toContainText('Value: null');
    await section.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(editor).toHaveClass(/mlv-editor--disabled/);
    await expect(textboxDom).toHaveAttribute('aria-disabled', 'true');
    await expect(textboxDom).toHaveAttribute('tabindex', '-1');
    await expect(
      section.getByRole('button', { name: 'Enable', exact: true }),
    ).toBeVisible();
  });

  test('round-trips the template-driven form and exposes its disabled DOM state', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const section = mlv.example(3).locator('section').nth(1);
    const editor = section.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', {
      name: 'Template-driven editor',
    });
    const textboxDom = editor.locator('[role="textbox"]');
    const value = section.locator('p').filter({ hasText: 'Value:' });

    await section.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(value).toContainText('Value: null');
    await textbox.fill('Template browser round trip');
    await expect(value).toContainText(
      'Value: <p>Template browser round trip</p>',
    );
    await section.getByRole('button', { name: 'Disable', exact: true }).click();
    await expect(editor).toHaveAttribute('inert', '');
    await expect(textboxDom).toHaveAttribute('aria-disabled', 'true');
    await expect(textboxDom).toHaveAttribute('tabindex', '-1');
  });

  test('round-trips Signal Forms and reflects required and disabled state', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(4);
    const editor = scope.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', {
      name: 'Signal Forms editor',
    });
    const textboxDom = editor.locator('[role="textbox"]');
    const status = scope.locator('p', { hasText: 'Value:' });

    await expect(status).toContainText('Value: null');
    await expect(status).toContainText('Valid: false');
    await textbox.fill('Signal Forms browser round trip');
    await expect(status).toContainText(
      'Value: <p>Signal Forms browser round trip</p>',
    );
    await expect(status).toContainText('Valid: true');
    await scope.getByRole('button', { name: 'Disable field' }).click();
    await expect(editor).toHaveAttribute('inert', '');
    await expect(textboxDom).toHaveAttribute('aria-disabled', 'true');
    await expect(textboxDom).toHaveAttribute('tabindex', '-1');
  });

  test('keeps toolbar and overlay focus inside the editor composite boundary', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(6);
    const editor = scope.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', {
      name: 'Editor event playground',
    });
    const blurEvents = scope.locator('ol li').filter({ hasText: /^blur$/ });
    const external = scope.getByRole('button', { name: 'Readonly: false' });

    await textbox.focus();
    await expect(
      scope.locator('ol li').filter({ hasText: /^focus$/ }),
    ).toHaveCount(1);
    await editor.getByRole('button', { name: 'Zoom', exact: true }).click();
    const zoomDialog = mlv.page.getByRole('dialog', { name: 'Zoom' });
    await expect(zoomDialog).toBeVisible();
    await expect(blurEvents).toHaveCount(0);
    await mlv.page.keyboard.press('Escape');
    await expect(zoomDialog).toBeHidden();
    await expect(blurEvents).toHaveCount(0);
    await external.focus();
    await expect(blurEvents).toHaveCount(1);
  });

  test('keeps readonly selectable and makes disabled content inert', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(6);
    const editor = scope.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', {
      name: 'Editor event playground',
    });
    const textboxDom = editor.locator('[role="textbox"]');

    await scope.getByRole('button', { name: 'Readonly: false' }).click();
    await expect(editor).toHaveClass(/mlv-editor--readonly/);
    await expect(textbox).toHaveAttribute('aria-readonly', 'true');
    await expect(textbox).toHaveAttribute('tabindex', '0');
    await expect(textbox).not.toHaveAttribute('aria-disabled', 'true');

    await scope.getByRole('button', { name: 'Disabled: false' }).click();
    await expect(editor).toHaveClass(/mlv-editor--disabled/);
    await expect(editor).toHaveAttribute('inert', '');
    await expect(textboxDom).toHaveAttribute('aria-disabled', 'true');
    await expect(textboxDom).toHaveAttribute('tabindex', '-1');
  });

  test('inserts a three-by-three table with a header row into the real document', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(8);
    const editor = scope.locator('mlv-editor');
    const serialized = scope.locator('pre');

    await scope.getByRole('button', { name: 'Insert 3 × 3 table' }).click();
    const table = editor.locator('[role="textbox"] table');
    await expect(table).toBeVisible();
    await expect(table.locator('tr')).toHaveCount(3);
    await expect(table.locator('tr').first().locator('th')).toHaveCount(3);
    await expect(table.locator('td')).toHaveCount(6);
    await expect(serialized).toContainText('<table');
  });

  test('uploads one image through the docs adapter and inserts it into the document', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(5);
    const editor = scope.locator('mlv-editor');

    await editor.getByRole('button', { name: 'Upload image' }).click();
    const dialog = mlv.page.getByRole('dialog', { name: 'Upload image' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'browser-smoke.png',
      mimeType: 'image/png',
      buffer: Buffer.from('deterministic editor upload smoke'),
    });
    await dialog
      .getByRole('textbox', { name: 'Alternative text' })
      .fill('Browser upload smoke');
    await dialog
      .getByRole('button', { name: 'Upload image', exact: true })
      .click();

    await expect(
      scope.locator('ul[aria-live="polite"] li').filter({
        hasText: 'Success: browser-smoke.png',
      }),
    ).toBeVisible({ timeout: 5_000 });
    // The dialog announced completion and closed; the editor-level live
    // region keeps no progress for the finished upload.
    await expect(dialog).toBeHidden();
    await expect(
      editor.locator('.mlv-editor-image-upload-status__live'),
    ).toHaveText('');
    // The typed alt wins over the adapter's `alt: file.name`.
    await expect(
      editor.locator('[role="textbox"] img[alt="Browser upload smoke"]'),
    ).toBeVisible();
  });

  test('changes view zoom without changing serialized editor content', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    const scope = mlv.example(8);
    const editor = scope.locator('mlv-editor');
    const serialized = scope.locator('pre');
    const status = scope.locator('p', { hasText: 'View zoom:' });
    const before = await serialized.textContent();

    await scope.getByRole('button', { name: '125%' }).click();
    await expect(status).toContainText('View zoom: 125%');
    await expect(status).toContainText(
      'Last zoom preserved serialized value: true',
    );
    await expect(serialized).toHaveText(before ?? '');
    await expect
      .poll(() =>
        editor.evaluate((element) =>
          getComputedStyle(element)
            .getPropertyValue('--mlv-editor-zoom')
            .trim(),
        ),
      )
      .toBe('1.25');
  });

  test('has no serious or critical WCAG A/AA violations in the primary editor example', async ({
    mlv,
  }) => {
    await gotoEditor(mlv);
    await mlv.page.addScriptTag({ content: axe.source });

    const violations = await mlv.page.evaluate(async () => {
      const scope = document.querySelector('docs-example-container');
      if (!scope) throw new Error('Expected the primary editor example.');
      const browserAxe = (
        window as typeof window & {
          axe: {
            run: (
              context: Element,
              options: {
                runOnly: { type: 'tag'; values: readonly string[] };
              },
            ) => Promise<{
              violations: Array<{
                id: string;
                impact: string | null;
                nodes: readonly unknown[];
              }>;
            }>;
          };
        }
      ).axe;
      const results = await browserAxe.run(scope, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      });
      return results.violations
        .filter(({ impact }) => impact === 'serious' || impact === 'critical')
        .map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodeCount: nodes.length,
        }));
    });

    expect(violations).toEqual([]);
  });
});

defineComponentSpec(editorAiManifest, () => {
  test('streams a mock AI transform with a working stop affordance', async ({
    mlv,
  }) => {
    await gotoEditorAi(mlv);
    const scope = mlv.example(1);
    const editor = scope.locator('mlv-editor');
    const textbox = editor.getByRole('textbox', {
      name: 'Editor with an AI assistant menu',
    });
    const trigger = editor.getByRole('button', { name: 'AI assist' });
    const stop = editor.getByRole('button', { name: 'Cancel' });

    // Select the first paragraph and run a plain transform from the menu.
    await textbox.locator('p').first().click({ clickCount: 3 });
    await trigger.click();
    const menu = mlv.overlayRoot().getByRole('menu', { name: 'AI assist' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Improve writing' }).click();

    // While the mock provider streams, the sparkles trigger is the stop
    // affordance; afterwards it swaps back and the replacement has landed.
    await expect(stop).toBeVisible();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await expect(textbox).toContainText('reads clearly and confidently');
    await expect(textbox).toContainText('Draft');
    await expect(textbox).not.toContainText(
      'Select this sentence, then open the sparkles menu',
    );

    // Stopping mid-stream restores the checkpoint: the document returns to
    // its pre-transform state and no canned Markdown output remains.
    const before = await textbox.innerText();
    await textbox.locator('p').last().click({ clickCount: 3 });
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Extend' }).click();
    await expect(stop).toBeVisible();
    await stop.click();
    await expect(trigger).toBeVisible();
    await expect(textbox).not.toContainText('one supporting example');
    expect(await textbox.innerText()).toBe(before);
  });

  test('lands a review-mode AI transform as tracked suggestions and accepts them all', async ({
    mlv,
  }) => {
    await gotoEditorAi(mlv);
    const { scope, editor, textbox, bar } = await startAiReview(mlv);
    const inserts = editor.locator(
      '[role="textbox"] .mlv-editor__ai-suggestion-insert',
    );
    const deletes = editor.locator(
      '[role="textbox"] .mlv-editor__ai-suggestion-delete',
    );
    const save = scope.getByRole('button', { name: 'Save draft' });

    // The proofread diff renders as decorations: inserted text highlighted
    // inline, removed text as strikethrough widgets — and the host save is
    // gated on hasPendingSuggestions while the review is open.
    await expect(inserts).toHaveCount(2);
    await expect(deletes).toHaveCount(2);
    await expect(deletes.filter({ hasText: 'Teh' })).toHaveCount(1);
    await expect(deletes.filter({ hasText: 'basically' })).toHaveCount(1);
    await expect(save).toBeDisabled();

    await bar.getByRole('button', { name: 'Accept all' }).click();
    await expect(bar).toBeHidden();
    await expect(textbox).toContainText(
      'The review flow gives every writer feedback from expert reviewers.',
    );
    await expect(textbox).not.toContainText('Teh');
    await expect(textbox).not.toContainText('basically');
    await expect(inserts).toHaveCount(0);
    await expect(deletes).toHaveCount(0);
    await expect(save).toBeEnabled();
  });

  test('rejects every review suggestion and restores the exact original document', async ({
    mlv,
  }) => {
    await gotoEditorAi(mlv);
    const before = await mlv
      .example(2)
      .locator('mlv-editor')
      .getByRole('textbox', { name: 'Editor with reviewable AI suggestions' })
      .innerText();

    const { textbox, bar } = await startAiReview(mlv);
    await bar.getByRole('button', { name: 'Reject all' }).click();

    await expect(bar).toBeHidden();
    await expect(textbox).toContainText(
      'Teh review flow gives basically every writer feedback from reviewers.',
    );
    expect(await textbox.innerText()).toBe(before);
  });
});

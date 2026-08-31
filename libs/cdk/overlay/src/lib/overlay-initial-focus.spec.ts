import { TestBed } from '@angular/core/testing';

import { MlvOverlayInitialFocusResolver } from './overlay-initial-focus';

describe('MlvOverlayInitialFocusResolver', () => {
  let resolver: MlvOverlayInitialFocusResolver;
  let container: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    resolver = TestBed.inject(MlvOverlayInitialFocusResolver);

    container = document.createElement('div');
    container.setAttribute('role', 'dialog');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  /** Builds the DOM shape a service-opened dialog actually produces. */
  function renderDialogBody(): void {
    container.innerHTML = `
      <div class="mlv-dialog__header">
        <h2>Title</h2>
        <mlv-button-close class="mlv-button-close">
          <button class="mlv-button mlv-button--close" aria-label="Close"></button>
        </mlv-button-close>
      </div>
      <div class="mlv-dialog__body">
        <div class="mlv-scrollbar__viewport" tabindex="0">
          <div class="mlv-scrollbar__content">
            <input class="first-field" />
            <input class="second-field" />
          </div>
        </div>
      </div>
      <div class="mlv-dialog__footer">
        <button class="cancel">Cancel</button>
        <button class="confirm">Confirm</button>
      </div>
    `;
  }

  it("skips the close button and the scroll viewport under 'auto'", () => {
    renderDialogBody();

    expect(resolver.resolve(container, 'auto')).toBe(
      container.querySelector('.first-field'),
    );
  });

  it("takes the close button and scroll viewport under 'first-tabbable'", () => {
    renderDialogBody();

    expect(resolver.resolve(container, 'first-tabbable')).toBe(
      container.querySelector('.mlv-button--close'),
    );
  });

  it("prefers a projected [mlvAutofocus] element under 'auto'", () => {
    renderDialogBody();
    container
      .querySelector('.mlv-dialog__footer')
      ?.setAttribute('mlvAutofocus', '');

    expect(resolver.resolve(container, 'auto')).toBe(
      container.querySelector('.cancel'),
    );
  });

  it("falls back to the container when 'auto' finds no eligible control", () => {
    container.innerHTML = `
      <div class="mlv-scrollbar__viewport" tabindex="0">
        <p>Read-only text.</p>
      </div>
    `;

    expect(resolver.resolve(container, 'auto')).toBe(container);
  });

  it('resolves a CSS selector against the container', () => {
    renderDialogBody();

    expect(resolver.resolve(container, '.confirm')).toBe(
      container.querySelector('.confirm'),
    );
    expect(resolver.resolve(container, '.missing')).toBeNull();
  });

  it('returns an explicit element unchanged', () => {
    renderDialogBody();
    const target = container.querySelector<HTMLElement>('.second-field');

    expect(resolver.resolve(container, target as HTMLElement)).toBe(target);
  });

  it("returns the container itself for 'container'", () => {
    renderDialogBody();

    expect(resolver.resolve(container, 'container')).toBe(container);
  });

  it('ignores hidden subtrees', () => {
    container.innerHTML = `
      <div style="display: none"><input class="hidden-field" /></div>
      <div hidden><input class="hidden-attr-field" /></div>
      <input class="visible-field" />
    `;

    expect(resolver.resolve(container, 'auto')).toBe(
      container.querySelector('.visible-field'),
    );
  });

  it('focuses the resolved target', () => {
    renderDialogBody();

    const focused = resolver.focus(container, 'auto');

    expect(focused).toBe(container.querySelector('.first-field'));
    expect(document.activeElement).toBe(focused);
  });

  it('makes the container programmatically focusable before focusing it', () => {
    container.innerHTML = '<p>Nothing focusable.</p>';

    const focused = resolver.focus(container, 'auto');

    expect(focused).toBe(container);
    expect(container.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(container);
  });

  it('leaves an existing container tabindex alone', () => {
    container.setAttribute('tabindex', '0');
    container.innerHTML = '<p>Nothing focusable.</p>';

    resolver.focus(container, 'container');

    expect(container.getAttribute('tabindex')).toBe('0');
  });
});

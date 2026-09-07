import { describe, expect, it } from 'vitest';
import {
  captureMlvTaskboardDragResidue,
  restoreMlvTaskboardDragResidue,
  sanitizeMlvTaskboardClone,
} from './taskboard-sortable-dom';

/** A container holding two cards, with `card` the first of them. */
function cell(): { container: HTMLElement; card: HTMLElement } {
  const container = document.createElement('div');
  const card = document.createElement('div');
  const sibling = document.createElement('div');
  card.className = 'mlv-taskboard__card';
  sibling.className = 'mlv-taskboard__card';
  container.append(card, sibling);
  document.body.append(container);
  return { container, card };
}

describe('sanitizeMlvTaskboardClone', () => {
  it('hides a transient clone from assistive technology and freezes it', () => {
    const clone = document.createElement('div');
    clone.id = 'card-a';
    clone.innerHTML =
      '<span id="card-a-title">Title</span><button id="card-a-action">Go</button>';
    clone.style.animation = 'mlv-card-enter 200ms ease';

    sanitizeMlvTaskboardClone(clone);

    expect(clone.getAttribute('aria-hidden')).toBe('true');
    expect(clone.getAttribute('inert')).toBe('');
    expect(clone.hasAttribute('id')).toBe(false);
    // A duplicated `id` inside the clone would shadow the real card's own
    // label and control references while the clone follows the pointer.
    expect(clone.querySelectorAll('[id]')).toHaveLength(0);
    expect(clone.style.animation).toBe('none');
  });
});

describe('restoreMlvTaskboardDragResidue', () => {
  it('puts a relocated element back before its captured sibling', () => {
    const { container, card } = cell();
    const sibling = card.nextElementSibling;
    const residue = captureMlvTaskboardDragResidue(card, container);
    const elsewhere = document.createElement('div');
    document.body.append(elsewhere);

    card.classList.add(
      'mlv-taskboard__sortable-chosen',
      'mlv-taskboard__sortable-drag',
      'mlv-taskboard__sortable-ghost',
      'mlv-taskboard__sortable-fallback',
    );
    card.setAttribute('style', 'transform: translate(4px, 8px);');
    card.setAttribute('draggable', 'true');
    elsewhere.append(card);

    restoreMlvTaskboardDragResidue(residue, undefined);

    expect(card.parentElement).toBe(container);
    expect(card.nextElementSibling).toBe(sibling);
    expect(card.className).toBe('mlv-taskboard__card');
    expect(card.getAttribute('style')).toBeNull();
    expect(card.getAttribute('draggable')).toBeNull();
  });

  it('restores the attribute values the element carried before the drag', () => {
    const { container, card } = cell();
    card.setAttribute('style', 'opacity: 0.5;');
    card.setAttribute('draggable', 'false');
    const residue = captureMlvTaskboardDragResidue(card, container);

    card.setAttribute('style', 'transform: translate(4px, 8px);');
    card.setAttribute('draggable', 'true');

    restoreMlvTaskboardDragResidue(residue, undefined);

    expect(card.getAttribute('style')).toBe('opacity: 0.5;');
    expect(card.getAttribute('draggable')).toBe('false');
  });

  it('strips the state classes of a drag that captured no residue', () => {
    const { card } = cell();
    card.classList.add(
      'mlv-taskboard__sortable-chosen',
      'mlv-taskboard__sortable-fallback',
    );

    restoreMlvTaskboardDragResidue(null, card);

    expect(card.className).toBe('mlv-taskboard__card');
  });
});

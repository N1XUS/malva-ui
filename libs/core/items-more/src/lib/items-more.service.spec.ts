import type { MlvItemsMoreItem } from './item/item';
import { MlvItemsMoreService } from './items-more.service';

/** A stand-in item: the registry reads nothing from an item but its node. */
function fakeItem(node: HTMLElement): MlvItemsMoreItem {
  return { elementRef: { nativeElement: node } } as unknown as MlvItemsMoreItem;
}

describe('MlvItemsMoreService', () => {
  let service: MlvItemsMoreService;
  let container: HTMLElement;

  beforeEach(() => {
    service = new MlvItemsMoreService();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  function node(id: string): HTMLElement {
    const element = document.createElement('span');
    element.id = id;
    return element;
  }

  describe('register', () => {
    it('orders items by document position, not by registration order', () => {
      const [first, second, third] = ['first', 'second', 'third'].map(node);
      container.append(first, second, third);
      const items = [first, second, third].map(fakeItem);

      service.register(items[2]);
      service.register(items[0]);
      service.register(items[1]);

      expect(service.items()).toEqual(items);
    });

    it('appends a node it cannot compare with the registered ones', () => {
      const attached = node('attached');
      container.append(attached);
      const detached = node('detached');
      const items = [attached, detached].map(fakeItem);

      service.register(items[0]);
      service.register(items[1]);

      expect(service.items()).toEqual(items);
    });
  });

  describe('split', () => {
    let items: MlvItemsMoreItem[];

    beforeEach(() => {
      const nodes = ['a', 'b', 'c'].map(node);
      container.append(...nodes);
      items = nodes.map(fakeItem);
      for (const item of items) service.register(item);
    });

    it('partitions items into visible and hidden, each in declaration order', () => {
      service.commit(new Set([items[2], items[1]]));

      expect(service.visibleItems()).toEqual([items[0]]);
      expect(service.hiddenItems()).toEqual([items[1], items[2]]);
    });

    it('does not replace the split when an equivalent one is committed', () => {
      service.commit(new Set([items[2]]));
      const committed = service.hidden();
      const visible = service.visibleItems();

      service.commit(new Set([items[2]]));

      expect(service.hidden()).toBe(committed);
      expect(service.visibleItems()).toBe(visible);
    });

    it('replaces a split of the same size but different members', () => {
      service.commit(new Set([items[2]]));

      service.commit(new Set([items[1]]));

      expect(service.hiddenItems()).toEqual([items[1]]);
    });

    it('drops an unregistered item from the registry and from the split', () => {
      service.commit(new Set([items[1], items[2]]));

      service.unregister(items[2]);

      expect(service.items()).toEqual([items[0], items[1]]);
      expect(service.hidden().has(items[2])).toBe(false);
      expect(service.hiddenItems()).toEqual([items[1]]);
    });
  });
});

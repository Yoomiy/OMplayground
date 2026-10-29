/** Defer GPU readbacks until a slot is visible, and do at most one per frame. */
export class VisibleItemIcons {
  private waiting = new Map<HTMLElement, string>();
  private visible = new Set<HTMLElement>();
  private frame = 0;
  private observer: IntersectionObserver;

  constructor(
    root: HTMLElement,
    private icon: (itemType: string, cachedOnly: boolean) => string | null,
  ) {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = entry.target as HTMLElement;
          if (entry.isIntersecting) this.visible.add(node);
          else this.visible.delete(node);
        }
        this.schedule();
      },
      { root },
    );
  }

  observe(node: HTMLElement, itemType: string): void {
    const cached = this.icon(itemType, true);
    if (cached) {
      this.paint(node, cached);
      return;
    }
    this.waiting.set(node, itemType);
    this.observer.observe(node);
  }

  forget(root: HTMLElement): void {
    for (const node of this.waiting.keys())
      if (root.contains(node)) {
        this.observer.unobserve(node);
        this.waiting.delete(node);
        this.visible.delete(node);
      }
  }

  private schedule(): void {
    if (this.frame || !this.visible.size) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      for (const node of this.visible) {
        this.visible.delete(node);
        const itemType = this.waiting.get(node);
        this.waiting.delete(node);
        this.observer.unobserve(node);
        if (!node.isConnected || !itemType) continue;
        const url = this.icon(itemType, false);
        if (url) this.paint(node, url);
        break;
      }
      this.schedule();
    });
  }

  private paint(node: HTMLElement, url: string): void {
    node.querySelector('.voxel-item-slot__empty')?.remove();
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.draggable = false;
    node.append(image);
  }

  reset(): void {
    this.observer.disconnect();
    this.waiting.clear();
    this.visible.clear();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}

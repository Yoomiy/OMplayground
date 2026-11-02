import * as THREE from 'three';
import type { EngineBlock, ItemDefinition } from '../shared/content.ts';
import { itemGeometry, worldItemMaterial } from './held-block.ts';
import { itemSprite } from './item-sprites.ts';

/** Authored item sprites and cached block thumbnails, shared by every inventory surface. */
export class ItemIcons {
  private cache = new Map<string, string>();
  private target = new THREE.WebGLRenderTarget(48, 48);
  private camera = new THREE.OrthographicCamera(-0.85, 0.85, 0.85, -0.85, 0.1, 10);
  constructor(
    private renderer: THREE.WebGLRenderer,
    private blocks: readonly EngineBlock[],
    private items: readonly ItemDefinition[],
    private albedo: THREE.Texture,
    private surface: THREE.Texture,
  ) {
    this.target.texture.colorSpace = renderer.outputColorSpace;
    this.camera.position.set(2, 1.6, 2.6);
    this.camera.lookAt(0, 0, 0);
  }
  get(itemType: string, cachedOnly = false): string | null {
    const cached = this.cache.get(itemType);
    if (cached) return cached;
    if (cachedOnly) return null;
    const item = this.items.find((item) => item.itemType === itemType);
    if (!item) return null;
    const sprite = itemSprite(item);
    if (sprite) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 16;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const image = context.createImageData(16, 16);
      image.data.set(sprite);
      context.putImageData(image, 0, 0);
      const url = canvas.toDataURL('image/png');
      this.cache.set(itemType, url);
      return url;
    }
    if (this.renderer.getContext().isContextLost()) return null;
    const geometry = itemGeometry(item, this.blocks);
    const material = worldItemMaterial(item, this.blocks, this.albedo, this.surface);
    material.defines = {};
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geometry, material));
    const previous = this.renderer.getRenderTarget();
    const clearColor = this.renderer.getClearColor(new THREE.Color());
    const clearAlpha = this.renderer.getClearAlpha();
    try {
      this.renderer.setRenderTarget(this.target);
      this.renderer.setClearColor(0, 0);
      this.renderer.render(scene, this.camera);
      const pixels = new Uint8Array(48 * 48 * 4);
      this.renderer.readRenderTargetPixels(this.target, 0, 0, 48, 48, pixels);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 48;
      const context = canvas.getContext('2d');
      if (!context) return null;
      const image = context.createImageData(48, 48);
      for (let y = 0; y < 48; y++)
        image.data.set(pixels.subarray((47 - y) * 192, (48 - y) * 192), y * 192);
      context.putImageData(image, 0, 0);
      const url = canvas.toDataURL('image/png');
      this.cache.set(itemType, url);
      return url;
    } finally {
      this.renderer.setRenderTarget(previous);
      this.renderer.setClearColor(clearColor, clearAlpha);
      geometry.dispose();
      material.dispose();
    }
  }
  dispose(): void {
    this.cache.clear();
    this.target.dispose();
  }
}

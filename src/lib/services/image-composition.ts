import sharp from 'sharp';
import { Trait, TraitSlot } from '@/types';
import { PreviewService, TraitSelection } from './preview';

export interface CompositionResult {
  imageBuffer: Buffer;
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
}

export interface CompositionOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number; // For JPEG and WebP
  /**
   * OPTIONAL BUT IMPORTANT:
   * Pass the NFT's CURRENT traits here (full set), and pass ONLY overrides in selectedTraits.
   * The composer will merge: effectiveTraits = baseTraits + selectedTraits(overrides)
   *
   * If you don't pass baseTraits, and selectedTraits only includes changed traits,
   * the output image will miss the other layers (the bug you're seeing).
   */
  baseTraits?: TraitSelection;

  /**
   * If true, always compose from a transparent base instead of using baseImageUrl pixels.
   * Recommended when you want accurate recomposition after changing any trait.
   */
  forceTransparentBase?: boolean;

  /**
   * Network timeout per layer fetch (ms)
   */
  fetchTimeoutMs?: number;
}

export class ImageCompositionService {
  private previewService: PreviewService;

  constructor() {
    this.previewService = new PreviewService();
  }

  /**
   * Composes an NFT image by layering trait images in slot order.
   *
   * ✅ Correct behavior (your requirement):
   * - If only Background is changed, output still contains all other existing traits.
   *
   * How:
   * - Provide options.baseTraits as the CURRENT full trait set
   * - Provide selectedTraits as only the changes (overrides)
   * - The service merges them and re-composes from transparent base
   */
  async composeImage(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    options: CompositionOptions = {},
    baseUrl?: string
  ): Promise<CompositionResult> {
    const {
      width = 512,
      height = 512,
      format = 'png',
      quality = 90,
      baseTraits,
      forceTransparentBase = false,
      fetchTimeoutMs = 10000
    } = options;

    console.log('🎨 Starting image composition:', {
      baseImageUrl,
      selectedTraitsCount: Object.keys(selectedTraits || {}).length,
      selectedTraitsKeys: Object.keys(selectedTraits || {}),
      baseTraitsCount: baseTraits ? Object.keys(baseTraits).length : 0,
      slotsCount: slots.length,
      dimensions: `${width}x${height}`,
      format,
      forceTransparentBase
    });

    // Build effective trait set:
    // effective = baseTraits (current) + selectedTraits (overrides)
    const effectiveTraits = this.mergeTraitsBySlotId(slots, baseTraits, selectedTraits);

    // If the caller only sent a few overrides and didn't send baseTraits, warn loudly.
    // (This is exactly the bug symptom.)
    if (
      (!baseTraits || Object.keys(baseTraits).length === 0) &&
      this.looksLikeOverridesOnly(slots, effectiveTraits)
    ) {
      console.warn(
        '⚠️ ImageCompositionService: It looks like you provided only override traits but no baseTraits. ' +
          'Result may miss other layers. Fix by passing options.baseTraits (the NFT current traits).'
      );
    }

    // Decide base strategy:
    // - If we are recomposing (baseTraits present) OR forceTransparentBase is true, use transparent base.
    // - Otherwise, use baseImageUrl pixels as base.
    const shouldUseTransparentBase =
      forceTransparentBase ||
      this.isTransparentBaseUrl(baseImageUrl) ||
      (baseTraits && Object.keys(baseTraits).length > 0);

    let compositeImage: sharp.Sharp;

    if (shouldUseTransparentBase) {
      compositeImage = sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      });
    } else {
      const absoluteBaseImageUrl = this.toAbsoluteUrl(baseImageUrl, baseUrl);
      const baseImageBuffer = await this.fetchAsBuffer(absoluteBaseImageUrl, fetchTimeoutMs);
      compositeImage = sharp(baseImageBuffer).resize(width, height);
    }

    // Order traits by layer using your preview service (slot layer order)
    const orderedTraits = this.previewService.orderTraitsByLayer(effectiveTraits, slots);

    console.log(
      `🧩 Composing with ${orderedTraits.length} trait layers in order:`,
      orderedTraits.map((t) => {
        const slot = slots.find((s) => s.id === t.slotId);
        const layer = (slot as any)?.layerOrder ?? (slot as any)?.order ?? 'unknown';
        return `${t.name} (slot=${slot?.name || t.slotId}, layer=${layer})`;
      })
    );

    const layers: sharp.OverlayOptions[] = [];

    for (const trait of orderedTraits) {
      // Skip if trait has no image URL
      if (!trait?.imageLayerUrl) continue;

      // Skip "Blank" traits (common in your collection)
      if (typeof trait.name === 'string' && trait.name.trim().toLowerCase() === 'blank') {
        continue;
      }

      try {
        const traitImageUrl = this.toAbsoluteUrl(trait.imageLayerUrl, baseUrl);

        console.log(`📥 Fetching trait layer: ${trait.name} -> ${traitImageUrl}`);

        const traitBuffer = await this.fetchAsBuffer(traitImageUrl, fetchTimeoutMs);

        // Ensure trait layer matches output size & has alpha
        const resizedTraitBuffer = await sharp(traitBuffer).resize(width, height).png().toBuffer();

        layers.push({
          input: resizedTraitBuffer,
          top: 0,
          left: 0
        });
      } catch (error) {
        console.error(`❌ Failed to load/apply trait image: ${trait?.imageLayerUrl}`, error);
        // continue composing with remaining layers
      }
    }

    if (layers.length > 0) {
      console.log(`🎨 Applying ${layers.length} layers...`);
      compositeImage = compositeImage.composite(layers);
    } else {
      console.warn('⚠️ No trait layers applied (layers=0). Output will be base only.');
    }

    console.log(`🖼️ Generating final ${format} buffer...`);
    let imageBuffer: Buffer;

    if (format === 'webp') {
      imageBuffer = await compositeImage.webp({ quality }).toBuffer();
    } else if (format === 'jpeg') {
      imageBuffer = await compositeImage.jpeg({ quality }).toBuffer();
    } else {
      imageBuffer = await compositeImage.png().toBuffer();
    }

    console.log('✅ Image composition completed:', {
      outputBytes: imageBuffer.length,
      width,
      height,
      format
    });

    return { imageBuffer, width, height, format };
  }

  /**
   * Validates that trait image URLs are reachable.
   * NOTE: Uses absolute URL conversion if needed.
   */
  async validateTraitImages(
    traits: Trait[],
    baseUrl?: string,
    fetchTimeoutMs: number = 10000
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const trait of traits) {
      try {
        const url = this.toAbsoluteUrl(trait.imageLayerUrl, baseUrl);
        await this.fetchAsBuffer(url, fetchTimeoutMs);
      } catch (error) {
        errors.push(
          `Failed to load trait ${trait?.name} (${trait?.id}): ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Creates a preview composition (PNG).
   */
  async createPreview(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    previewSize: number = 512,
    baseUrl?: string,
    baseTraits?: TraitSelection
  ): Promise<CompositionResult> {
    return this.composeImage(
      baseImageUrl,
      selectedTraits,
      slots,
      {
        width: previewSize,
        height: previewSize,
        format: 'png',
        baseTraits,
        // previews should always recompose cleanly
        forceTransparentBase: true
      },
      baseUrl
    );
  }

  /**
   * Creates a final high-quality image composition for metadata.
   * Fixed at 1500x1500 WebP (quality 90).
   */
  async createFinalComposition(
    baseImageUrl: string,
    selectedTraits: TraitSelection,
    slots: TraitSlot[],
    baseUrl?: string,
    baseTraits?: TraitSelection
  ): Promise<CompositionResult> {
    return this.composeImage(
      baseImageUrl,
      selectedTraits,
      slots,
      {
        width: 1500,
        height: 1500,
        format: 'webp',
        quality: 90,
        baseTraits,
        // final should always recompose cleanly
        forceTransparentBase: true
      },
      baseUrl
    );
  }

  /**
   * Gets standard NFT image dimensions and formats.
   */
  static getStandardDimensions() {
    return {
      preview: { width: 512, height: 512, format: 'png' as const },
      final: { width: 1500, height: 1500, format: 'webp' as const, quality: 90 }
    };
  }

  // -----------------------------
  // Internal helpers
  // -----------------------------

  private isTransparentBaseUrl(url: string): boolean {
    if (!url) return false;
    return url === '/api/transparent-base' || url.includes('transparent-base');
  }

  private toAbsoluteUrl(url: string, baseUrl?: string): string {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    if (url.startsWith('/')) {
      const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return `${baseUrl || fallbackBaseUrl}${url}`;
    }

    // For non-leading-slash relative paths, try to resolve against baseUrl/fallback
    const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl || fallbackBaseUrl}/${url}`.replace(/([^:]\/)\/+/g, '$1');
  }

  private async fetchAsBuffer(url: string, timeoutMs: number): Promise<Buffer> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NFT-Trait-Marketplace/1.0' }
      });

      if (!res.ok) {
        throw new Error(`Fetch failed (${res.status}) ${res.statusText} for ${url}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      return buf;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error(`Fetch timeout after ${timeoutMs}ms for ${url}`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Merge traits by slotId:
   * - Start from baseTraits (current full traits)
   * - Override with selectedTraits (only changes)
   * - Ensure map keys are slotIds (TraitSelection in your codebase)
   */
  private mergeTraitsBySlotId(
    slots: TraitSlot[],
    baseTraits?: TraitSelection,
    selectedTraits?: TraitSelection
  ): TraitSelection {
    const merged: TraitSelection = {};

    // copy base traits first
    if (baseTraits) {
      for (const [slotId, trait] of Object.entries(baseTraits)) {
        if (trait) merged[slotId] = trait;
      }
    }

    // apply overrides
    if (selectedTraits) {
      for (const [slotId, trait] of Object.entries(selectedTraits)) {
        if (trait) merged[slotId] = trait;
      }
    }

    // Optional: if caller accidentally keyed by slotName instead of slotId,
    // try to remap (best-effort).
    // (This prevents silent broken compositions if UI sends "Background" keys.)
    const slotIdSet = new Set(slots.map((s) => s.id));
    const mergedKeys = Object.keys(merged);

    const hasNonSlotIdKeys = mergedKeys.some((k) => !slotIdSet.has(k));
    if (hasNonSlotIdKeys) {
      const remapped: TraitSelection = {};
      for (const [key, trait] of Object.entries(merged)) {
        if (slotIdSet.has(key)) {
          remapped[key] = trait;
          continue;
        }
        const matchedSlot = slots.find(
          (s) => s.name?.toLowerCase?.() === key.toLowerCase?.()
        );
        if (matchedSlot) {
          remapped[matchedSlot.id] = trait;
        } else {
          // keep unknown key (won't be used by orderTraitsByLayer anyway)
          remapped[key] = trait;
        }
      }
      return remapped;
    }

    return merged;
  }

  /**
   * Heuristic: if many slots are missing in the effective trait map,
   * it's likely only overrides were provided.
   */
  private looksLikeOverridesOnly(slots: TraitSlot[], effective: TraitSelection): boolean {
    const slotIds = slots.map((s) => s.id);
    const present = slotIds.filter((id) => !!effective[id]).length;

    // if less than half slots present, it's probably overrides-only
    return present > 0 && present < Math.ceil(slotIds.length / 2);
  }
}

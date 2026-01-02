import { CoreAsset, Trait, TraitSlot } from '@/types';

export interface TraitSelection {
  [slotId: string]: Trait;
}

export interface RuleViolation {
  type: 'exclusion' | 'dependency';
  message: string;
  conflictingTraits: string[];
}

export interface PreviewResult {
  isValid: boolean;
  violations: RuleViolation[];
  layeredTraits: Trait[];
}

export class PreviewService {
  /**
   * Validates trait combinations against slot rules
   */
  validateTraitCombination(
    selectedTraits: TraitSelection,
    slots: TraitSlot[]
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    
    for (const slot of slots) {
      if (!slot.rulesJson) continue;
      
      const selectedTrait = selectedTraits[slot.id];
      if (!selectedTrait) continue;
      
      const rules = slot.rulesJson;
      
      // Check mutual exclusions
      if (rules.exclusions) {
        for (const exclusion of rules.exclusions) {
          const conflictingSlotId = exclusion.slotId;
          const conflictingTraitIds = exclusion.traitIds || [];
          
          const conflictingTrait = selectedTraits[conflictingSlotId];
          if (conflictingTrait && 
              (conflictingTraitIds.length === 0 || conflictingTraitIds.includes(conflictingTrait.id))) {
            violations.push({
              type: 'exclusion',
              message: `${selectedTrait.name} cannot be used with ${conflictingTrait.name}`,
              conflictingTraits: [selectedTrait.id, conflictingTrait.id]
            });
          }
        }
      }
      
      // Check dependencies
      if (rules.dependencies) {
        for (const dependency of rules.dependencies) {
          const requiredSlotId = dependency.slotId;
          const requiredTraitIds = dependency.traitIds || [];
          
          const requiredTrait = selectedTraits[requiredSlotId];
          if (!requiredTrait || 
              (requiredTraitIds.length > 0 && !requiredTraitIds.includes(requiredTrait.id))) {
            violations.push({
              type: 'dependency',
              message: `${selectedTrait.name} requires a trait in ${dependency.slotName || requiredSlotId}`,
              conflictingTraits: [selectedTrait.id]
            });
          }
        }
      }
    }
    
    return violations;
  }

  /**
   * Orders traits by their slot layer order for proper rendering
   */
  orderTraitsByLayer(
    selectedTraits: TraitSelection,
    slots: TraitSlot[]
  ): Trait[] {
    // Create a map of slot ID to layer order
    const slotOrderMap = new Map<string, number>();
    slots.forEach(slot => {
      slotOrderMap.set(slot.id, slot.layerOrder);
    });

    // Get all selected traits and sort by layer order
    const traits = Object.values(selectedTraits);
    return traits.sort((a, b) => {
      const orderA = slotOrderMap.get(a.slotId) || 0;
      const orderB = slotOrderMap.get(b.slotId) || 0;
      return orderA - orderB;
    });
  }

  /**
   * Validates and orders traits for preview
   */
  generatePreview(
    selectedTraits: TraitSelection,
    slots: TraitSlot[]
  ): PreviewResult {
    const violations = this.validateTraitCombination(selectedTraits, slots);
    const layeredTraits = this.orderTraitsByLayer(selectedTraits, slots);
    
    return {
      isValid: violations.length === 0,
      violations,
      layeredTraits
    };
  }
}

export class CanvasPreviewRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  /**
   * Renders the base NFT image with trait layers applied in order
   */
  async renderPreview(
    baseImage: string,
    layeredTraits: Trait[],
    width: number = 512,
    height: number = 512
  ): Promise<string> {
    // Set canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);
    
    try {
      // Load and draw base image
      const baseImg = await this.loadImage(baseImage);
      this.ctx.drawImage(baseImg, 0, 0, width, height);
      
      // Layer traits in order
      for (const trait of layeredTraits) {
        const traitImg = await this.loadImage(trait.imageLayerUrl);
        this.ctx.drawImage(traitImg, 0, 0, width, height);
      }
      
      // Return data URL
      return this.canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error rendering preview:', error);
      throw error;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
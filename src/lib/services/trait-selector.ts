import { TraitPoolRepository, TraitPoolRow } from '@/lib/repositories/trait-pool';
import { PoolTrait, SelectedTrait } from '@/types/reforge';

const MANDATORY_SLOTS = ['background', 'skin', 'eyes', 'mouth'];
const MAX_ATTEMPTS = 100;

/**
 * TraitSelectorService handles random trait selection from the swap pool
 * within the pack's LDZ earning range constraints.
 *
 * Algorithm:
 * 1. Load all traits from the swap pool for the collection, grouped by slot.
 * 2. For each mandatory slot, pick a random trait.
 * 3. For optional slots, decide inclusion based on remaining budget.
 * 4. Zero-earning traits are freely included without budget impact.
 * 5. Use backtracking with randomized restarts if initial selection exceeds range.
 * 6. Fail after 100 attempts if no valid combination is found.
 */
export class TraitSelectorService {
  private repository: TraitPoolRepository;

  constructor(repository?: TraitPoolRepository) {
    this.repository = repository || new TraitPoolRepository();
  }

  /**
   * Select traits from the swap pool for a collection within the given LDZ earning range.
   * Returns an array of SelectedTrait objects satisfying:
   * - Exactly one trait per mandatory slot (background, skin, eyes, mouth)
   * - Sum of LDZ earnings (excluding zero-earning traits) within [minLdz, maxLdz]
   * - Zero-earning traits do not count toward the earning sum
   */
  async selectTraits(
    collectionId: string,
    minLdz: number,
    maxLdz: number
  ): Promise<SelectedTrait[]> {
    const rows = await this.repository.findByCollection(collectionId);
    const traits = rows.map((row) => this.repository.toDomain(row));

    // Group traits by slot name (lowercased for matching)
    const traitsBySlot = this.groupBySlot(traits);

    // Validate that all mandatory slots have at least one trait
    for (const slot of MANDATORY_SLOTS) {
      const slotTraits = this.getTraitsForMandatorySlot(traitsBySlot, slot);
      if (!slotTraits || slotTraits.length === 0) {
        throw new Error(
          `TRAIT_SELECTION_FAILED: No traits available for mandatory slot "${slot}"`
        );
      }
    }

    // Attempt trait selection with randomized restarts
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = this.attemptSelection(traitsBySlot, minLdz, maxLdz);
      if (result !== null) {
        return result;
      }
    }

    throw new Error(
      `TRAIT_SELECTION_FAILED: Could not find a valid combination within earning range [${minLdz}, ${maxLdz}] after ${MAX_ATTEMPTS} attempts`
    );
  }

  /**
   * Attempt a single trait selection. Returns null if the combination
   * doesn't satisfy the earning range constraint.
   */
  private attemptSelection(
    traitsBySlot: Map<string, PoolTrait[]>,
    minLdz: number,
    maxLdz: number
  ): SelectedTrait[] | null {
    const selected: SelectedTrait[] = [];

    // Step 1: Fill mandatory slots
    for (const slot of MANDATORY_SLOTS) {
      const slotTraits = this.getTraitsForMandatorySlot(traitsBySlot, slot);
      if (!slotTraits || slotTraits.length === 0) {
        return null;
      }
      const trait = this.pickRandom(slotTraits);
      selected.push(this.toSelectedTrait(trait));
    }

    // Step 2: Fill optional slots
    const optionalSlots = this.getOptionalSlots(traitsBySlot);
    for (const [_slotName, slotTraits] of optionalSlots) {
      // For optional slots, randomly decide whether to include a trait
      // Zero-earning traits are always freely included
      const zeroEarningTraits = slotTraits.filter((t) => t.ldzEarning === 0);
      const earningTraits = slotTraits.filter((t) => t.ldzEarning > 0);

      // Always include a zero-earning trait if available and no earning traits exist
      if (earningTraits.length === 0 && zeroEarningTraits.length > 0) {
        selected.push(this.toSelectedTrait(this.pickRandom(zeroEarningTraits)));
      } else if (slotTraits.length > 0) {
        // Randomly decide to include an optional trait
        if (Math.random() < 0.5) {
          const trait = this.pickRandom(slotTraits);
          selected.push(this.toSelectedTrait(trait));
        }
      }
    }

    // Step 3: Validate earning range
    const earningSum = this.calculateEarningSum(selected);
    if (earningSum >= minLdz && earningSum <= maxLdz) {
      return selected;
    }

    return null;
  }

  /**
   * Calculate the sum of LDZ earnings for selected traits,
   * excluding zero-earning traits.
   */
  private calculateEarningSum(traits: SelectedTrait[]): number {
    return traits.reduce((sum, trait) => {
      if (trait.ldzEarning > 0) {
        return sum + trait.ldzEarning;
      }
      return sum;
    }, 0);
  }

  /**
   * Group traits by their slot name (lowercased).
   */
  private groupBySlot(traits: PoolTrait[]): Map<string, PoolTrait[]> {
    const grouped = new Map<string, PoolTrait[]>();
    for (const trait of traits) {
      const slotKey = trait.slotName.toLowerCase();
      if (!grouped.has(slotKey)) {
        grouped.set(slotKey, []);
      }
      grouped.get(slotKey)!.push(trait);
    }
    return grouped;
  }

  /**
   * Get traits for a mandatory slot, matching by lowercased slot name.
   */
  private getTraitsForMandatorySlot(
    traitsBySlot: Map<string, PoolTrait[]>,
    slotName: string
  ): PoolTrait[] | undefined {
    return traitsBySlot.get(slotName.toLowerCase());
  }

  /**
   * Get optional slots (all slots that are not mandatory).
   */
  private getOptionalSlots(
    traitsBySlot: Map<string, PoolTrait[]>
  ): Map<string, PoolTrait[]> {
    const optional = new Map<string, PoolTrait[]>();
    for (const [slotName, traits] of traitsBySlot) {
      if (!MANDATORY_SLOTS.includes(slotName.toLowerCase())) {
        optional.set(slotName, traits);
      }
    }
    return optional;
  }

  /**
   * Pick a random element from an array.
   */
  private pickRandom<T>(items: T[]): T {
    const index = Math.floor(Math.random() * items.length);
    return items[index];
  }

  /**
   * Convert a PoolTrait to a SelectedTrait.
   */
  private toSelectedTrait(trait: PoolTrait): SelectedTrait {
    return {
      slotId: trait.slotId,
      slotName: trait.slotName,
      traitId: trait.id,
      traitName: trait.name,
      imageUrl: trait.imageLayerUrl,
      ldzEarning: trait.ldzEarning,
    };
  }
}

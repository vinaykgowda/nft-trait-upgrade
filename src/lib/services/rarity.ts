export interface RarityTier {
  id: string;
  name: string;
  weight: number;
  displayOrder: number;
}

export class RarityService {
  // Standard rarity tiers with their IDs (fallback)
  static readonly RARITY_TIERS: RarityTier[] = [
    { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Common', weight: 50, displayOrder: 1 },
    { id: '550e8400-e29b-41d4-a716-446655440002', name: 'Uncommon', weight: 30, displayOrder: 2 },
    { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Rare', weight: 15, displayOrder: 3 },
    { id: '550e8400-e29b-41d4-a716-446655440004', name: 'Legendary', weight: 4, displayOrder: 4 },
    { id: '550e8400-e29b-41d4-a716-446655440005', name: 'Mythic', weight: 1, displayOrder: 5 },
  ];

  static getRarityById(id: string): RarityTier | undefined {
    return this.RARITY_TIERS.find(rarity => rarity.id === id);
  }

  static getRarityByName(name: string): RarityTier | undefined {
    return this.RARITY_TIERS.find(rarity => rarity.name.toLowerCase() === name.toLowerCase());
  }

  static getDefaultRarity(): RarityTier {
    return this.RARITY_TIERS[0]; // Common
  }

  static getAllRarities(): RarityTier[] {
    return [...this.RARITY_TIERS];
  }

  static getRarityColor(rarityName: string): string {
    switch (rarityName.toLowerCase()) {
      case 'common':
        return 'text-gray-400';
      case 'uncommon':
        return 'text-green-400';
      case 'rare':
        return 'text-blue-400';
      case 'legendary':
        return 'text-purple-400';
      case 'mythic':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  }

  static getRarityBgColor(rarityName: string): string {
    switch (rarityName.toLowerCase()) {
      case 'common':
        return 'bg-gray-800';
      case 'uncommon':
        return 'bg-green-800';
      case 'rare':
        return 'bg-blue-800';
      case 'legendary':
        return 'bg-purple-800';
      case 'mythic':
        return 'bg-yellow-800';
      default:
        return 'bg-gray-800';
    }
  }
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

interface Trait {
  id: string;
  slotId: string;
  slotName: string;
  name: string;
  imageLayerUrl: string;
  rarityTierId: string;
  rarityTierName: string;
  totalSupply?: number;
  remainingSupply?: number;
  priceAmount: string;
  priceTokenId: string;
  priceTokenSymbol: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TraitSlot {
  id: string;
  name: string;
  layerOrder: number;
}

interface RarityTier {
  id: string;
  name: string;
  weight: number;
  displayOrder: number;
}

interface Token {
  id: string;
  symbol: string;
  mintAddress?: string;
  decimals: number;
}

export default function TraitsPage() {
  const [traits, setTraits] = useState<Trait[]>([]);
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [rarityTiers, setRarityTiers] = useState<RarityTier[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingTrait, setEditingTrait] = useState<Trait | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBulk, setUploadingBulk] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreview, setBulkPreview] = useState<Array<{file: File, traitType: string, value: string, preview: string}>>([]);
  const router = useRouter();

  const [formData, setFormData] = useState({
    slotId: '',
    name: '',
    imageLayerUrl: '',
    rarityTierId: '',
    totalSupply: '',
    priceAmount: '',
    priceTokenId: '',
    active: true,
  });

  const [bulkFormData, setBulkFormData] = useState({
    category: '',
    forSale: true,
    priceAmount: '',
    priceTokenId: '',
    totalQuantity: '',
    requiredTraits: [] as string[],
    artistCommission: '',
    artistWallet: '',
  });

  const [filters, setFilters] = useState({
    slotId: '',
    rarityTierId: '',
    tokenId: '',
    active: '',
  });

  useEffect(() => {
    fetchTraits();
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchTraits();
  }, [filters]);

  const fetchTraits = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/admin/traits?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to fetch traits');
      }
      const data = await response.json();
      setTraits(data.traits || []);
    } catch (err) {
      setError('Failed to load traits');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      setSlots([
        { id: '1', name: 'Background', layerOrder: 1 },
        { id: '2', name: 'Body', layerOrder: 2 },
        { id: '3', name: 'Eyes', layerOrder: 3 },
        { id: '4', name: 'Hat', layerOrder: 4 },
      ]);
      
      setRarityTiers([
        { id: '1', name: 'Common', weight: 100, displayOrder: 1 },
        { id: '2', name: 'Rare', weight: 50, displayOrder: 2 },
        { id: '3', name: 'Epic', weight: 10, displayOrder: 3 },
        { id: '4', name: 'Legendary', weight: 1, displayOrder: 4 },
      ]);

      setTokens([
        { id: '1', symbol: 'SOL', decimals: 9 },
        { id: '2', symbol: 'USDC', mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
      ]);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const handleBulkFileUpload = (files: FileList) => {
    const fileArray = Array.from(files);
    setBulkFiles(fileArray);
    
    // Parse filenames to extract trait info
    const previews = fileArray.map(file => {
      const reader = new FileReader();
      const preview = URL.createObjectURL(file);
      
      // Parse filename format: "traitType/value.png" or "traitType - value.png"
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
      let traitType = '';
      let value = '';
      
      if (fileName.includes('/')) {
        [traitType, value] = fileName.split('/');
      } else if (fileName.includes(' - ')) {
        [traitType, value] = fileName.split(' - ');
      } else if (fileName.includes('_')) {
        [traitType, value] = fileName.split('_');
      } else {
        // Default to filename as value, user can edit
        traitType = 'Unknown';
        value = fileName;
      }
      
      return {
        file,
        traitType: traitType.trim(),
        value: value.trim(),
        preview
      };
    });
    
    setBulkPreview(previews);
  };

  const handleBulkSubmit = async () => {
    if (bulkPreview.length === 0) return;
    
    setUploadingBulk(true);
    setError('');
    
    try {
      const results = [];
      
      for (const item of bulkPreview) {
        // Upload image first (mock for now)
        const mockUrl = `https://example.com/trait-images/${Date.now()}-${item.file.name}`;
        
        // Find or create slot for trait type
        let slotId = slots.find(s => s.name.toLowerCase() === item.traitType.toLowerCase())?.id;
        if (!slotId) {
          // For demo, use first available slot
          slotId = slots[0]?.id || '1';
        }
        
        const traitData = {
          slotId,
          name: item.value,
          imageLayerUrl: mockUrl,
          rarityTierId: rarityTiers[0]?.id || '1', // Default to first rarity
          totalSupply: bulkFormData.totalQuantity ? parseInt(bulkFormData.totalQuantity) : undefined,
          priceAmount: bulkFormData.priceAmount,
          priceTokenId: bulkFormData.priceTokenId,
          active: bulkFormData.forSale,
        };
        
        const response = await fetch('/api/admin/traits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(traitData),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${item.value}`);
        }
        
        results.push(await response.json());
      }
      
      await fetchTraits();
      resetBulkForm();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload traits');
    } finally {
      setUploadingBulk(false);
    }
  };

  const resetBulkForm = () => {
    setBulkFiles([]);
    setBulkPreview([]);
    setBulkFormData({
      category: '',
      forSale: true,
      priceAmount: '',
      priceTokenId: '',
      totalQuantity: '',
      requiredTraits: [],
      artistCommission: '',
      artistWallet: '',
    });
    setShowBulkUpload(false);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUrl = `https://example.com/trait-images/${Date.now()}-${file.name}`;
      setFormData({ ...formData, imageLayerUrl: mockUrl });
      
    } catch (err) {
      setError('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const traitData = {
        ...formData,
        totalSupply: formData.totalSupply ? parseInt(formData.totalSupply) : undefined,
        remainingSupply: formData.totalSupply ? parseInt(formData.totalSupply) : undefined,
      };

      const url = editingTrait 
        ? `/api/admin/traits/${editingTrait.id}`
        : '/api/admin/traits';
      
      const method = editingTrait ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(traitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save trait');
      }

      await fetchTraits();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trait');
    }
  };

  const resetForm = () => {
    setFormData({
      slotId: '',
      name: '',
      imageLayerUrl: '',
      rarityTierId: '',
      totalSupply: '',
      priceAmount: '',
      priceTokenId: '',
      active: true,
    });
    setImagePreview('');
    setShowCreateForm(false);
    setEditingTrait(null);
  };

  const handleEdit = (trait: Trait) => {
    setFormData({
      slotId: trait.slotId,
      name: trait.name,
      imageLayerUrl: trait.imageLayerUrl,
      rarityTierId: trait.rarityTierId,
      totalSupply: trait.totalSupply?.toString() || '',
      priceAmount: trait.priceAmount,
      priceTokenId: trait.priceTokenId,
      active: trait.active,
    });
    setImagePreview(trait.imageLayerUrl);
    setEditingTrait(trait);
    setShowCreateForm(true);
  };

  const formatPrice = (amount: string, tokenSymbol: string, decimals: number) => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    
    if (fraction === 0n) {
      return `${whole} ${tokenSymbol}`;
    }
    
    const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fractionStr} ${tokenSymbol}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-green-400">🎨 Trait Management</h1>
            <p className="mt-2 text-gray-400">
              Upload and manage trait images, pricing, and inventory
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowBulkUpload(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-500 font-bold transition-colors"
            >
              📁 Bulk Upload
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 text-black px-6 py-3 rounded-md hover:bg-green-500 font-bold transition-colors"
            >
              ➕ Add Single Trait
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
            ⚠️ {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Slot
              </label>
              <select
                value={filters.slotId}
                onChange={(e) => setFilters({ ...filters, slotId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Slots</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Rarity
              </label>
              <select
                value={filters.rarityTierId}
                onChange={(e) => setFilters({ ...filters, rarityTierId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Rarities</option>
                {rarityTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Token
              </label>
              <select
                value={filters.tokenId}
                onChange={(e) => setFilters({ ...filters, tokenId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Tokens</option>
                {tokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-400 mb-1">
                Status
              </label>
              <select
                value={filters.active}
                onChange={(e) => setFilters({ ...filters, active: e.target.value })}
                className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Traits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {traits.map((trait) => (
            <div key={trait.id} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden hover:border-green-500 transition-colors">
              <div className="aspect-square bg-gray-800 flex items-center justify-center border-b border-gray-700">
                {trait.imageLayerUrl ? (
                  <img
                    src={trait.imageLayerUrl}
                    alt={trait.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500 text-center">
                    <div className="text-4xl mb-2">🖼️</div>
                    <div>No Image</div>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-green-400">{trait.name}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    trait.active 
                      ? 'bg-green-900 text-green-300 border border-green-700' 
                      : 'bg-red-900 text-red-300 border border-red-700'
                  }`}>
                    {trait.active ? '✅ Active' : '❌ Inactive'}
                  </span>
                </div>
                
                <div className="space-y-1 text-sm text-gray-400">
                  <p><span className="font-medium text-green-400">Slot:</span> {trait.slotName}</p>
                  <p><span className="font-medium text-green-400">Rarity:</span> {trait.rarityTierName}</p>
                  <p>
                    <span className="font-medium text-green-400">Price:</span> {' '}
                    <span className="text-green-300">
                      {formatPrice(
                        trait.priceAmount, 
                        trait.priceTokenSymbol,
                        tokens.find(t => t.id === trait.priceTokenId)?.decimals || 9
                      )}
                    </span>
                  </p>
                  {trait.totalSupply && (
                    <p>
                      <span className="font-medium text-green-400">Supply:</span> {' '}
                      <span className="text-green-300">{trait.remainingSupply}/{trait.totalSupply}</span>
                    </p>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    onClick={() => handleEdit(trait)}
                    className="bg-green-700 hover:bg-green-600 text-black px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {traits.length === 0 && (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-700">
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-gray-400 text-lg">No traits found.</p>
            <p className="text-gray-500">Create your first trait to get started.</p>
          </div>
        )}

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border border-green-500 w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-gray-900">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-green-400 mb-4">
                  {editingTrait ? '✏️ Edit Trait' : '➕ Create New Trait'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Image Upload Section */}
                  <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <label className="block text-sm font-medium text-green-400 mb-2">
                      🖼️ Trait Image *
                    </label>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-black hover:file:bg-green-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Upload PNG, JPG, or GIF. Max 10MB.
                        </p>
                      </div>
                      
                      {(imagePreview || formData.imageLayerUrl) && (
                        <div className="w-20 h-20 bg-gray-700 rounded-lg overflow-hidden border border-gray-600">
                          <img
                            src={imagePreview || formData.imageLayerUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                    
                    {uploadingImage && (
                      <div className="mt-2 text-green-400 text-sm">
                        ⏳ Uploading image...
                      </div>
                    )}
                    
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Or enter image URL directly:
                      </label>
                      <input
                        type="url"
                        value={formData.imageLayerUrl}
                        onChange={(e) => setFormData({ ...formData, imageLayerUrl: e.target.value })}
                        placeholder="https://example.com/trait-image.png"
                        className="block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-400">
                        Slot *
                      </label>
                      <select
                        required
                        value={formData.slotId}
                        onChange={(e) => setFormData({ ...formData, slotId: e.target.value })}
                        className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select Slot</option>
                        {slots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-green-400">
                        Rarity Tier *
                      </label>
                      <select
                        required
                        value={formData.rarityTierId}
                        onChange={(e) => setFormData({ ...formData, rarityTierId: e.target.value })}
                        className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select Rarity</option>
                        {rarityTiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-400">
                      Trait Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g., Blue Background, Red Hat, etc."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-400">
                        Total Supply
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.totalSupply}
                        onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
                        placeholder="Leave empty for unlimited"
                        className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-green-400">
                        Token *
                      </label>
                      <select
                        required
                        value={formData.priceTokenId}
                        onChange={(e) => setFormData({ ...formData, priceTokenId: e.target.value })}
                        className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select Token</option>
                        {tokens.map((token) => (
                          <option key={token.id} value={token.id}>
                            {token.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-400">
                      Price Amount * (in smallest unit)
                    </label>
                    <input
                      type="text"
                      required
                      pattern="[0-9]+"
                      value={formData.priceAmount}
                      onChange={(e) => setFormData({ ...formData, priceAmount: e.target.value })}
                      placeholder="e.g., 1000000000 for 1 SOL"
                      className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      💡 Enter amount in smallest unit (lamports for SOL, micro-units for tokens)
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="active"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-600 rounded bg-gray-800"
                    />
                    <label htmlFor="active" className="ml-2 block text-sm text-green-400">
                      ✅ Active (available for purchase)
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 border border-gray-600 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingImage}
                      className="px-6 py-2 bg-green-600 text-black rounded-md hover:bg-green-500 font-bold transition-colors disabled:opacity-50"
                    >
                      {uploadingImage ? '⏳ Uploading...' : (editingTrait ? '💾 Update' : '➕ Create')} Trait
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {showBulkUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border border-blue-500 w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-gray-900">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-blue-400 mb-4">
                  📁 Bulk Upload Traits
                </h3>
                
                <div className="mb-6 p-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
                  <p className="text-blue-300 text-sm mb-2">
                    <strong>File Naming Format:</strong> Use one of these formats for automatic parsing:
                  </p>
                  <ul className="text-blue-200 text-xs space-y-1 ml-4">
                    <li>• <code>TraitType/TraitValue.png</code> (e.g., "Clothes/Hoodie.png")</li>
                    <li>• <code>TraitType - TraitValue.png</code> (e.g., "Clothes - Hoodie.png")</li>
                    <li>• <code>TraitType_TraitValue.png</code> (e.g., "Clothes_Hoodie.png")</li>
                  </ul>
                </div>

                {/* File Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-blue-400 mb-2">
                    Select Trait Images
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleBulkFileUpload(e.target.files);
                      }
                    }}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select multiple PNG, JPG, or GIF files. Max 10MB each.
                  </p>
                </div>

                {/* Preview Grid */}
                {bulkPreview.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-blue-400 font-medium mb-3">Preview ({bulkPreview.length} files)</h4>
                    <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-blue-400">Image</th>
                            <th className="text-left p-2 text-blue-400">Trait Type</th>
                            <th className="text-left p-2 text-blue-400">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkPreview.map((item, index) => (
                            <tr key={index} className="border-t border-gray-700">
                              <td className="p-2">
                                <img 
                                  src={item.preview} 
                                  alt={item.value}
                                  className="w-12 h-12 object-cover rounded border border-gray-600"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.traitType}
                                  onChange={(e) => {
                                    const updated = [...bulkPreview];
                                    updated[index].traitType = e.target.value;
                                    setBulkPreview(updated);
                                  }}
                                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-blue-400 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.value}
                                  onChange={(e) => {
                                    const updated = [...bulkPreview];
                                    updated[index].value = e.target.value;
                                    setBulkPreview(updated);
                                  }}
                                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-blue-400 text-xs"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bulk Settings */}
                {bulkPreview.length > 0 && (
                  <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h4 className="text-blue-400 font-medium mb-3">Apply to All Traits</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Category
                        </label>
                        <select
                          value={bulkFormData.category}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, category: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Category</option>
                          {slots.map((slot) => (
                            <option key={slot.id} value={slot.name}>
                              {slot.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Token
                        </label>
                        <select
                          value={bulkFormData.priceTokenId}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, priceTokenId: e.target.value })}
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Token</option>
                          {tokens.map((token) => (
                            <option key={token.id} value={token.id}>
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Price (in smallest unit)
                        </label>
                        <input
                          type="text"
                          value={bulkFormData.priceAmount}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, priceAmount: e.target.value })}
                          placeholder="e.g., 10 for 10 SLDZ"
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Total Quantity (per trait)
                        </label>
                        <input
                          type="number"
                          value={bulkFormData.totalQuantity}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, totalQuantity: e.target.value })}
                          placeholder="e.g., 100"
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="bulkForSale"
                        checked={bulkFormData.forSale}
                        onChange={(e) => setBulkFormData({ ...bulkFormData, forSale: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
                      />
                      <label htmlFor="bulkForSale" className="ml-2 block text-sm text-blue-400">
                        Available for sale
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Artist Wallet (optional)
                        </label>
                        <input
                          type="text"
                          value={bulkFormData.artistWallet}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, artistWallet: e.target.value })}
                          placeholder="Wallet Address"
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-blue-400 mb-1">
                          Artist Commission % (optional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={bulkFormData.artistCommission}
                          onChange={(e) => setBulkFormData({ ...bulkFormData, artistCommission: e.target.value })}
                          placeholder="e.g., 5"
                          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                  <button
                    type="button"
                    onClick={resetBulkForm}
                    className="px-4 py-2 border border-gray-600 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={uploadingBulk || bulkPreview.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-bold transition-colors disabled:opacity-50"
                  >
                    {uploadingBulk ? '⏳ Uploading...' : `📁 Upload ${bulkPreview.length} Traits`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
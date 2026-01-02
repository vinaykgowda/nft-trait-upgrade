'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';
import LayerOrderManager from '@/components/admin/LayerOrderManager';
import TraitCategoryManager from '@/components/admin/TraitCategoryManager';
import { TraitUploadService, type TraitUploadFile, type BulkUploadSettings } from '@/lib/services/trait-upload';
import { ProjectTokensService } from '@/lib/services/project-tokens';
import { RarityService } from '@/lib/services/rarity';
import { ProjectToken } from '@/types';

interface Trait {
  id: string;
  slotId: string;
  slotName: string;
  name: string;
  imageLayerUrl: string;
  rarityTier?: {
    id: string;
    name: string;
    weight: number;
  };
  totalSupply?: number;
  remainingSupply?: number;
  priceAmount: string;
  priceToken?: {
    id: string;
    symbol: string;
    decimals: number;
    mintAddress?: string;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TraitSlot {
  id: string;
  name: string;
  layerOrder: number;
  required: boolean;
}

interface TraitCategory {
  id: string;
  name: string;
}

export default function TraitsManagerPage() {
  const [activeTab, setActiveTab] = useState<'layers' | 'categories' | 'traits' | 'bulk'>('layers');
  const [traits, setTraits] = useState<Trait[]>([]);
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [availableTokens, setAvailableTokens] = useState<ProjectToken[]>([]);
  const [categories, setCategories] = useState<TraitCategory[]>([]);
  const [actualRarities, setActualRarities] = useState<Array<{id: string, name: string, weight: number, displayOrder: number}>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [showOnSaleOnly, setShowOnSaleOnly] = useState(false);
  const [showAddTrait, setShowAddTrait] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreview, setBulkPreview] = useState<Array<{
    file: File;
    traitType: string;
    value: string;
    preview: string;
  }>>([]);

  const router = useRouter();

  // Single trait form
  const [traitForm, setTraitForm] = useState({
    category: 'Background', // Will be updated when categories load
    customName: false,
    traitValue: '',
    rarityTierId: '', // Will be set when rarities load
    priceToken: '', // Will be set when tokens load
    priceAmount: '0.005',
    totalQuantity: '10',
    requiredTraits: [] as string[],
    artistWallet: '',
    artistCommission: '0',
    forSale: true,
    imageFile: null as File | null,
    imagePreview: '',
  });

  // Bulk upload form
  const [bulkForm, setBulkForm] = useState({
    category: 'Background', // Will be updated when categories load
    rarityTierId: '', // Will be set when rarities load
    priceToken: '', // Will be set when tokens load
    priceAmount: '0.005',
    totalQuantity: '100',
    requiredTraits: [] as string[],
    artistWallet: '',
    artistCommission: '0',
    forSale: true,
  });

  // Edit trait state
  const [editingTrait, setEditingTrait] = useState<Trait | null>(null);
  const [showEditTrait, setShowEditTrait] = useState(false);

  useEffect(() => {
    fetchAvailableTokens();
    fetchTraits();
    fetchSlots();
    fetchActualRarities();
  }, []);

  // Update default rarities when actual rarities load
  useEffect(() => {
    if (actualRarities.length > 0) {
      const defaultRarity = actualRarities[0]; // First one (Common)
      console.log('🎯 Setting default rarity:', defaultRarity.name, defaultRarity.id);
      setTraitForm(prev => ({ ...prev, rarityTierId: defaultRarity.id }));
      setBulkForm(prev => ({ ...prev, rarityTierId: defaultRarity.id }));
      
      // CRITICAL: Fix any existing bulk preview items that might have empty rarityTierId
      setBulkPreview(prev => prev.map(item => {
        const currentRarity = (item as any).rarityTierId;
        if (!currentRarity || currentRarity === '' || currentRarity === 'undefined') {
          console.log(`🔧 Fixing undefined rarity for ${item.value}: ${currentRarity} -> ${defaultRarity.id}`);
          return {
            ...item,
            rarityTierId: defaultRarity.id
          };
        }
        return item;
      }));
    }
  }, [actualRarities]);

  // Update default tokens when available tokens load
  useEffect(() => {
    if (availableTokens.length > 0) {
      const defaultToken = availableTokens[0]; // First available token
      console.log('🎯 Setting default token:', defaultToken.tokenSymbol, defaultToken.tokenAddress);
      console.log('🎯 All available tokens:', availableTokens.map(t => `${t.tokenSymbol} (${t.tokenAddress})`));
      
      // Only set if not already set
      setTraitForm(prev => ({ 
        ...prev, 
        priceToken: prev.priceToken || defaultToken.tokenAddress 
      }));
      setBulkForm(prev => ({ 
        ...prev, 
        priceToken: prev.priceToken || defaultToken.tokenAddress 
      }));
    }
  }, [availableTokens]);

  const fetchActualRarities = async () => {
    try {
      const response = await fetch('/api/admin/rarities', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setActualRarities(data.rarities || []);
      }
    } catch (error) {
      console.error('Failed to fetch actual rarities:', error);
      // Fallback to RarityService
      setActualRarities(RarityService.getAllRarities());
    }
  };

  const fetchSlots = async () => {
    try {
      const response = await fetch('/api/admin/trait-slots', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Transform slots to categories format
        const slotsData = data.slots || [];
        setSlots(slotsData);
        
        // Convert slots to categories for the dropdown
        const categoriesData = slotsData.map((slot: any) => ({
          id: slot.id,
          name: slot.name
        }));
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
      // Fallback to default categories if API fails - using actual database slot IDs
      setCategories([
        { id: 'f66d1416-627a-4bfe-8a5d-3955c54cd7bb', name: 'Background' },
        { id: 'fec12edb-9d95-4bf2-a1af-ee71107ffbd6', name: 'Speciality' },
        { id: 'd70ef5d2-32ed-45b5-b3d6-f7332b3bc9e2', name: 'Fur' },
        { id: '5f718366-c5e1-4b6a-97ba-a1bb2d159c20', name: 'Clothes' },
        { id: 'beb44534-2c53-4472-bf15-0ac266f1082a', name: 'Hand' },
        { id: '5157637f-3808-4159-8cfc-4cb3dc6cc243', name: 'Mouth' },
        { id: 'fcd3a481-ce27-4dfb-a1f3-1598fc3f8d40', name: 'Mask' },
        { id: 'ad761fe9-e5fd-49c9-a627-5171898d1323', name: 'Headwear' },
        { id: '39438a80-00e1-4328-887d-409e99684502', name: 'Eyes' },
        { id: 'cf7b87d3-4be8-4ef0-b1e1-bd6f05e20d01', name: 'Eyewear' },
      ]);
    }
  };

  const fetchTraits = async () => {
    try {
      const response = await fetch('/api/admin/traits', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Use the properly structured data from the API
        setTraits(data.traits || []);
      }
    } catch (error) {
      console.error('Failed to fetch traits:', error);
      setTraits([]);
    }
  };

  const fetchAvailableTokens = async () => {
    try {
      console.log('🔍 Fetching available tokens...');
      const tokens = await ProjectTokensService.getAllAvailableTokens();
      console.log('🔍 Raw tokens from service:', tokens);
      
      // Always include SOL as default
      const solToken = ProjectTokensService.getDefaultSOLToken();
      const uniqueTokens = [solToken, ...tokens.filter(t => t.tokenAddress !== solToken.tokenAddress)];
      
      console.log('🔍 Final available tokens:', uniqueTokens.map(t => ({ 
        id: t.id, 
        symbol: t.tokenSymbol, 
        address: t.tokenAddress 
      })));
      
      setAvailableTokens(uniqueTokens);
    } catch (error) {
      console.error('Failed to fetch available tokens:', error);
      // Fallback to SOL only
      setAvailableTokens([ProjectTokensService.getDefaultSOLToken()]);
    }
  };

  const handleImageUpload = (file: File, isBulk = false) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (isBulk) {
        // Handle bulk upload preview
      } else {
        // Extract filename without extension for trait value
        const fileName = file.name;
        const traitValue = fileName.replace(/\.[^/.]+$/, ""); // Remove file extension
        
        setTraitForm({
          ...traitForm,
          imageFile: file,
          imagePreview: preview,
          traitValue: traitValue, // Auto-fill trait value from filename
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBulkFileUpload = async (files: FileList) => {
    // CRITICAL: Ensure rarities are loaded before processing files
    if (actualRarities.length === 0) {
      setError('Please wait for rarities to load before uploading files');
      return;
    }

    try {
      const processed = await TraitUploadService.processFiles(files, bulkForm.category);
      setBulkFiles(Array.from(files));
      
      // Use the first rarity (Common) as default for all files
      const defaultRarityId = actualRarities[0].id;
      
      // Add default rarityTierId to each processed item
      const processedWithRarity = processed.map(item => ({
        ...item,
        rarityTierId: defaultRarityId // Use actual database rarity ID
      }));
      
      setBulkPreview(processedWithRarity as any);
    } catch (error) {
      setError('Failed to process files');
      console.error(error);
    }
  };

  const handleAddTrait = async () => {
    if (!traitForm.imageFile || !traitForm.traitValue) {
      setError('Please provide an image and trait value');
      return;
    }

    setLoading(true);
    try {
      // Store the display amount directly, not converted to raw amount
      const displayAmount = traitForm.priceAmount;
      
      // Get selected token info for UUID
      const selectedToken = availableTokens.find(t => 
        t.tokenAddress === traitForm.priceToken || 
        t.id === traitForm.priceToken
      );
      
      if (!selectedToken) {
        setError(`Selected token not found. Available tokens: ${availableTokens.map(t => t.tokenSymbol).join(', ')}. Please refresh the page and try again.`);
        setLoading(false);
        return;
      }
      
      const tokenId = selectedToken.id; // Use token UUID

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', traitForm.imageFile);
      formData.append('name', traitForm.traitValue);
      formData.append('traitValue', traitForm.traitValue);
      formData.append('category', traitForm.category);
      formData.append('rarityTierId', traitForm.rarityTierId);
      formData.append('priceAmount', displayAmount);
      formData.append('priceTokenId', tokenId); // Use token UUID instead of address
      formData.append('totalSupply', traitForm.totalQuantity);
      formData.append('active', traitForm.forSale.toString());
      
      if (traitForm.artistWallet) {
        formData.append('artistWallet', traitForm.artistWallet);
      }
      if (traitForm.artistCommission) {
        formData.append('artistCommission', traitForm.artistCommission);
      }

      const response = await fetch('/api/admin/traits', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add trait');
      }

      // Reset form
      setTraitForm({
        category: categories.length > 0 ? categories[0].name : 'Background',
        customName: false,
        traitValue: '',
        rarityTierId: actualRarities.length > 0 ? actualRarities[0].id : '',
        priceToken: availableTokens.length > 0 ? availableTokens[0].tokenAddress : '',
        priceAmount: '0.005',
        totalQuantity: '10',
        requiredTraits: [],
        artistWallet: '',
        artistCommission: '0',
        forSale: true,
        imageFile: null,
        imagePreview: '',
      });
      setShowAddTrait(false);
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add trait');
    } finally {
      setLoading(false);
    }
  };

  const handleEditTrait = (trait: Trait) => {
    setEditingTrait(trait);
    setTraitForm({
      category: trait.slotName,
      customName: false,
      traitValue: trait.name,
      rarityTierId: trait.rarityTier?.id || (actualRarities.length > 0 ? actualRarities[0].id : ''),
      priceToken: trait.priceToken?.mintAddress || (availableTokens.length > 0 ? availableTokens[0].tokenAddress : ''),
      priceAmount: trait.priceAmount, // Already a string, no conversion needed
      totalQuantity: trait.totalSupply?.toString() || '10',
      requiredTraits: [],
      artistWallet: '',
      artistCommission: '0',
      forSale: trait.active,
      imageFile: null,
      imagePreview: trait.imageLayerUrl,
    });
    setShowEditTrait(true);
  };

  const handleUpdateTrait = async () => {
    if (!editingTrait || !traitForm.traitValue) {
      setError('Please provide a trait value');
      return;
    }

    setLoading(true);
    try {
      // Store the display amount directly, not converted to raw amount
      const displayAmount = traitForm.priceAmount;
      
      // Get selected token info for UUID
      const selectedToken = availableTokens.find(t => 
        t.tokenAddress === traitForm.priceToken || 
        t.id === traitForm.priceToken
      );
      
      if (!selectedToken) {
        setError(`Selected token not found. Available tokens: ${availableTokens.map(t => t.tokenSymbol).join(', ')}. Please refresh the page and try again.`);
        setLoading(false);
        return;
      }
      
      const tokenId = selectedToken.id; // Use token UUID

      // Create FormData for file upload
      const formData = new FormData();
      if (traitForm.imageFile) {
        formData.append('image', traitForm.imageFile);
      }
      formData.append('name', traitForm.traitValue);
      formData.append('traitValue', traitForm.traitValue);
      formData.append('category', traitForm.category);
      formData.append('rarityTierId', traitForm.rarityTierId);
      formData.append('priceAmount', displayAmount);
      formData.append('priceTokenId', tokenId); // Use token UUID instead of address
      formData.append('totalSupply', traitForm.totalQuantity);
      formData.append('active', traitForm.forSale.toString());

      const response = await fetch(`/api/admin/traits/${editingTrait.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update trait');
      }

      // Reset form
      setEditingTrait(null);
      setShowEditTrait(false);
      setTraitForm({
        category: categories.length > 0 ? categories[0].name : 'Background',
        customName: false,
        traitValue: '',
        rarityTierId: actualRarities.length > 0 ? actualRarities[0].id : '',
        priceToken: availableTokens.length > 0 ? availableTokens[0].tokenAddress : '',
        priceAmount: '0.005',
        totalQuantity: '10',
        requiredTraits: [],
        artistWallet: '',
        artistCommission: '0',
        forSale: true,
        imageFile: null,
        imagePreview: '',
      });
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trait');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrait = async (traitId: string) => {
    if (!confirm('Are you sure you want to delete this trait? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/traits/${traitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete trait');
      }

      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trait');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkPreview.length === 0) {
      setError('Please select files to upload');
      return;
    }

    // Validate that all traits have rarity settings
    const traitsWithoutRarity = bulkPreview.filter(trait => !(trait as any).rarityTierId);
    if (traitsWithoutRarity.length > 0) {
      setError(`${traitsWithoutRarity.length} traits are missing rarity settings. Please set rarity for all traits.`);
      return;
    }

    setLoading(true);
    setError(''); // Clear any previous errors
    
    // Show summary of what will be uploaded
    const raritySummary = bulkPreview.reduce((acc, trait) => {
      const rarityName = RarityService.getRarityById((trait as any).rarityTierId)?.name || 'Unknown';
      acc[rarityName] = (acc[rarityName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const summaryText = Object.entries(raritySummary)
      .map(([rarity, count]) => `${count} ${rarity}`)
      .join(', ');
    
    const confirmUpload = confirm(
      `🎯 Bulk Upload Summary\n\n` +
      `You are about to upload:\n${summaryText}\n\n` +
      `Images will be organized in folders by rarity.\n` +
      `Continue with upload?`
    );
    
    if (!confirmUpload) {
      setLoading(false);
      return;
    }
    
    try {
      // Prepare mapping objects
      const slotMapping: Record<string, string> = {};
      categories.forEach(cat => {
        slotMapping[cat.name] = cat.id;
      });

      const rarityTierMapping = {
        'Common': '1',
        'Rare': '2',
        'Epic': '3',
        'Legendary': '4',
      };

      // Get selected token info
      console.log('🔍 Looking for token:', bulkForm.priceToken);
      console.log('🔍 Available tokens:', availableTokens.map(t => ({ 
        id: t.id, 
        symbol: t.tokenSymbol, 
        address: t.tokenAddress 
      })));
      
      const selectedToken = availableTokens.find(t => 
        t.tokenAddress === bulkForm.priceToken || 
        t.id === bulkForm.priceToken
      );
      
      if (!selectedToken) {
        setError(`Selected token not found. Available: ${availableTokens.map(t => t.tokenSymbol).join(', ')}. Please refresh the page and try again.`);
        return;
      }
      
      console.log('✅ Found selected token:', selectedToken);
      
      // Keep the display amount, don't convert to raw amount
      const displayAmount = bulkForm.priceAmount;

      // Upload images first via API and get their URLs
      const uploadPromises = bulkPreview.map(async (trait, index) => {
        try {
          // Get rarity name for this specific trait
          const traitRarityId = (trait as any).rarityTierId;
          
          if (!traitRarityId) {
            console.error(`Trait ${trait.value} has no rarityTierId!`, trait);
            console.error('Available rarities:', actualRarities);
            console.error('BulkForm rarityTierId:', bulkForm.rarityTierId);
            throw new Error(`Trait ${trait.value} is missing rarity information`);
          }
          
          // Validate that the rarity ID exists in our actual rarities
          const rarityExists = actualRarities.find(r => r.id === traitRarityId);
          if (!rarityExists) {
            console.error(`Rarity ID ${traitRarityId} not found in actual rarities:`, actualRarities);
            throw new Error(`Invalid rarity ID: ${traitRarityId}`);
          }
          
          const rarityName = rarityExists.name.toLowerCase();
          
          // Create FormData for this image
          const formData = new FormData();
          formData.append('image', trait.file);
          formData.append('category', bulkForm.category.toLowerCase());
          formData.append('rarity', rarityName); // Use the individual trait's rarity
          formData.append('filename', trait.file.name);
          
          // Upload via API
          const uploadResponse = await fetch('/api/admin/traits/upload-image', {
            method: 'POST',
            credentials: 'include',
            body: formData
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
          }
          
          const uploadResult = await uploadResponse.json();
          const imageUrl = uploadResult.imageUrl;
          
          return { ...trait, imageUrl, rarityTierId: traitRarityId };
        } catch (error) {
          console.error('Failed to upload image:', trait.file.name, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to upload image: ${trait.file.name} - ${errorMessage}`);
        }
      });

      const uploadedTraits = await Promise.all(uploadPromises);

      // Prepare trait data with uploaded image URLs
      const traitData = uploadedTraits.map(trait => {
        const data = {
          name: trait.value,
          traitType: trait.traitType,
          value: trait.value,
          imageUrl: trait.imageUrl, // Use the uploaded URL
          category: bulkForm.category,
          priceAmount: displayAmount, // Use display amount, not raw amount
          priceTokenId: selectedToken.id, // Use token UUID
          totalSupply: Math.max(parseInt(bulkForm.totalQuantity) || 1, 1), // Ensure positive number, minimum 1
          active: bulkForm.forSale,
          rarityTierId: trait.rarityTierId, // Use individual rarity
        };
        
        return data;
      });

      // Validate data
      const { valid, invalid } = TraitUploadService.validateTraitData(traitData);
      
      if (invalid.length > 0) {
        setError(`${invalid.length} traits have validation errors. Please check your data.`);
        console.error('Validation errors:', invalid);
        return;
      }

      // Convert to API format
      const apiData = {
        traits: valid.map(trait => {
          // CRITICAL: Validate rarityTierId exists and is valid
          if (!trait.rarityTierId) {
            throw new Error(`Trait ${trait.name} is missing rarity selection`);
          }
          
          // Verify the rarity exists in our database rarities
          const rarityExists = actualRarities.find(r => r.id === trait.rarityTierId);
          if (!rarityExists) {
            throw new Error(`Trait ${trait.name} has invalid rarity ID: ${trait.rarityTierId}`);
          }
          
          return {
            slotId: slotMapping[trait.category] || slotMapping[Object.keys(slotMapping)[0]],
            name: trait.name,
            imageLayerUrl: trait.imageUrl,
            rarityTierId: trait.rarityTierId,
            totalSupply: trait.totalSupply,
            priceAmount: trait.priceAmount,
            priceTokenId: trait.priceTokenId,
            active: trait.active,
          };
        }),
        bulkSettings: {
          category: bulkForm.category,
          artistWallet: bulkForm.artistWallet,
          artistCommission: bulkForm.artistCommission ? parseFloat(bulkForm.artistCommission) : undefined,
        }
      };

      console.log('🚀 FINAL API DATA CHECK:', {
        totalTraits: apiData.traits.length,
        rarityIds: apiData.traits.map(t => ({ 
          name: t.name, 
          rarityTierId: t.rarityTierId,
          rarityType: typeof t.rarityTierId,
          isUndefined: t.rarityTierId === undefined,
          isNull: t.rarityTierId === null,
          isEmpty: t.rarityTierId === ''
        }))
      });

      // CRITICAL: Block the request if ANY trait has undefined rarity
      const invalidTraits = apiData.traits.filter(t => !t.rarityTierId || t.rarityTierId === 'undefined');
      if (invalidTraits.length > 0) {
        console.error('❌ BLOCKING REQUEST - Invalid rarities found:', invalidTraits);
        throw new Error(`${invalidTraits.length} traits have invalid rarity selections. Please check all dropdowns.`);
      }

      const response = await fetch('/api/admin/traits/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle API errors properly
        console.error('Bulk upload API error:', result);
        if (result.error) {
          throw new Error(result.error);
        } else if (result.details) {
          // Zod validation errors
          const errorMessages = result.details.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
          throw new Error(`Validation errors: ${errorMessages}`);
        } else {
          throw new Error('Failed to upload traits');
        }
      }
      
      // Show success message
      const successCount = result.created?.length || 0;
      const errorCount = result.errors?.length || 0;
      
      if (errorCount > 0) {
        setError(`Upload completed with ${errorCount} errors. ${successCount} traits uploaded successfully. Check console for details.`);
        console.error('Upload errors:', result.errors);
      } else {
        setError(''); // Clear any previous errors
        alert(`Successfully uploaded ${successCount} traits!`);
      }
      
      // Reset form and refresh data
      setBulkFiles([]);
      setBulkPreview([]);
      setShowBulkUpload(false);
      fetchTraits(); // Refresh the traits list
      setBulkForm({
        category: categories.length > 0 ? categories[0].name : 'Background',
        rarityTierId: actualRarities.length > 0 ? actualRarities[0].id : '',
        priceToken: availableTokens.length > 0 ? availableTokens[0].tokenAddress : '',
        priceAmount: '0.005',
        totalQuantity: '100',
        requiredTraits: [],
        artistWallet: '',
        artistCommission: '0',
        forSale: true,
      });
      setShowBulkUpload(false);
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload traits');
    } finally {
      setLoading(false);
    }
  };

  const handleNuclearFix = async () => {
    const confirm = window.confirm(
      '🔥 NUCLEAR RARITY FIX 🔥\n\n' +
      'This will:\n' +
      '1. DELETE all existing rarity data\n' +
      '2. INSERT correct rarity tiers\n' +
      '3. SET all traits to Common (you can change after)\n' +
      '4. FIX the "Unknown" issue permanently\n\n' +
      'CLICK OK TO NUKE THE RARITY PROBLEM!'
    );
    
    if (!confirm) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/fix-rarities-now', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fix rarities');
      }

      const result = await response.json();
      
      alert(
        `🔥 NUCLEAR FIX COMPLETE! 🔥\n\n` +
        `✅ Fixed ${result.results.traitsWithRarity}/${result.results.totalTraits} traits\n` +
        `✅ No more "Unknown" rarities!\n` +
        `✅ All traits now show "Common"\n\n` +
        `You can now edit individual traits to set correct rarities.`
      );
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fix rarities');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRarityFix = async () => {
    const traitNames = traits.map(t => t.name).join('\n');
    
    const input = prompt(
      `🎯 Quick Rarity Fix\n\n` +
      `Current traits:\n${traitNames}\n\n` +
      `Enter trait names that should be UNCOMMON (comma-separated):\n` +
      `Example: Beach2, Ocean, Sunset, Forest, Mountain\n\n` +
      `Leave empty if all should stay Common:`
    );
    
    if (input === null) return; // User cancelled
    
    const uncommonNames = input.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    if (uncommonNames.length === 0) {
      alert('No traits specified for Uncommon rarity.');
      return;
    }
    
    const confirm = window.confirm(
      `Set these traits to UNCOMMON:\n${uncommonNames.join(', ')}\n\n` +
      `All other traits will remain COMMON. Continue?`
    );
    
    if (!confirm) return;

    setLoading(true);
    try {
      // Get uncommon rarity ID
      const uncommonRarityId = '550e8400-e29b-41d4-a716-446655440002';
      
      // Prepare updates for traits that should be uncommon
      const updates = traits
        .filter(trait => uncommonNames.some(name => 
          trait.name.toLowerCase().includes(name.toLowerCase()) || 
          name.toLowerCase().includes(trait.name.toLowerCase())
        ))
        .map(trait => ({
          traitId: trait.id,
          rarityTierId: uncommonRarityId
        }));
      
      if (updates.length === 0) {
        alert('No matching traits found. Check the names and try again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/admin/traits/bulk-rarity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ updates })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update rarities');
      }

      const result = await response.json();
      
      alert(
        `✅ Rarity Update Complete!\n\n` +
        `Updated ${result.updatedCount} traits to UNCOMMON:\n` +
        `${updates.map(u => traits.find(t => t.id === u.traitId)?.name).join(', ')}`
      );
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rarities');
    } finally {
      setLoading(false);
    }
  };

  const handleRepairDatabase = async () => {
    const confirm = window.confirm(
      '🔧 Database Repair\n\n' +
      'This will fix missing rarity and token relationships.\n' +
      'All traits will be set to "Common" rarity (you can change them individually after).\n\n' +
      'Continue?'
    );
    
    if (!confirm) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/repair-database', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to repair database');
      }

      const result = await response.json();
      
      alert(
        `✅ Database Repair Complete!\n\n` +
        `• Fixed ${result.results.raritiesFixed} rarity tiers\n` +
        `• Updated ${result.results.traitsUpdated} traits\n` +
        `• Fixed ${result.results.tokensUpdated} token relationships\n\n` +
        `All traits now show proper rarity information!`
      );
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to repair database');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllTraits = async () => {
    // First confirmation with count
    const traitCount = traits.length;
    if (traitCount === 0) {
      alert('No traits to delete.');
      return;
    }

    const firstConfirm = confirm(
      `⚠️ WARNING: This will permanently delete ALL ${traitCount} traits and their images!\n\n` +
      `This action cannot be undone. Are you sure you want to continue?`
    );
    
    if (!firstConfirm) {
      return;
    }

    // Second confirmation with typing requirement
    const confirmMessage = 
      `🚨 FINAL WARNING 🚨\n\n` +
      `You are about to delete:\n` +
      `• ${traitCount} traits from the database\n` +
      `• All associated image files\n\n` +
      `This action is IRREVERSIBLE!\n\n` +
      `Type "DELETE ALL TRAITS" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'DELETE ALL TRAITS') {
      if (confirmation !== null) {
        alert('Deletion cancelled. You must type "DELETE ALL TRAITS" exactly to confirm.');
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/traits/bulk-delete', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete all traits');
      }

      const result = await response.json();
      
      // Show success message
      alert(
        `✅ Deletion Complete!\n\n` +
        `Successfully deleted:\n` +
        `• ${result.deletedCount} traits from database\n` +
        `• ${result.deletedImages} image files from storage`
      );
      
      // Refresh traits list
      await fetchTraits();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete all traits');
    } finally {
      setLoading(false);
    }
  };

  const filteredTraits = traits.filter(trait => {
    const categoryMatch = selectedCategory === 'All' || trait.slotName === selectedCategory;
    const saleMatch = !showOnSaleOnly || trait.active;
    return categoryMatch && saleMatch;
  });

  const sortedTraits = [...filteredTraits].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'category':
        return a.slotName.localeCompare(b.slotName);
      case 'price':
        return parseFloat(a.priceAmount) - parseFloat(b.priceAmount);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-400">🎨 Comprehensive Trait Manager</h1>
          <p className="mt-2 text-gray-400">
            Manage layer order, categories, individual traits, and bulk uploads
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded">
            ⚠️ {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-700">
          <nav className="flex space-x-8">
            {[
              { id: 'layers', label: '📋 Layer Order', icon: '📋' },
              { id: 'categories', label: '🏷️ Categories', icon: '🏷️' },
              { id: 'traits', label: '🎨 Manage Traits', icon: '🎨' },
              { id: 'bulk', label: '📁 Bulk Upload', icon: '📁' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'layers' && (
          <LayerOrderManager onSlotsChange={setSlots} />
        )}

        {activeTab === 'categories' && (
          <TraitCategoryManager 
            categories={categories}
            onCategoriesChange={setCategories}
          />
        )}

        {activeTab === 'traits' && (
          <div className="space-y-6">
            {/* Trait Management Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                >
                  <option value="All">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                >
                  <option value="name">Sort by Name</option>
                  <option value="category">Sort by Category</option>
                  <option value="price">Sort by Price</option>
                </select>

                <label className="flex items-center space-x-2 text-green-400">
                  <input
                    type="checkbox"
                    checked={showOnSaleOnly}
                    onChange={(e) => setShowOnSaleOnly(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm">On Sale Only</span>
                </label>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAddTrait(true)}
                  className="bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-bold transition-colors"
                >
                  ➕ Add New Trait
                </button>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500 font-bold transition-colors">
                  📁 Add Folder of New Traits (Bulk)
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/debug-rarity');
                    const data = await response.json();
                    alert('Check browser console for database debug info');
                  } catch (error) {
                    alert('Failed to fetch debug info');
                  }
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-500"
              >
                🔍 Debug DB
              </button>
              <button 
                onClick={async () => {
                  if (confirm('🔧 Repair Upload\n\nThis will create traits from existing images in the uploads folder.\nContinue?')) {
                    setLoading(true);
                    try {
                      const response = await fetch('/api/admin/repair-upload', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      const result = await response.json();
                      if (response.ok) {
                        alert(`✅ ${result.message}`);
                        fetchTraits(); // Refresh traits list
                      } else {
                        alert(`❌ ${result.error}`);
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      alert(`❌ Failed to repair upload: ${errorMessage}`);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={loading}
                className="bg-green-700 text-green-300 px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {loading ? '🔧 Repairing...' : '🔧 Repair Upload'}
              </button>
              <button 
                onClick={handleDeleteAllTraits}
                disabled={loading || traits.length === 0}
                className="bg-red-700 text-red-300 px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {loading ? '🗑️ Deleting...' : `Delete All Traits (${traits.length})`}
              </button>
            </div>

            {/* Filter Status */}
            <div className="flex justify-between items-center text-sm text-gray-400">
              <div>
                Showing {sortedTraits.length} of {traits.length} traits
                {showOnSaleOnly && <span className="text-green-400 ml-2">(On Sale Only)</span>}
                {selectedCategory !== 'All' && <span className="text-blue-400 ml-2">({selectedCategory})</span>}
              </div>
              {(showOnSaleOnly || selectedCategory !== 'All') && (
                <button
                  onClick={() => {
                    setShowOnSaleOnly(false);
                    setSelectedCategory('All');
                  }}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Traits Grid */}
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 min-h-96">
              {sortedTraits.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎨</div>
                  {traits.length === 0 ? (
                    <>
                      <p className="text-gray-400 text-lg">No traits found in database.</p>
                      <p className="text-gray-500 mb-4">Add your first trait to get started.</p>
                      <div className="bg-blue-900 border border-blue-600 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-blue-300 text-sm mb-2">💡 <strong>Quick Fix:</strong></p>
                        <p className="text-blue-200 text-xs">
                          If you uploaded images but don't see traits here, click the "🔧 Repair Upload" button above to convert existing images into traits.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-400 text-lg">No traits match your current filters.</p>
                      <p className="text-gray-500 mb-4">
                        {showOnSaleOnly && selectedCategory !== 'All' 
                          ? `No traits on sale in "${selectedCategory}" category.`
                          : showOnSaleOnly 
                          ? 'No traits are currently on sale.'
                          : `No traits found in "${selectedCategory}" category.`
                        }
                      </p>
                      <button
                        onClick={() => {
                          setShowOnSaleOnly(false);
                          setSelectedCategory('All');
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500 transition-colors"
                      >
                        Clear Filters
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-9 gap-2">
                  {sortedTraits.map((trait) => (
                    <div key={trait.id} className="bg-gray-800 rounded-lg border border-gray-600 overflow-hidden hover:border-green-500 transition-colors">
                      <div className="aspect-square bg-gray-700 flex items-center justify-center">
                        {trait.imageLayerUrl ? (
                          <img
                            src={trait.imageLayerUrl}
                            alt={trait.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-gray-500 text-center">
                            <div className="text-2xl mb-1">🖼️</div>
                            <div className="text-xs">No Image</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-2">
                        <h4 className="text-green-400 font-medium text-sm mb-1">{trait.name}</h4>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-gray-400 text-xs">{trait.slotName}</p>
                          <span className={`px-2 py-1 text-xs rounded ${RarityService.getRarityBgColor(trait.rarityTier?.name || 'Common')} ${RarityService.getRarityColor(trait.rarityTier?.name || 'Common')}`}>
                            {trait.rarityTier?.name || 'Common'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-green-300 text-xs">{trait.priceAmount} {trait.priceToken?.symbol}</span>
                          <span className={`px-2 py-1 text-xs rounded ${
                            trait.active 
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-red-900 text-red-300'
                          }`}>
                            {trait.active ? '✅' : '❌'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-400 mb-3">
                          <span>Supply: {trait.remainingSupply}/{trait.totalSupply}</span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditTrait(trait)}
                            className="flex-1 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-500 transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTrait(trait.id)}
                            className="flex-1 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-blue-400 mb-4">
                📁 Bulk Upload Traits
              </h3>
              
              <div className="mb-6 p-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
                <p className="text-blue-300 text-sm mb-2">
                  <strong>IMPORTANT:</strong> Only upload one "Trait Type" at a time. The folder MUST be in this format: 
                  <code className="bg-gray-800 px-2 py-1 rounded ml-1">"(folder name: on chain trait type)/(file: on chain trait value).png"</code>
                </p>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-blue-400 mb-2">
                  Choose files (2 files selected in example)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={actualRarities.length === 0}
                  onChange={(e) => {
                    if (e.target.files) {
                      handleBulkFileUpload(e.target.files);
                    }
                  }}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {actualRarities.length === 0 && (
                  <p className="text-yellow-400 text-xs mt-1">⏳ Loading rarities from database...</p>
                )}
              </div>

              {/* Preview Table */}
              {bulkPreview.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-blue-400 font-medium">Selected Files (Set individual rarities):</h4>
                    <div className="flex items-center space-x-2">
                      <select
                        value={bulkForm.rarityTierId}
                        onChange={(e) => {
                          // Update all traits to this rarity
                          const updatedPreview = bulkPreview.map(item => ({
                            ...item,
                            rarityTierId: e.target.value
                          }));
                          setBulkPreview(updatedPreview as any);
                          setBulkForm({ ...bulkForm, rarityTierId: e.target.value });
                        }}
                        className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-blue-400 text-xs"
                      >
                        {actualRarities.map(rarity => (
                          <option key={rarity.id} value={rarity.id}>
                            {rarity.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedPreview = bulkPreview.map(item => ({
                            ...item,
                            rarityTierId: bulkForm.rarityTierId
                          }));
                          setBulkPreview(updatedPreview as any);
                        }}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-500"
                      >
                        Set All to {actualRarities.find(r => r.id === bulkForm.rarityTierId)?.name}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="text-left p-3 text-blue-400">Image</th>
                          <th className="text-left p-3 text-blue-400">Trait Type</th>
                          <th className="text-left p-3 text-blue-400">Value</th>
                          <th className="text-left p-3 text-blue-400">Rarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((item, index) => (
                          <tr key={index} className="border-t border-gray-700">
                            <td className="p-3">
                              <img 
                                src={item.preview} 
                                alt={item.value}
                                className="w-12 h-12 object-cover rounded border border-gray-600"
                              />
                            </td>
                            <td className="p-3 text-blue-400">{item.traitType}</td>
                            <td className="p-3 text-blue-400">{item.value}</td>
                            <td className="p-3">
                              <select
                                value={(item as any).rarityTierId || (actualRarities.length > 0 ? actualRarities[0].id : '')}
                                onChange={(e) => {
                                  console.log(`🎯 Changing rarity for ${item.value} from ${(item as any).rarityTierId} to ${e.target.value}`);
                                  const updatedPreview = [...bulkPreview];
                                  (updatedPreview[index] as any).rarityTierId = e.target.value;
                                  setBulkPreview(updatedPreview);
                                }}
                                className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs ${
                                  RarityService.getRarityColor(actualRarities.find(r => r.id === ((item as any).rarityTierId || (actualRarities.length > 0 ? actualRarities[0].id : '')))?.name || 'Common')
                                }`}
                              >
                                {actualRarities.map(rarity => (
                                  <option key={rarity.id} value={rarity.id}>
                                    {rarity.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bulk Settings Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Category
                  </label>
                  <select
                    value={bulkForm.category}
                    onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Rarity Tier
                  </label>
                  <select
                    value={bulkForm.rarityTierId}
                    onChange={(e) => setBulkForm({ ...bulkForm, rarityTierId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                  >
                    {actualRarities.map(rarity => (
                      <option key={rarity.id} value={rarity.id}>
                        {rarity.name} ({rarity.weight}% drop rate)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="bulkForSale"
                    checked={bulkForm.forSale}
                    onChange={(e) => setBulkForm({ ...bulkForm, forSale: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
                  />
                  <label htmlFor="bulkForSale" className="ml-2 block text-sm text-blue-400">
                    Is item currently for sale?
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Payment Token
                  </label>
                  <select
                    value={bulkForm.priceToken}
                    onChange={(e) => setBulkForm({ ...bulkForm, priceToken: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                  >
                    {availableTokens.map(token => (
                      <option key={token.tokenAddress} value={token.tokenAddress}>
                        {token.tokenSymbol} - {token.tokenName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Price Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={bulkForm.priceAmount}
                    onChange={(e) => setBulkForm({ ...bulkForm, priceAmount: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                    placeholder="e.g., 0.005 for SOL"
                  />
                  {availableTokens.find(t => t.tokenAddress === bulkForm.priceToken) && (
                    <p className="text-xs text-gray-400 mt-1">
                      Token: {availableTokens.find(t => t.tokenAddress === bulkForm.priceToken)?.tokenSymbol} 
                      (Decimals: {availableTokens.find(t => t.tokenAddress === bulkForm.priceToken)?.decimals})
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-blue-400 mb-1">
                  Total Quantity
                </label>
                <input
                  type="number"
                  value={bulkForm.totalQuantity}
                  onChange={(e) => setBulkForm({ ...bulkForm, totalQuantity: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Artist Commission (optional) - Wallet Address
                  </label>
                  <input
                    type="text"
                    value={bulkForm.artistWallet}
                    onChange={(e) => setBulkForm({ ...bulkForm, artistWallet: e.target.value })}
                    placeholder="Wallet Address"
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-400 mb-1">
                    Percent should be set in number form. Example: 1% should be inputted as 1. (Max 50%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={bulkForm.artistCommission}
                    onChange={(e) => setBulkForm({ ...bulkForm, artistCommission: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleBulkUpload}
                  disabled={loading || bulkPreview.length === 0}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-500 font-bold transition-colors disabled:opacity-50"
                >
                  {loading ? '⏳ Uploading...' : '📁 Add Traits'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Single Trait Modal */}
        {showAddTrait && (
          <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border border-green-500 w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-gray-900">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-green-400 mb-4">
                  ➕ Add New Trait
                </h3>
                
                <div className="space-y-4">
                  {/* Image Upload */}
                  <div className="text-center">
                    <label className="block text-sm font-medium text-green-400 mb-2">
                      Trait Image
                    </label>
                    
                    <div className="w-32 h-32 mx-auto bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center mb-4">
                      {traitForm.imagePreview ? (
                        <img 
                          src={traitForm.imagePreview} 
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-gray-500 text-center">
                          <div className="text-2xl mb-1">🖼️</div>
                          <div className="text-xs">*3mb size limit</div>
                        </div>
                      )}
                    </div>
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-black hover:file:bg-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-400 mb-1">
                      Category
                    </label>
                    <select
                      value={traitForm.category}
                      onChange={(e) => setTraitForm({ ...traitForm, category: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-400 mb-1">
                      Rarity Tier
                    </label>
                    <select
                      value={traitForm.rarityTierId}
                      onChange={(e) => setTraitForm({ ...traitForm, rarityTierId: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                    >
                      {actualRarities.map(rarity => (
                        <option key={rarity.id} value={rarity.id}>
                          {rarity.name} ({rarity.weight}% drop rate)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="customName"
                      checked={traitForm.customName}
                      onChange={(e) => setTraitForm({ ...traitForm, customName: e.target.checked })}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-600 rounded bg-gray-800"
                    />
                    <label htmlFor="customName" className="ml-2 block text-sm text-green-400">
                      Use a custom name for the store? (Default: Trait Value)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-400 mb-1">
                        Trait Value (auto-filled from filename)
                      </label>
                      <input
                        type="text"
                        value={traitForm.traitValue}
                        onChange={(e) => setTraitForm({ ...traitForm, traitValue: e.target.value })}
                        placeholder="Hoodie"
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-400 mb-1">
                        Payment Token
                      </label>
                      <select
                        value={traitForm.priceToken}
                        onChange={(e) => setTraitForm({ ...traitForm, priceToken: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                      >
                        {availableTokens.map(token => (
                          <option key={token.tokenAddress} value={token.tokenAddress}>
                            {token.tokenSymbol} - {token.tokenName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-green-400 mb-1">
                        Price Amount
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={traitForm.priceAmount}
                        onChange={(e) => setTraitForm({ ...traitForm, priceAmount: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                        placeholder="e.g., 0.005 for SOL"
                      />
                      {availableTokens.find(t => t.tokenAddress === traitForm.priceToken) && (
                        <p className="text-xs text-gray-400 mt-1">
                          Token: {availableTokens.find(t => t.tokenAddress === traitForm.priceToken)?.tokenSymbol} 
                          (Decimals: {availableTokens.find(t => t.tokenAddress === traitForm.priceToken)?.decimals})
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-green-400 mb-1">
                      Total Quantity
                    </label>
                    <input
                      type="number"
                      value={traitForm.totalQuantity}
                      onChange={(e) => setTraitForm({ ...traitForm, totalQuantity: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-400 mb-1">
                        Artist Commission (optional) - Wallet Address
                      </label>
                      <input
                        type="text"
                        value={traitForm.artistWallet}
                        onChange={(e) => setTraitForm({ ...traitForm, artistWallet: e.target.value })}
                        placeholder="Wallet Address"
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-green-400 mb-1">
                        Percent (Max 50%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={traitForm.artistCommission}
                        onChange={(e) => setTraitForm({ ...traitForm, artistCommission: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="forSale"
                      checked={traitForm.forSale}
                      onChange={(e) => setTraitForm({ ...traitForm, forSale: e.target.checked })}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-600 rounded bg-gray-800"
                    />
                    <label htmlFor="forSale" className="ml-2 block text-sm text-green-400">
                      Is item currently for sale?
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddTrait(false)}
                    className="px-4 py-2 border border-gray-600 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTrait}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-black rounded-md hover:bg-green-500 font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? '⏳ Adding...' : '➕ Add Trait'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Trait Modal */}
        {showEditTrait && editingTrait && (
          <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border border-blue-500 w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-gray-900">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-blue-400 mb-4">
                  ✏️ Edit Trait: {editingTrait.name}
                </h3>
                
                <div className="space-y-4">
                  {/* Image Upload */}
                  <div className="text-center">
                    <label className="block text-sm font-medium text-blue-400 mb-2">
                      Trait Image (1500x1500px PNG recommended)
                    </label>
                    
                    <div className="w-32 h-32 mx-auto bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center mb-4">
                      {traitForm.imagePreview ? (
                        <img 
                          src={traitForm.imagePreview} 
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-gray-500 text-center">
                          <div className="text-2xl mb-1">🖼️</div>
                          <div className="text-xs">Current image</div>
                        </div>
                      )}
                    </div>
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Leave empty to keep current image</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-400 mb-1">
                      Category
                    </label>
                    <select
                      value={traitForm.category}
                      onChange={(e) => setTraitForm({ ...traitForm, category: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-400 mb-1">
                      Rarity Tier
                    </label>
                    <select
                      value={traitForm.rarityTierId}
                      onChange={(e) => setTraitForm({ ...traitForm, rarityTierId: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                    >
                      {actualRarities.map(rarity => (
                        <option key={rarity.id} value={rarity.id}>
                          {rarity.name} ({rarity.weight}% drop rate)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-400 mb-1">
                      Trait Value
                    </label>
                    <input
                      type="text"
                      value={traitForm.traitValue}
                      onChange={(e) => setTraitForm({ ...traitForm, traitValue: e.target.value })}
                      placeholder="Hoodie"
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-400 mb-1">
                        Payment Token
                      </label>
                      <select
                        value={traitForm.priceToken}
                        onChange={(e) => setTraitForm({ ...traitForm, priceToken: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                      >
                        {availableTokens.map(token => (
                          <option key={token.tokenAddress} value={token.tokenAddress}>
                            {token.tokenSymbol} - {token.tokenName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-400 mb-1">
                        Price Amount
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={traitForm.priceAmount}
                        onChange={(e) => setTraitForm({ ...traitForm, priceAmount: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                        placeholder="e.g., 0.005 for SOL"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-400 mb-1">
                      Total Quantity
                    </label>
                    <input
                      type="number"
                      value={traitForm.totalQuantity}
                      onChange={(e) => setTraitForm({ ...traitForm, totalQuantity: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-blue-400"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="editForSale"
                      checked={traitForm.forSale}
                      onChange={(e) => setTraitForm({ ...traitForm, forSale: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
                    />
                    <label htmlFor="editForSale" className="ml-2 block text-sm text-blue-400">
                      Is item currently for sale?
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTrait(false);
                      setEditingTrait(null);
                    }}
                    className="px-4 py-2 border border-gray-600 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateTrait}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? '⏳ Updating...' : '✏️ Update Trait'}
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
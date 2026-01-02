'use client';

import { useState, useEffect } from 'react';

interface TraitSlot {
  id: string;
  name: string;
  layerOrder: number;
  required: boolean;
}

interface LayerOrderManagerProps {
  onSlotsChange?: (slots: TraitSlot[]) => void;
}

export default function LayerOrderManager({ onSlotsChange }: LayerOrderManagerProps) {
  const [slots, setSlots] = useState<TraitSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSlotName, setNewSlotName] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  useEffect(() => {
    onSlotsChange?.(slots);
  }, [slots, onSlotsChange]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/trait-slots', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const slotsData = (data.slots || []).map((slot: any) => ({
          id: slot.id,
          name: slot.name,
          layerOrder: slot.layerOrder,
          required: slot.required || true
        }));
        setSlots(slotsData);
        setError(null);
      } else {
        throw new Error('Failed to fetch slots');
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, slotId: string) => {
    setDraggedItem(slotId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetSlotId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetSlotId) return;

    const draggedIndex = slots.findIndex(slot => slot.id === draggedItem);
    const targetIndex = slots.findIndex(slot => slot.id === targetSlotId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSlots = [...slots];
    const [draggedSlot] = newSlots.splice(draggedIndex, 1);
    newSlots.splice(targetIndex, 0, draggedSlot);

    // Update layer orders
    const updatedSlots = newSlots.map((slot, index) => ({
      ...slot,
      layerOrder: index + 1
    }));

    setSlots(updatedSlots);
    setDraggedItem(null);

    // Save to database
    try {
      const response = await fetch('/api/admin/trait-slots', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          slots: updatedSlots.map(slot => ({
            id: slot.id,
            layerOrder: slot.layerOrder
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update layer order');
      }
    } catch (err) {
      console.error('Failed to save layer order:', err);
      // Revert on error
      await fetchSlots();
    }
  };

  const addNewSlot = async () => {
    if (!newSlotName.trim()) return;

    try {
      const response = await fetch('/api/admin/trait-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newSlotName.trim(),
          layerOrder: slots.length + 1,
          required: false
        })
      });

      if (response.ok) {
        await fetchSlots(); // Refresh the list
        setNewSlotName('');
      } else {
        const errorData = await response.json();
        alert(`Failed to add slot: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Failed to add slot:', err);
      alert('Failed to add slot');
    }
  };

  const removeSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this layer? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/trait-slots?id=${slotId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        await fetchSlots(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(`Failed to remove slot: ${errorData.error}`);
      }
    } catch (err) {
      console.error('Failed to remove slot:', err);
      alert('Failed to remove slot');
    }
  };

  const toggleRequired = (slotId: string) => {
    setSlots(slots.map(slot => 
      slot.id === slotId 
        ? { ...slot, required: !slot.required }
        : slot
    ));
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-medium text-green-400 mb-4">
          🎨 Layer Order Management
        </h3>
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-400">Loading layers...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-medium text-green-400 mb-4">
          🎨 Layer Order Management
        </h3>
        <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
        <button
          onClick={fetchSlots}
          className="bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-bold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-medium text-green-400 mb-4">
        🎨 Layer Order Management
      </h3>
      
      <p className="text-gray-400 text-sm mb-6">
        Drag and drop to reorder layers. Lower layers appear behind higher layers in the final NFT.
      </p>

      {/* Layer List */}
      <div className="space-y-2 mb-6">
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            draggable
            onDragStart={(e) => handleDragStart(e, slot.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, slot.id)}
            className={`flex items-center justify-between p-3 bg-gray-800 border border-gray-600 rounded-lg cursor-move hover:border-green-500 transition-colors ${
              draggedItem === slot.id ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-black rounded-full text-sm font-bold">
                {slot.layerOrder}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-green-400 font-medium">{slot.name}</span>
                {slot.required && (
                  <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded-full border border-red-700">
                    Required
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => toggleRequired(slot.id)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  slot.required
                    ? 'bg-red-900 text-red-300 border border-red-700 hover:bg-red-800'
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                {slot.required ? '✕ Required' : '+ Optional'}
              </button>
              
              <button
                onClick={() => removeSlot(slot.id)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded transition-colors"
                title="Delete layer"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Layer */}
      <div className="flex space-x-2">
        <input
          type="text"
          value={newSlotName}
          onChange={(e) => setNewSlotName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addNewSlot()}
          placeholder="Enter new layer name..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
        />
        <button
          onClick={addNewSlot}
          disabled={!newSlotName.trim()}
          className="bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-bold transition-colors disabled:opacity-50"
        >
          ➕ Add Layer
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
        <p className="text-blue-300 text-sm">
          💡 <strong>Tip:</strong> The layer order determines how traits stack on top of each other. 
          Background should be layer 1, and accessories like hats should be higher numbers.
        </p>
      </div>
    </div>
  );
}
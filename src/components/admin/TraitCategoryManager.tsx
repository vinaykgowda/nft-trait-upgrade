'use client';

import { useState } from 'react';

interface TraitCategory {
  id: string;
  name: string;
  description?: string;
}

interface TraitCategoryManagerProps {
  categories: TraitCategory[];
  onCategoriesChange?: (categories: TraitCategory[]) => void;
}

export default function TraitCategoryManager({ 
  categories: initialCategories, 
  onCategoriesChange 
}: TraitCategoryManagerProps) {
  const [categories, setCategories] = useState<TraitCategory[]>(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const addCategory = () => {
    if (!newCategoryName.trim()) return;

    const newCategory: TraitCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
    };

    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    onCategoriesChange?.(updatedCategories);
    setNewCategoryName('');
  };

  const removeCategory = (categoryId: string) => {
    const updatedCategories = categories.filter(cat => cat.id !== categoryId);
    setCategories(updatedCategories);
    onCategoriesChange?.(updatedCategories);
  };

  const startEdit = (category: TraitCategory) => {
    setEditingCategory(category.id);
    setEditName(category.name);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;

    const updatedCategories = categories.map(cat =>
      cat.id === editingCategory
        ? { ...cat, name: editName.trim() }
        : cat
    );

    setCategories(updatedCategories);
    onCategoriesChange?.(updatedCategories);
    setEditingCategory(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-medium text-green-400 mb-4">
        🏷️ Trait Categories
      </h3>
      
      <p className="text-gray-400 text-sm mb-6">
        Add, edit and delete trait categories/rarities.
      </p>

      {/* Categories List */}
      <div className="space-y-2 mb-6">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between p-3 bg-gray-800 border border-gray-600 rounded-lg hover:border-green-500 transition-colors"
          >
            {editingCategory === category.id ? (
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="flex-1 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  className="px-3 py-1 bg-green-600 text-black rounded text-sm font-medium hover:bg-green-500 transition-colors"
                >
                  ✓
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3">
                  <span className="text-green-400 font-medium">{category.name}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900 rounded transition-colors"
                    title="Edit category"
                  >
                    ✏️
                  </button>
                  
                  <button
                    onClick={() => removeCategory(category.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900 rounded transition-colors"
                    title="Delete category"
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🏷️</div>
            <p>No categories yet. Add your first category below.</p>
          </div>
        )}
      </div>

      {/* Add New Category */}
      <div className="flex space-x-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addCategory()}
          placeholder="Enter new category name..."
          className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-green-400 focus:outline-none focus:ring-green-500 focus:border-green-500"
        />
        <button
          onClick={addCategory}
          disabled={!newCategoryName.trim()}
          className="bg-green-600 text-black px-4 py-2 rounded-md hover:bg-green-500 font-bold transition-colors disabled:opacity-50"
        >
          ➕ Add Category
        </button>
      </div>
    </div>
  );
}
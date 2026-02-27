'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  backgroundUrl?: string;
  discordUrl?: string;
  xUrl?: string;
  magicedenUrl?: string;
  websiteUrl?: string;
  collectionIds: string[];
  treasuryWallet: string;
  sellerFeeBasisPoints?: number;
  collectionSymbol?: string;
  creatorAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    logoUrl: '',
    backgroundUrl: '',
    discordUrl: '',
    xUrl: '',
    magicedenUrl: '',
    websiteUrl: '',
    collectionIds: [''],
    treasuryWallet: '',
    sellerFeeBasisPoints: 690,
    collectionSymbol: 'PGV2',
    creatorAddress: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/projects', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Remove from local state
      setProjects(projects.filter(p => p.id !== projectId));
      alert(`Project "${projectName}" deleted successfully`);
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        ...formData,
        collectionIds: formData.collectionIds.filter(id => id.trim() !== '')
      };

      const url = editingProject 
        ? `/api/admin/projects/${editingProject.id}`
        : '/api/admin/projects';
      
      const method = editingProject ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (editingProject) {
        setProjects(projects.map(p => p.id === editingProject.id ? data.project : p));
        alert('Project updated successfully');
      } else {
        setProjects([...projects, data.project]);
        alert('Project created successfully');
      }

      resetForm();
    } catch (err) {
      console.error('Failed to save project:', err);
      alert(`Failed to save project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      logoUrl: '',
      backgroundUrl: '',
      discordUrl: '',
      xUrl: '',
      magicedenUrl: '',
      websiteUrl: '',
      collectionIds: [''],
      treasuryWallet: '',
      sellerFeeBasisPoints: 690,
      collectionSymbol: 'PGV2',
      creatorAddress: ''
    });
    setShowCreateForm(false);
    setEditingProject(null);
  };

  const startEdit = (project: Project) => {
    setFormData({
      name: project.name,
      description: project.description || '',
      logoUrl: project.logoUrl || '',
      backgroundUrl: project.backgroundUrl || '',
      discordUrl: project.discordUrl || '',
      xUrl: project.xUrl || '',
      magicedenUrl: project.magicedenUrl || '',
      websiteUrl: project.websiteUrl || '',
      collectionIds: project.collectionIds.length > 0 ? project.collectionIds : [''],
      treasuryWallet: project.treasuryWallet,
      sellerFeeBasisPoints: project.sellerFeeBasisPoints ?? 690,
      collectionSymbol: project.collectionSymbol || 'PGV2',
      creatorAddress: project.creatorAddress || ''
    });
    setEditingProject(project);
    setShowCreateForm(true);
  };

  const addCollectionField = () => {
    setFormData({
      ...formData,
      collectionIds: [...formData.collectionIds, '']
    });
  };

  const removeCollectionField = (index: number) => {
    setFormData({
      ...formData,
      collectionIds: formData.collectionIds.filter((_, i) => i !== index)
    });
  };

  const updateCollectionId = (index: number, value: string) => {
    const newCollectionIds = [...formData.collectionIds];
    newCollectionIds[index] = value;
    setFormData({
      ...formData,
      collectionIds: newCollectionIds
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-white/40">Manage project settings and collections</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/20"
        >
          + New Project
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Treasury Wallet *</label>
                <input
                  type="text"
                  value={formData.treasuryWallet}
                  onChange={(e) => setFormData({...formData, treasuryWallet: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Seller Fee Basis Points *</label>
                <input
                  type="number"
                  value={formData.sellerFeeBasisPoints}
                  onChange={(e) => setFormData({...formData, sellerFeeBasisPoints: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  min={0}
                  max={10000}
                  required
                />
                <p className="text-white/20 text-xs mt-1">{(formData.sellerFeeBasisPoints / 100).toFixed(2)}% royalty (690 = 6.9%)</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Collection Symbol *</label>
                <input
                  type="text"
                  value={formData.collectionSymbol}
                  onChange={(e) => setFormData({...formData, collectionSymbol: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  maxLength={20}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Creator Address</label>
                <input
                  type="text"
                  value={formData.creatorAddress}
                  onChange={(e) => setFormData({...formData, creatorAddress: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                  placeholder="Falls back to update authority if empty"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Collection IDs *</label>
              {formData.collectionIds.map((id, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => updateCollectionId(index, e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors"
                    placeholder="Collection ID"
                    required={index === 0}
                  />
                  {formData.collectionIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCollectionField(index)}
                      className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addCollectionField}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:bg-white/[0.08] transition-colors"
              >
                + Add Collection ID
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Logo URL</label>
                <input type="url" value={formData.logoUrl} onChange={(e) => setFormData({...formData, logoUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Background URL</label>
                <input type="url" value={formData.backgroundUrl} onChange={(e) => setFormData({...formData, backgroundUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Discord URL</label>
                <input type="url" value={formData.discordUrl} onChange={(e) => setFormData({...formData, discordUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">X (Twitter) URL</label>
                <input type="url" value={formData.xUrl} onChange={(e) => setFormData({...formData, xUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Magic Eden URL</label>
                <input type="url" value={formData.magicedenUrl} onChange={(e) => setFormData({...formData, magicedenUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Website URL</label>
                <input type="url" value={formData.websiteUrl} onChange={(e) => setFormData({...formData, websiteUrl: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:from-violet-500 hover:to-indigo-500 transition-all"
              >
                {editingProject ? 'Update Project' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/40">No projects found</p>
            <p className="text-white/20 text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div key={project.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-white/40 mt-1">{project.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(project)}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs hover:bg-white/[0.08] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-white/30">Treasury:</span>
                  <span className="ml-2 font-mono text-white/60 text-xs">{project.treasuryWallet}</span>
                </div>
                <div>
                  <span className="text-white/30">Collections:</span>
                  <span className="ml-2 text-white/60">{project.collectionIds.length}</span>
                </div>
                <div>
                  <span className="text-white/30">Seller Fee:</span>
                  <span className="ml-2 text-white/60">{project.sellerFeeBasisPoints ?? 690} bps ({((project.sellerFeeBasisPoints ?? 690) / 100).toFixed(2)}%)</span>
                </div>
                <div>
                  <span className="text-white/30">Symbol:</span>
                  <span className="ml-2 text-white/60">{project.collectionSymbol || 'PGV2'}</span>
                </div>
                {project.creatorAddress && (
                  <div className="md:col-span-2">
                    <span className="text-white/30">Creator:</span>
                    <span className="ml-2 font-mono text-white/60 text-xs">{project.creatorAddress}</span>
                  </div>
                )}
              </div>

              {(project.websiteUrl || project.discordUrl || project.xUrl || project.magicedenUrl) && (
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex gap-3">
                  {project.websiteUrl && (
                    <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">Website</a>
                  )}
                  {project.discordUrl && (
                    <a href={project.discordUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">Discord</a>
                  )}
                  {project.xUrl && (
                    <a href={project.xUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">X</a>
                  )}
                  {project.magicedenUrl && (
                    <a href={project.magicedenUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">Magic Eden</a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
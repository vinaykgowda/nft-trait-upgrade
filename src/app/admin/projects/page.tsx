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
    treasuryWallet: ''
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
      treasuryWallet: ''
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
      treasuryWallet: project.treasuryWallet
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
      <div className="min-h-screen bg-black text-green-400 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl">Loading projects...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-green-400">Projects Management</h1>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-green-600 hover:bg-green-700 text-black px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Create New Project
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-gray-900 border border-green-600 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Treasury Wallet *</label>
                  <input
                    type="text"
                    value={formData.treasuryWallet}
                    onChange={(e) => setFormData({...formData, treasuryWallet: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Collection IDs *</label>
                {formData.collectionIds.map((id, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={id}
                      onChange={(e) => updateCollectionId(index, e.target.value)}
                      className="flex-1 bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                      placeholder="Collection ID"
                      required={index === 0}
                    />
                    {formData.collectionIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCollectionField(index)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCollectionField}
                  className="bg-green-600 hover:bg-green-700 text-black px-4 py-2 rounded text-sm"
                >
                  Add Collection ID
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Logo URL</label>
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({...formData, logoUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Background URL</label>
                  <input
                    type="url"
                    value={formData.backgroundUrl}
                    onChange={(e) => setFormData({...formData, backgroundUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Discord URL</label>
                  <input
                    type="url"
                    value={formData.discordUrl}
                    onChange={(e) => setFormData({...formData, discordUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">X (Twitter) URL</label>
                  <input
                    type="url"
                    value={formData.xUrl}
                    onChange={(e) => setFormData({...formData, xUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Magic Eden URL</label>
                  <input
                    type="url"
                    value={formData.magicedenUrl}
                    onChange={(e) => setFormData({...formData, magicedenUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Website URL</label>
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({...formData, websiteUrl: e.target.value})}
                    className="w-full bg-black border border-green-600 rounded px-3 py-2 text-green-400 focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-black px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-400">No projects found</p>
              <p className="text-gray-500 mt-2">Create your first project to get started</p>
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="bg-gray-900 border border-green-600 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-green-400">{project.name}</h3>
                    {project.description && (
                      <p className="text-gray-300 mt-2">{project.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(project)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Treasury Wallet:</span>
                    <span className="ml-2 font-mono text-green-300">{project.treasuryWallet}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Collections:</span>
                    <span className="ml-2">{project.collectionIds.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <span className="ml-2">{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Updated:</span>
                    <span className="ml-2">{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Social Links */}
                {(project.websiteUrl || project.discordUrl || project.xUrl || project.magicedenUrl) && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <span className="text-gray-400 text-sm">Links:</span>
                    <div className="flex gap-4 mt-2">
                      {project.websiteUrl && (
                        <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" 
                           className="text-green-400 hover:text-green-300 text-sm">Website</a>
                      )}
                      {project.discordUrl && (
                        <a href={project.discordUrl} target="_blank" rel="noopener noreferrer" 
                           className="text-green-400 hover:text-green-300 text-sm">Discord</a>
                      )}
                      {project.xUrl && (
                        <a href={project.xUrl} target="_blank" rel="noopener noreferrer" 
                           className="text-green-400 hover:text-green-300 text-sm">X</a>
                      )}
                      {project.magicedenUrl && (
                        <a href={project.magicedenUrl} target="_blank" rel="noopener noreferrer" 
                           className="text-green-400 hover:text-green-300 text-sm">Magic Eden</a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
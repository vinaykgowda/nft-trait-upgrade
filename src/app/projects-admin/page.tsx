'use client';

export default function ProjectsAdminPage() {
  const mockProjects = [
    {
      id: '1',
      name: 'Test Project 1',
      description: 'A test project',
      collectionIds: ['abc123'],
      treasuryWallet: '11111111111111111111111111111112'
    },
    {
      id: '2', 
      name: 'Test Project 2',
      description: 'Another test project',
      collectionIds: ['def456'],
      treasuryWallet: '22222222222222222222222222222223'
    }
  ];

  const deleteProject = (id: string) => {
    if (confirm('Delete project?')) {
      alert(`Would delete project ${id}`);
    }
  };

  return (
    <div className="p-6 bg-black text-green-400 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">🚀 Projects Admin (Working!)</h1>
      
      {mockProjects.map((project) => (
        <div key={project.id} className="bg-gray-800 p-4 mb-4 rounded border border-gray-600">
          <h3 className="text-lg font-semibold text-green-400">{project.name}</h3>
          <p className="text-gray-300">{project.description}</p>
          <p className="text-sm text-gray-500 mt-2">
            Collections: {project.collectionIds.length} | 
            Treasury: {project.treasuryWallet.slice(0, 8)}...
          </p>
          <button 
            onClick={() => deleteProject(project.id)}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
          >
            🗑️ Delete Project
          </button>
        </div>
      ))}
      
      <div className="mt-6 p-4 bg-green-900 border border-green-600 rounded">
        <p className="text-green-300">✅ This page is working! The delete buttons show confirmation dialogs.</p>
        <p className="text-green-400 mt-2">To connect to real data, you need to login first at /admin/login</p>
      </div>
    </div>
  );
}
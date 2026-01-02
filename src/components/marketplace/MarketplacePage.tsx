'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Project } from '@/types';
import { WalletButton, WalletConnectionStatus } from '../wallet/WalletButton';
import { TraitMarketplace } from '../marketplace/TraitMarketplace';

export function MarketplacePage() {
  const { connected } = useWallet();
  const [project, setProject] = useState<Partial<Project> | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  useEffect(() => {
    fetchProjectConfig();
  }, []);

  const fetchProjectConfig = async () => {
    try {
      const response = await fetch('/api/project');
      if (response.ok) {
        const apiResponse = await response.json();
        // Handle both direct data and wrapped API response
        const projectData = apiResponse.data || apiResponse;
        setProject(projectData);
      } else {
        console.error('Failed to fetch project configuration');
        // Use default values
        setProject({
          name: 'NFT Trait Marketplace',
          collectionIds: [],
        });
      }
    } catch (error) {
      console.error('Error fetching project configuration:', error);
      setProject({
        name: 'NFT Trait Marketplace',
        collectionIds: [],
      });
    } finally {
      setProjectLoading(false);
    }
  };

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const projectName = project?.name || 'NFT Trait Marketplace';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              {project?.logoUrl && (
                <img
                  src={project.logoUrl}
                  alt={projectName}
                  className="h-8 w-8 rounded"
                />
              )}
              <h1 className="text-xl font-semibold text-gray-900">
                {projectName}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <WalletConnectionStatus />
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!connected ? (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <div className="max-w-md mx-auto">
                {project?.backgroundUrl && (
                  <div className="mb-8">
                    <img
                      src={project.backgroundUrl}
                      alt="Background"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
                
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to {projectName}
                </h2>
                
                {project?.description && (
                  <p className="text-gray-600 mb-8">
                    {project.description}
                  </p>
                )}
                
                <p className="text-gray-600 mb-8">
                  Connect your Solana wallet to view your NFTs and start customizing them with traits.
                </p>
                
                <WalletButton />

                {/* Social Links */}
                {(project?.discordUrl || project?.xUrl || project?.websiteUrl) && (
                  <div className="mt-8 flex justify-center space-x-4">
                    {project.websiteUrl && (
                      <a
                        href={project.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Website
                      </a>
                    )}
                    {project.discordUrl && (
                      <a
                        href={project.discordUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        Discord
                      </a>
                    )}
                    {project.xUrl && (
                      <a
                        href={project.xUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        X (Twitter)
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Trait Browser - Visible before wallet connection */}
            <TraitMarketplace />
          </div>
        ) : (
          <TraitMarketplace />
        )}
      </main>
    </div>
  );
}
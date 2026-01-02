// Service for managing project tokens
import { ProjectToken } from '@/types';

export interface ProjectTokensResponse {
  success: boolean;
  tokens: ProjectToken[];
}

export class ProjectTokensService {
  /**
   * Fetch all tokens for a specific project
   */
  static async getProjectTokens(projectId: string): Promise<ProjectToken[]> {
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/tokens`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ProjectTokensResponse = await response.json();
      return data.tokens || [];
    } catch (error) {
      console.error('Failed to fetch project tokens:', error);
      return [];
    }
  }

  /**
   * Get all available tokens across all projects (for trait pricing)
   */
  static async getAllAvailableTokens(): Promise<ProjectToken[]> {
    try {
      // First try to get tokens from the dedicated tokens API
      const response = await fetch('/api/admin/tokens', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.tokens) {
          return data.tokens.map((token: any) => ({
            id: token.id,
            projectId: '',
            tokenAddress: token.tokenAddress,
            tokenName: token.tokenName,
            tokenSymbol: token.tokenSymbol,
            decimals: token.decimals,
            enabled: token.enabled,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
        }
      }

      // Fallback to project tokens
      const projectResponse = await fetch('/api/admin/projects', {
        credentials: 'include'
      });

      if (!projectResponse.ok) {
        throw new Error(`HTTP ${projectResponse.status}: ${projectResponse.statusText}`);
      }

      const projectData = await projectResponse.json();
      const allTokens: ProjectToken[] = [];

      // Collect all unique tokens from all projects
      const tokenMap = new Map<string, ProjectToken>();

      projectData.projects?.forEach((project: any) => {
        project.tokens?.forEach((token: ProjectToken) => {
          if (token.enabled && !tokenMap.has(token.tokenAddress)) {
            tokenMap.set(token.tokenAddress, token);
          }
        });
      });

      const tokens = Array.from(tokenMap.values());
      
      // If no SOL token found, add a fallback (this shouldn't happen in production)
      const hasSol = tokens.some(t => t.tokenAddress === 'So11111111111111111111111111111111111111112');
      if (!hasSol) {
        tokens.unshift(this.getDefaultSOLToken());
      }

      return tokens;
    } catch (error) {
      console.error('Failed to fetch all available tokens:', error);
      return [this.getDefaultSOLToken()]; // Fallback to SOL only
    }
  }

  /**
   * Format token amount for display
   */
  static formatTokenAmount(amount: string | number, decimals: number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (numAmount / Math.pow(10, decimals)).toFixed(decimals === 9 ? 4 : 2);
  }

  /**
   * Convert display amount to raw amount (with decimals)
   */
  static toRawAmount(displayAmount: string | number, decimals: number): string {
    const numAmount = typeof displayAmount === 'string' ? parseFloat(displayAmount) : displayAmount;
    return Math.floor(numAmount * Math.pow(10, decimals)).toString();
  }

  /**
   * Convert raw amount to display amount (removing decimals)
   */
  static fromRawAmount(rawAmount: string | number, decimals: number): string {
    const numAmount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
    return (numAmount / Math.pow(10, decimals)).toString();
  }

  /**
   * Validate token amount input
   */
  static validateTokenAmount(amount: string, decimals: number): { valid: boolean; error?: string } {
    if (!amount || amount.trim() === '') {
      return { valid: false, error: 'Amount is required' };
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { valid: false, error: 'Amount must be a positive number' };
    }

    // Check decimal places
    const decimalPlaces = (amount.split('.')[1] || '').length;
    if (decimalPlaces > decimals) {
      return { valid: false, error: `Maximum ${decimals} decimal places allowed` };
    }

    return { valid: true };
  }

  /**
   * Get default SOL token info
   */
  static getDefaultSOLToken(): ProjectToken {
    return {
      id: 'f3020eb2-582e-45f0-a5d0-7df47c87b79b', // Actual SOL token ID from database
      projectId: '',
      tokenAddress: 'So11111111111111111111111111111111111111112',
      tokenName: 'Solana',
      tokenSymbol: 'SOL',
      decimals: 9,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}
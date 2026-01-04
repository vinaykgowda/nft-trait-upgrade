// Service for managing project tokens
import { ProjectToken } from '@/types';
import { query } from '@/lib/database';

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
        const solToken = await this.getDefaultSOLToken();
        if (solToken) {
          tokens.unshift(solToken);
        }
      }

      return tokens;
    } catch (error) {
      console.error('Failed to fetch all available tokens:', error);
      const fallbackSol = await this.getDefaultSOLToken();
      return fallbackSol ? [fallbackSol] : []; // Fallback to SOL only if available
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
   * Get default SOL token info (dynamically fetched from database)
   */
  static async getDefaultSOLToken(): Promise<ProjectToken | null> {
    try {
      // First try to get from main tokens table
      const mainTokenResult = await query('SELECT id FROM tokens WHERE symbol = $1', ['SOL']);
      
      if (mainTokenResult.rows.length > 0) {
        return {
          id: mainTokenResult.rows[0].id,
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
      
      // If not found in main tokens, try project tokens
      const projectTokenResult = await query(
        'SELECT id FROM project_tokens WHERE token_symbol = $1 LIMIT 1', 
        ['SOL']
      );
      
      if (projectTokenResult.rows.length > 0) {
        return {
          id: projectTokenResult.rows[0].id,
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
      
      return null;
    } catch (error) {
      console.error('Error fetching default SOL token:', error);
      return null;
    }
  }

  /**
   * Get default SOL token info (synchronous fallback - deprecated)
   * @deprecated Use getDefaultSOLToken() instead
   */
  static getDefaultSOLTokenSync(): ProjectToken {
    return {
      id: 'sol-placeholder', // Will be replaced by dynamic lookup
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
import { ProjectRepository } from '@/lib/repositories/projects';

export interface AppConfig {
  treasuryWallet: string;
  solTokenMint?: string;
  ldzTokenMint?: string;
  collectionIds: string[];
  nftCreatorAddress: string;
  nftCollectionSymbol: string;
  nftSellerFeeBasisPoints: number;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;
  private projectRepo: ProjectRepository;

  private constructor() {
    this.projectRepo = new ProjectRepository();
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async getConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    // Primary source: Environment variables (always required)
    this.config = {
      treasuryWallet: process.env.TREASURY_WALLET!,
      collectionIds: process.env.COLLECTION_IDS?.split(',') || [],
      nftCreatorAddress: process.env.NFT_CREATOR_ADDRESS!,
      nftCollectionSymbol: process.env.NFT_COLLECTION_SYMBOL || 'PGV2',
      nftSellerFeeBasisPoints: parseInt(process.env.NFT_SELLER_FEE_BASIS_POINTS || '690'),
      solTokenMint: undefined, // SOL doesn't have a mint address
      ldzTokenMint: process.env.LDZ_TOKEN_MINT,
    };

    // Validate required fields
    if (!this.config.treasuryWallet) {
      throw new Error('TREASURY_WALLET is required in environment variables');
    }
    if (!this.config.nftCreatorAddress) {
      throw new Error('NFT_CREATOR_ADDRESS is required in environment variables');
    }
    if (!this.config.ldzTokenMint) {
      throw new Error('LDZ_TOKEN_MINT is required in environment variables');
    }

    // Optional enhancement: Try to get additional data from database
    try {
      const projects = await this.projectRepo.findAll();
      const project = projects[0]; // Use first project if available

      if (project) {
        // Override with database values if they exist and are different
        if (project.treasury_wallet && project.treasury_wallet !== this.config.treasuryWallet) {
          console.log(`Using database treasury wallet: ${project.treasury_wallet}`);
          this.config.treasuryWallet = project.treasury_wallet;
        }
        if (project.collection_ids && project.collection_ids.length > 0) {
          this.config.collectionIds = project.collection_ids;
        }
      }
    } catch (error) {
      console.warn('Could not load additional config from database (this is optional):', error);
    }

    return this.config;
  }

  async getTreasuryWallet(): Promise<string> {
    const config = await this.getConfig();
    return config.treasuryWallet;
  }

  async getTokenMintAddress(tokenSymbol: 'SOL' | 'LDZ'): Promise<string | undefined> {
    const config = await this.getConfig();
    return tokenSymbol === 'SOL' ? config.solTokenMint : config.ldzTokenMint;
  }

  // Clear cache when config changes
  clearCache(): void {
    this.config = null;
  }
}

export const configService = ConfigService.getInstance();
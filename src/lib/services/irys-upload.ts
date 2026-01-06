import Irys from "@irys/sdk";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export interface IrysUploadResult {
  id: string;
  url: string;
  size: number;
  contentType: string;
}

export interface NFTMetadataAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  symbol?: string;
  seller_fee_basis_points?: number;
  image: string;
  external_url?: string;
  attributes: NFTMetadataAttribute[];
  properties?: {
    files?: { uri: string; type: string }[];
    category?: string;
    creators?: { address: string; share: number }[];
  };
}

export interface FundResult {
  success: boolean;
  txId?: string;
  fundedAtomic?: string;
  error?: string;
}

export class IrysUploadService {
  private irysClient: Irys | null = null;

  // ---- Public API ----

  /**
   * Upload an image buffer to Irys.
   * Auto-funds Irys deposit if needed (prevents 402 insufficient balance).
   */
  async uploadImage(
    imageBuffer: Buffer,
    contentType: string,
    tags: Record<string, string> = {}
  ): Promise<IrysUploadResult> {
    const irys = await this.getIrysClient();

    const size = imageBuffer.length;
    await this.ensureIrysDepositForBytes(size);

    const baseTags = [
      { name: "Content-Type", value: contentType },
      { name: "App-Name", value: "pepenftupgrade" }
    ];

    for (const [k, v] of Object.entries(tags)) {
      baseTags.push({ name: k, value: v });
    }

    console.log(`📤 Uploading image to Irys (${irys.url})`);
    console.log(`- Size: ${size} bytes`);
    console.log(`- Content-Type: ${contentType}`);
    console.log(`- Public Key: ${irys.address}`);

    const tx = await irys.upload(imageBuffer, { tags: baseTags });

    const id = tx?.id;
    if (!id) throw new Error("Irys upload failed: missing transaction id");

    const url = `https://gateway.irys.xyz/${id}`;

    console.log(`✅ Image uploaded to Irys: ${url}`);

    return {
      id,
      url,
      size,
      contentType
    };
  }

  /**
   * Upload metadata JSON to Irys.
   * Auto-funds Irys deposit if needed.
   */
  async uploadMetadata(
    metadata: NFTMetadata,
    tags: Record<string, string> = {}
  ): Promise<IrysUploadResult> {
    const irys = await this.getIrysClient();

    const json = JSON.stringify(metadata, null, 2);
    const buf = Buffer.from(json, "utf8");

    await this.ensureIrysDepositForBytes(buf.length);

    const baseTags = [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "pepenftupgrade" }
    ];

    for (const [k, v] of Object.entries(tags)) {
      baseTags.push({ name: k, value: v });
    }

    console.log(`📤 Uploading metadata to Irys (${irys.url})`);
    console.log(`- Size: ${buf.length} bytes`);
    console.log(`- Public Key: ${irys.address}`);

    const tx = await irys.upload(buf, { tags: baseTags });

    const id = tx?.id;
    if (!id) throw new Error("Irys upload failed: missing transaction id");

    const url = `https://gateway.irys.xyz/${id}`;

    console.log(`✅ Metadata uploaded to Irys: ${url}`);

    return {
      id,
      url,
      size: buf.length,
      contentType: "application/json"
    };
  }

  /**
   * Optional helper: explicitly fund deposit on Irys node.
   * amountSol is SOL (e.g. 0.01). Internally converted to lamports (atomic).
   */
  async fundDeposit(amountSol: number): Promise<FundResult> {
    try {
      const irys = await this.getIrysClient();

      // Use SDK conversion to avoid float rounding surprises.
      // This returns a BigNumber.
      const atomicBN = irys.utils.toAtomic(amountSol);

      console.log(`💸 Funding Irys deposit: ${amountSol} SOL (${atomicBN.toString()} atomic)`);
      console.log(`- Node: ${irys.url}`);
      console.log(`- Public Key: ${irys.address}`);

      const fundTx = await irys.fund(atomicBN);

      console.log(`✅ Funded Irys deposit. Tx id: ${fundTx?.id}`);

      return {
        success: true,
        txId: fundTx?.id,
        fundedAtomic: String(fundTx?.quantity ?? atomicBN.toString())
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || String(e)
      };
    }
  }

  // ---- Core fix: deposit checks + auto funding ----

  /**
   * Ensures you have enough Irys "loaded balance" (deposit on node) to upload <bytes>.
   * This is what prevents your 402 errors.
   *
   * IMPORTANT: Use BigNumber operations directly (no BigInt conversion).
   */
  private async ensureIrysDepositForBytes(bytes: number): Promise<void> {
    const irys = await this.getIrysClient();

    const priceBN = await irys.getPrice(bytes);          // BigNumber
    const loadedBN = await irys.getLoadedBalance();      // BigNumber

    console.log(`💰 Irys loaded balance: ${loadedBN.toString()} atomic`);
    console.log(`💸 Upload price: ${priceBN.toString()} atomic`);

    // If loaded >= price => ok
    if (!loadedBN.lt(priceBN)) {
      console.log(`✅ Deposit sufficient for upload`);
      return;
    }

    // buffer to avoid edge failures (BigNumber)
    const bufferBN = irys.utils.toAtomic(0.00005); // ~50k lamports-ish (atomic)
    const toFundBN = priceBN.minus(loadedBN).plus(bufferBN);

    console.warn(`⚠️ Insufficient Irys deposit. Auto-funding...`);
    console.warn(`- Need: ${priceBN.toString()} atomic`);
    console.warn(`- Have: ${loadedBN.toString()} atomic`);
    console.warn(`- Funding: ${toFundBN.toString()} atomic`);

    const fundTx = await irys.fund(toFundBN);
    console.log(`✅ Auto-funded. Fund tx: ${fundTx?.id}`);

    const newLoadedBN = await irys.getLoadedBalance();
    console.log(`💰 New Irys loaded balance: ${newLoadedBN.toString()} atomic`);

    // If still insufficient, fail loudly
    if (newLoadedBN.lt(priceBN)) {
      throw new Error(
        `Irys deposit still insufficient after funding. ` +
          `Have=${newLoadedBN.toString()} Need=${priceBN.toString()}`
      );
    }
  }

  // ---- Irys client init ----

  private async getIrysClient(): Promise<Irys> {
    if (this.irysClient) return this.irysClient;

    const nodeUrl = process.env.IRYS_NODE_URL || "https://node1.irys.xyz";
    const token = "solana";

    // IMPORTANT: this RPC MUST match the network you're funding with.
    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      "https://api.mainnet-beta.solana.com";

    const kp = this.loadSolanaKeypairFromEnv();
    const pubkey = kp.publicKey.toBase58();

    console.log(`🔑 Initializing Irys client...`);
    console.log(`- Node URL: ${nodeUrl}`);
    console.log(`- Token: ${token}`);
    console.log(`- RPC: ${rpcUrl}`);
    console.log(`- Wallet pubkey: ${pubkey}`);

    const irys = new Irys({
      url: nodeUrl,
      token,
      key: kp.secretKey, // Uint8Array
      config: {
        providerUrl: rpcUrl
      }
    });

    await irys.ready();

    console.log(`🔗 Connected to Irys: ${irys.url}`);
    console.log(`👛 Irys address: ${irys.address}`);

    // Show balance (deposit) at init
    const loaded = await irys.getLoadedBalance();
    console.log(`💰 Irys loaded balance (deposit): ${loaded.toString()} atomic`);

    this.irysClient = irys;
    return irys;
  }

  /**
   * Reads IRYS_PRIVATE_KEY and creates a Solana Keypair.
   * Accepts:
   *  - JSON array string: "[12,34,...]"
   *  - base58 string
   */
  private loadSolanaKeypairFromEnv(): Keypair {
    const raw = process.env.IRYS_PRIVATE_KEY;
    if (!raw) {
      throw new Error("Missing env IRYS_PRIVATE_KEY");
    }

    const trimmed = raw.trim();

    // JSON array form
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }

    // base58 form
    const decoded = bs58.decode(trimmed);
    return Keypair.fromSecretKey(decoded);
  }
}

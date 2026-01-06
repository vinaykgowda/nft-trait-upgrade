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
      const atomic = Math.floor(amountSol * 1_000_000_000);

      console.log(`💸 Funding Irys deposit: ${amountSol} SOL (${atomic} atomic)`);
      console.log(`- Node: ${irys.url}`);
      console.log(`- Public Key: ${irys.address}`);

      const fundTx = await irys.fund(atomic);

      console.log(`✅ Funded Irys deposit. Tx id: ${fundTx?.id}`);

      return {
        success: true,
        txId: fundTx?.id,
        fundedAtomic: String(fundTx?.quantity ?? atomic)
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
   * Irys uses a deposit-based system: fund -> then upload spends from deposit. :contentReference[oaicite:1]{index=1}
   */
  private async ensureIrysDepositForBytes(bytes: number): Promise<void> {
  const irys = await this.getIrysClient();

  const priceBN = await irys.getPrice(bytes);
  const loadedBN = await irys.getLoadedBalance();

  const priceAtomic = BigInt(priceBN.toString());
  const loadedAtomic = BigInt(loadedBN.toString());

  console.log(`💰 Irys loaded balance: ${loadedAtomic.toString()} atomic`);
  console.log(`💸 Upload price: ${priceAtomic.toString()} atomic`);

  if (loadedAtomic >= priceAtomic) {
    console.log(`✅ Deposit sufficient for upload`);
    return;
  }

  // buffer to avoid edge failures
  const bufferAtomic = BigInt(50_000); // ~0.00005 SOL
  const toFund = (priceAtomic - loadedAtomic) + bufferAtomic;

  console.warn(`⚠️ Insufficient Irys deposit. Auto-funding...`);
  console.warn(`- Need: ${priceAtomic.toString()} atomic`);
  console.warn(`- Have: ${loadedAtomic.toString()} atomic`);
  console.warn(`- Funding: ${toFund.toString()} atomic`);

  const fundTx = await irys.fund(toFund.toString());
  console.log(`✅ Auto-funded. Fund tx: ${fundTx?.id}`);

  const newLoadedBN = await irys.getLoadedBalance();
  const newBal = BigInt(newLoadedBN.toString());

  console.log(`💰 New Irys loaded balance: ${newBal.toString()} atomic`);

  if (newBal < priceAtomic) {
    throw new Error(
      `Irys deposit still insufficient after funding. ` +
      `Have=${newBal.toString()} Need=${priceAtomic.toString()}`
    );
  }
}


  // ---- Irys client init ----

  private async getIrysClient(): Promise<Irys> {
    if (this.irysClient) return this.irysClient;

    const nodeUrl = process.env.IRYS_NODE_URL || "https://node1.irys.xyz";
    const token = "solana";

    // IMPORTANT: this RPC MUST match the network you're funding with.
    // If this points to devnet while nodeUrl is mainnet, you'll get "balance 0" on Irys.
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

    // Show both balances to remove confusion:
    const loaded = await irys.getLoadedBalance();
    console.log(`💰 Irys loaded balance (deposit): ${loaded} atomic`);

    this.irysClient = irys;
    return irys;
  }

  /**
   * Reads IRYS_PRIVATE_KEY and creates a Solana Keypair.
   * Accepts:
   *  - JSON array string: "[12,34,...]"
   *  - base58 string (Phantom export / many libs)
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

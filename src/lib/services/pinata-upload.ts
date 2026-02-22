import { PinataUploadResult, NFTMetadata } from '@/types';

/**
 * PinataUploadService - Handles uploads to Pinata IPFS using API Key + Secret.
 * No JWT needed — uses pinata_api_key and pinata_secret_api_key headers.
 */
export class PinataUploadService {
  private getCredentials(): { apiKey: string; apiSecret: string; gateway: string } {
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;
    const gateway = (process.env.PINATA_GATEWAY || '').trim();

    if (!apiKey || !apiSecret || !gateway) {
      throw new Error(
        `Pinata config missing: KEY=${apiKey ? 'SET' : 'MISSING'}, SECRET=${apiSecret ? 'SET' : 'MISSING'}, GATEWAY=${gateway ? 'SET' : 'MISSING'}`
      );
    }

    return { apiKey, apiSecret, gateway };
  }

  async uploadImage(
    imageBuffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<PinataUploadResult> {
    const startTime = Date.now();
    const { apiKey, apiSecret, gateway } = this.getCredentials();

    console.log(`📤 Uploading image to Pinata (${imageBuffer.length} bytes, ${contentType})`);

    const blob = new Blob([new Uint8Array(imageBuffer)], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, 'image');

    if (metadata) {
      formData.append('pinataMetadata', JSON.stringify({ keyvalues: metadata }));
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': apiSecret,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pinata upload failed (${res.status}): ${errText}`);
    }

    const result = await res.json();
    const cid = result.IpfsHash;
    const cleanGateway = gateway.replace(/\/+$/, '');
    const url = `https://${cleanGateway}/ipfs/${cid}`;

    console.log(`✅ Image uploaded: ${url} (${Date.now() - startTime}ms)`);

    return { cid, url, size: imageBuffer.length, contentType };
  }

  async uploadMetadata(metadata: NFTMetadata): Promise<PinataUploadResult> {
    const startTime = Date.now();
    const { apiKey, apiSecret, gateway } = this.getCredentials();

    console.log(`📤 Uploading metadata to Pinata (${metadata.name})`);

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': apiKey,
        'pinata_secret_api_key': apiSecret,
      },
      body: JSON.stringify({ pinataContent: metadata }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pinata metadata upload failed (${res.status}): ${errText}`);
    }

    const result = await res.json();
    const cid = result.IpfsHash;
    const cleanGateway = gateway.replace(/\/+$/, '');
    const url = `https://${cleanGateway}/ipfs/${cid}`;
    const size = Buffer.byteLength(JSON.stringify(metadata), 'utf8');

    console.log(`✅ Metadata uploaded: ${url} (${Date.now() - startTime}ms)`);

    return { cid, url, size, contentType: 'application/json' };
  }
}

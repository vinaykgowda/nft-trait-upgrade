import { NextResponse } from 'next/server';

/**
 * GET /api/debug/pinata-check
 * Temporary endpoint to verify PINATA env vars. DELETE after confirming.
 */
export async function GET() {
  const allPinataKeys = Object.keys(process.env).filter(k => k.includes('PINATA'));

  return NextResponse.json({
    PINATA_API_KEY: process.env.PINATA_API_KEY ? `SET (length=${process.env.PINATA_API_KEY.length})` : 'MISSING',
    PINATA_API_SECRET: process.env.PINATA_API_SECRET ? `SET (length=${process.env.PINATA_API_SECRET.length})` : 'MISSING',
    PINATA_GATEWAY: process.env.PINATA_GATEWAY || 'MISSING',
    PINATA_JWT: process.env.PINATA_JWT ? 'SET' : 'MISSING',
    all_pinata_keys: allPinataKeys,
    treasury_wallet: process.env.TREASURY_WALLET ? 'SET' : 'MISSING',
  });
}

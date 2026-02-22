import { NextResponse } from 'next/server';

/**
 * GET /api/debug/pinata-check
 * Temporary endpoint to verify PINATA env vars. DELETE after confirming.
 */
export async function GET() {
  const jwt = process.env.PINATA_JWT;
  const apiToken = process.env.PINATA_API_TOKEN;
  const gateway = process.env.PINATA_GATEWAY;
  const allPinataKeys = Object.keys(process.env).filter(k => k.includes('PINATA'));

  return NextResponse.json({
    PINATA_JWT: jwt ? `SET (length=${jwt.length})` : 'MISSING',
    PINATA_API_TOKEN: apiToken ? `SET (length=${apiToken.length})` : 'MISSING',
    PINATA_GATEWAY: gateway || 'MISSING',
    all_pinata_keys: allPinataKeys,
    treasury_wallet: process.env.TREASURY_WALLET ? 'SET' : 'MISSING',
    total_env_keys: Object.keys(process.env).length,
  });
}

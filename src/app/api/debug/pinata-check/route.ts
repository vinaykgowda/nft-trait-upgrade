import { NextResponse } from 'next/server';

/**
 * GET /api/debug/pinata-check
 * 
 * Temporary endpoint to verify PINATA env vars are loaded.
 * DELETE THIS after confirming everything works.
 */
export async function GET() {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.PINATA_GATEWAY;
  const allPinataKeys = Object.keys(process.env).filter(k => k.includes('PINATA'));

  return NextResponse.json({
    pinata_jwt: jwt ? `SET (length=${jwt.length}, starts=${jwt.substring(0, 6)}...)` : 'MISSING',
    pinata_jwt_has_newlines: jwt ? jwt.includes('\n') : null,
    pinata_jwt_has_spaces: jwt ? jwt !== jwt.trim() : null,
    pinata_gateway: gateway || 'MISSING',
    all_pinata_keys: allPinataKeys,
    treasury_wallet: process.env.TREASURY_WALLET ? 'SET' : 'MISSING',
    database_url: process.env.DATABASE_URL ? 'SET' : 'MISSING',
    node_env: process.env.NODE_ENV,
    total_env_keys: Object.keys(process.env).length,
  });
}

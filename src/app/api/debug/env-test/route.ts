import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    hasDatabase: !!process.env.DATABASE_URL,
    hasNextAuth: !!process.env.NEXTAUTH_SECRET,
    hasSolana: !!process.env.SOLANA_DELEGATE_PRIVATE_KEY,
    totalEnvVars: Object.keys(process.env).length,
    envKeys: Object.keys(process.env).filter(key => 
      key.includes('DATABASE') || 
      key.includes('NEXTAUTH') || 
      key.includes('SOLANA') ||
      key.includes('ADMIN')
    )
  });
}
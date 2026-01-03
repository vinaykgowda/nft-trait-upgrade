import { NextResponse } from 'next/server';

export async function GET() {
  // Only show this in development or with a special header for security
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return NextResponse.json({ 
      error: 'Environment debug only available in development' 
    }, { status: 403 });
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING',
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET ? 'SET' : 'MISSING',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ? 'SET' : 'MISSING',
    SOLANA_NETWORK: process.env.SOLANA_NETWORK ? 'SET' : 'MISSING',
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK ? 'SET' : 'MISSING',
    SOLANA_DELEGATE_PRIVATE_KEY: process.env.SOLANA_DELEGATE_PRIVATE_KEY ? 'SET' : 'MISSING',
    IRYS_PRIVATE_KEY: process.env.IRYS_PRIVATE_KEY ? 'SET' : 'MISSING',
    UPDATE_AUTHORITY_PRIVATE_KEY: process.env.UPDATE_AUTHORITY_PRIVATE_KEY ? 'SET' : 'MISSING',
  };

  return NextResponse.json({ 
    environment: envVars,
    message: 'Environment variables status'
  });
}
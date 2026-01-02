import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === 0n) {
    return whole.toString();
  }
  
  const fractional = remainder.toString().padStart(decimals, '0');
  return `${whole}.${fractional.replace(/0+$/, '')}`;
}

export function formatDecimalPrice(priceString: string): string {
  // Convert string to number, then back to string to remove trailing zeros
  const num = parseFloat(priceString);
  return num.toString();
}

export function parsePrice(price: string, decimals: number): bigint {
  const [whole, fractional = ''] = price.split('.');
  const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional);
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    // Basic validation - Solana addresses are base58 encoded and 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } catch {
    return false;
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function exponentialBackoff(attempt: number, baseDelay = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
}
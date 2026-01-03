#!/bin/bash

# Clean build script for Vercel deployment
echo "🧹 Cleaning build artifacts..."

# Remove all build artifacts
rm -rf .next
rm -rf .swc
rm -rf node_modules/.cache
rm -rf .vercel

echo "✅ Clean build artifacts removed"
echo "🏗️ Starting fresh build..."

# Install dependencies
npm ci

# Build the application
npm run build

echo "✅ Build completed successfully"
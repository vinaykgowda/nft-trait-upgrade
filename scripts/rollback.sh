#!/bin/bash

# NFT Trait Marketplace Rollback Script
set -e

echo "🔄 Starting rollback process..."

# Get the previous deployment
if command -v vercel &> /dev/null; then
    echo "📋 Fetching deployment history..."
    vercel ls --scope=team
    
    echo ""
    echo "Please enter the deployment URL to rollback to:"
    read -r ROLLBACK_URL
    
    if [ -z "$ROLLBACK_URL" ]; then
        echo "❌ No rollback URL provided. Exiting."
        exit 1
    fi
    
    echo "🔄 Rolling back to: $ROLLBACK_URL"
    vercel alias set $ROLLBACK_URL $(vercel ls --scope=team | head -1 | awk '{print $2}')
    
    echo "✅ Rollback completed successfully!"
    echo "🔍 Please verify the rollback by checking:"
    echo "   1. Application functionality"
    echo "   2. Health endpoint: /api/health"
    echo "   3. Database connectivity"
    
else
    echo "❌ Vercel CLI not found. Manual rollback required:"
    echo "   1. Go to Vercel dashboard"
    echo "   2. Select your project"
    echo "   3. Go to Deployments tab"
    echo "   4. Find the previous working deployment"
    echo "   5. Click 'Promote to Production'"
fi
# NFT Trait Marketplace Deployment Guide

## Prerequisites

1. **Vercel Account**: Set up a Vercel account and install the CLI
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Database**: Set up a PostgreSQL database (recommended: Neon, Supabase, or Railway)

3. **Solana Wallet**: Create a delegate wallet for signing transactions

4. **Irys Account**: Set up Irys for decentralized storage

## Environment Variables

### Required Variables

Set these in your Vercel project settings as **sensitive environment variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | NextAuth.js secret (32+ chars) | `your-secret-here` |
| `ADMIN_SESSION_SECRET` | Admin session secret (32+ chars) | `your-admin-secret` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `SOLANA_DELEGATE_PRIVATE_KEY` | Delegate wallet private key | `base58-encoded-key` |
| `IRYS_PRIVATE_KEY` | Irys wallet private key | `base58-encoded-key` |
| `IRYS_NODE_URL` | Irys node URL | `https://node1.irys.xyz` |

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with the "Sensitive" checkbox checked
4. Set the environment to "Production" (and "Preview" if needed)

## Database Setup

1. **Run Migrations**:
   ```bash
   psql $DATABASE_URL -f database/migrations/001_initial_schema.sql
   ```

2. **Verify Schema**: Ensure all tables are created correctly

3. **Create Admin User**: Use the admin API to create your first admin user

## Deployment Process

### Automated Deployment

1. **Run the deployment script**:
   ```bash
   ./scripts/deploy.sh
   ```

### Manual Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Run verification**:
   ```bash
   ./scripts/verify-deployment.sh https://your-app.vercel.app
   ```

## Post-Deployment Verification

### Automated Checks

Run the verification script:
```bash
./scripts/verify-deployment.sh https://your-app.vercel.app
```

### Manual Verification Checklist

- [ ] Health endpoint responds: `GET /api/health`
- [ ] Admin login works
- [ ] Database connectivity confirmed
- [ ] Solana RPC connectivity working
- [ ] Irys uploads functional
- [ ] Wallet connection works on frontend
- [ ] Trait browsing displays correctly
- [ ] Purchase flow completes successfully

## Rollback Procedure

If deployment issues occur:

1. **Automated rollback**:
   ```bash
   ./scripts/rollback.sh
   ```

2. **Manual rollback**:
   - Go to Vercel dashboard
   - Select your project
   - Navigate to Deployments
   - Find the last working deployment
   - Click "Promote to Production"

## Monitoring and Maintenance

### Health Monitoring

- Monitor `/api/health` endpoint
- Set up alerts for API failures
- Monitor database performance
- Track Solana RPC response times

### Log Monitoring

Check Vercel function logs for:
- Authentication failures
- Transaction build errors
- Database connection issues
- Irys upload failures

### Regular Maintenance

- Monitor database storage usage
- Clean up expired reservations
- Review audit logs for security
- Update dependencies regularly

## Security Considerations

### Environment Variables
- Never commit sensitive keys to version control
- Use Vercel's sensitive environment variables
- Rotate keys regularly
- Monitor for unauthorized access

### Database Security
- Use connection pooling
- Enable SSL connections
- Regular security updates
- Monitor for unusual activity

### Blockchain Security
- Keep update authority offline
- Monitor delegate wallet usage
- Regular key rotation
- Transaction monitoring

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify DATABASE_URL format
   - Check database server status
   - Verify SSL requirements

2. **Solana RPC Issues**:
   - Test RPC endpoint manually
   - Check rate limits
   - Consider using custom RPC

3. **Irys Upload Failures**:
   - Verify private key format
   - Check Irys node status
   - Monitor upload quotas

4. **Authentication Problems**:
   - Verify session secrets
   - Check MFA configuration
   - Review rate limiting settings

### Getting Help

- Check Vercel function logs
- Review database logs
- Monitor network requests
- Check browser console for frontend issues

## Performance Optimization

### Database
- Monitor query performance
- Add indexes as needed
- Use connection pooling
- Consider read replicas for analytics

### API
- Enable response caching
- Optimize image sizes
- Use CDN for static assets
- Monitor response times

### Frontend
- Optimize bundle size
- Enable image optimization
- Use lazy loading
- Cache wallet connections
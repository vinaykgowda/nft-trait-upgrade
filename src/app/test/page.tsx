export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: '#f3f4f6'}}>
      <div className="max-w-md w-full space-y-8 text-center" style={{padding: '2rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
        <h1 className="text-3xl font-bold" style={{fontSize: '1.875rem', fontWeight: 'bold', color: '#111827'}}>
          🎉 NFT Trait Marketplace
        </h1>
        <p style={{color: '#6b7280'}}>
          The application is running successfully!
        </p>
        <div className="space-y-4">
          <div style={{backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem', borderRadius: '0.375rem'}}>
            ✅ Next.js server is working
          </div>
          <div style={{backgroundColor: '#dbeafe', border: '1px solid #bfdbfe', color: '#1e40af', padding: '0.75rem', borderRadius: '0.375rem'}}>
            🔗 Try these links:
          </div>
          <div className="space-y-2">
            <a href="/" style={{display: 'block', color: '#2563eb', textDecoration: 'underline'}}>
              Main Marketplace
            </a>
            <a href="/login" style={{display: 'block', color: '#2563eb', textDecoration: 'underline'}}>
              Admin Login
            </a>
            <a href="/api/health" style={{display: 'block', color: '#2563eb', textDecoration: 'underline'}}>
              API Health Check
            </a>
            <a href="/api/docs" style={{display: 'block', color: '#2563eb', textDecoration: 'underline'}}>
              API Documentation
            </a>
          </div>
          <div style={{backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem', borderRadius: '0.375rem'}}>
            ⚠️ Database not set up yet - run setup script for full functionality
          </div>
        </div>
      </div>
    </div>
  );
}
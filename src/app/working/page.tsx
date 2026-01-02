export default function WorkingPage() {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      padding: '40px',
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>🎉 NFT Trait Marketplace - WORKING!</h1>
        
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '15px',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          ✅ This page is working! The server is functional.
        </div>

        <h2>Admin Login (Simplified)</h2>
        <form action="/api/admin/login" method="POST" style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '15px' }}>
            <input 
              type="text" 
              name="username" 
              placeholder="Username" 
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <input 
              type="password" 
              name="password" 
              placeholder="Password" 
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
          </div>
          <button 
            type="submit"
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
        </form>

        <h2>API Tests</h2>
        <div style={{ marginBottom: '10px' }}>
          <a href="/api/health" style={{ color: '#007bff', textDecoration: 'underline' }}>Health Check</a>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <a href="/api/docs" style={{ color: '#007bff', textDecoration: 'underline' }}>API Documentation</a>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <a href="/api/project" style={{ color: '#007bff', textDecoration: 'underline' }}>Project API</a>
        </div>

        <div style={{
          backgroundColor: '#fff3cd',
          color: '#856404',
          padding: '15px',
          borderRadius: '4px',
          marginTop: '20px'
        }}>
          ⚠️ Database needs setup for full functionality. Run the setup script if needed.
        </div>
      </div>
    </div>
  );
}
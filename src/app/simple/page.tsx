export default function SimplePage() {
  return (
    <html>
      <head>
        <title>NFT Trait Marketplace</title>
        <style>{`
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
          }
          .title { 
            color: #333; 
            margin-bottom: 20px; 
          }
          .form { 
            margin-top: 20px; 
          }
          .input { 
            width: 100%; 
            padding: 10px; 
            margin: 10px 0; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
            box-sizing: border-box; 
          }
          .button { 
            background: #0070f3; 
            color: white; 
            padding: 12px 24px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
          }
          .button:hover { 
            background: #0051cc; 
          }
          .success { 
            background: #d4edda; 
            color: #155724; 
            padding: 10px; 
            border-radius: 4px; 
            margin: 10px 0; 
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <h1 className="title">🎉 NFT Trait Marketplace</h1>
          <div className="success">✅ Application is working!</div>
          
          <h2>Admin Login</h2>
          <form className="form" action="/api/admin/login" method="POST">
            <input 
              className="input" 
              type="text" 
              name="username" 
              placeholder="Username" 
              required 
            />
            <input 
              className="input" 
              type="password" 
              name="password" 
              placeholder="Password" 
              required 
            />
            <button className="button" type="submit">
              Sign In
            </button>
          </form>
          
          <h2>Quick Links</h2>
          <p><a href="/api/health">API Health Check</a></p>
          <p><a href="/api/docs">API Documentation</a></p>
          <p><a href="/">Main Marketplace</a></p>
        </div>
      </body>
    </html>
  );
}
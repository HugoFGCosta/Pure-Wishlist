import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // If loaded from Shopify (has shop/host params), redirect to /app
  if (url.searchParams.get("shop") || url.searchParams.get("host")) {
    throw redirect(`/app${url.search}`);
  }

  return {};
};

export default function IndexPage() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Pure Wishlist — Shopify App</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 40px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
          }
          .container { 
            background: white; 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
            text-align: center; 
          }
          .icon { 
            width: 80px; 
            height: 80px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            border-radius: 20px; 
            margin: 0 auto 24px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 36px; 
          }
          h1 { 
            margin: 0 0 16px 0; 
            color: #1a202c; 
            font-size: 32px; 
            font-weight: 700; 
          }
          .subtitle { 
            color: #718096; 
            font-size: 18px; 
            margin-bottom: 32px; 
            line-height: 1.6; 
          }
          .alert { 
            background: #fef5e7; 
            border: 1px solid #f39c12; 
            border-radius: 8px; 
            padding: 16px; 
            margin-bottom: 32px; 
            color: #d68910; 
            font-size: 14px; 
            line-height: 1.5; 
          }
          .login-btn { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 16px 32px; 
            border-radius: 8px; 
            text-decoration: none; 
            font-weight: 600; 
            font-size: 16px; 
            transition: transform 0.2s, box-shadow 0.2s; 
          }
          .login-btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); 
          }
          .note { 
            margin-top: 24px; 
            color: #a0aec0; 
            font-size: 14px; 
          }
        `,
          }}
        />
      </head>
      <body>
        <div className="container">
          <div className="icon">❤️</div>
          <h1>Pure Wishlist</h1>
          <p className="subtitle">
            Transform your Shopify store with customer wishlist functionality
          </p>
          
          <div className="alert">
            <strong>⚠️ Admin Access Required</strong><br />
            This app is managed completely within your Shopify store admin panel. 
            Please log in to your Shopify dashboard to access and configure this app.
          </div>
          
          <a 
            href="https://admin.shopify.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="login-btn"
          >
            Go to Shopify Admin →
          </a>
          
          <p className="note">
            After logging in, navigate to Apps → Pure Wishlist to manage your settings
          </p>
        </div>
      </body>
    </html>
  );
}

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>404 — Page Not Found | PhantmOS</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #000000;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1.5rem;
      }
      .container {
        max-width: 32rem;
        width: 100%;
        text-align: center;
        padding: 2.5rem 2rem;
        background: #09090b;
        border: 1px solid #27272a;
        border-radius: 1.25rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        background: #18181b;
        border: 1px solid #27272a;
        color: #a1a1aa;
        font-size: 0.75rem;
        font-family: monospace;
        margin-bottom: 1.5rem;
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: #ef4444;
      }
      h1 {
        font-size: 1.75rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        margin-bottom: 0.75rem;
        color: #ffffff;
      }
      p {
        color: #a1a1aa;
        font-size: 0.875rem;
        line-height: 1.6;
        margin-bottom: 2rem;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      a, button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        border-radius: 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.2s ease;
        border: 1px solid transparent;
        font-family: inherit;
      }
      .primary {
        background: #ffffff;
        color: #000000;
      }
      .primary:hover {
        background: #e4e4e7;
      }
      .secondary {
        background: #18181b;
        color: #d4d4d8;
        border-color: #27272a;
      }
      .secondary:hover {
        background: #27272a;
        color: #ffffff;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="badge">
        <span class="dot"></span>
        <span>404 // NOT_FOUND</span>
      </div>
      <h1>This page could not be found.</h1>
      <p>The page you are looking for does not exist or failed to load. Head back to the dashboard or home.</p>
      <div class="actions">
        <a class="primary" href="/dashboard">Go to Dashboard</a>
        <a class="secondary" href="/">Go Home</a>
        <button class="secondary" onclick="location.reload()">Try Again</button>
      </div>
    </div>
  </body>
</html>`;
}

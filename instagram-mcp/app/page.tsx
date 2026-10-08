export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: '80px auto', padding: '0 24px' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 20, padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>Booknomics Instagram MCP</h1>
        <p>Remote MCP server for the Booknomics Instagram professional account.</p>
        <p><strong>MCP endpoint:</strong> <code>/api/mcp</code></p>
        <p>Live publishing is disabled unless <code>ENABLE_INSTAGRAM_WRITES=true</code>.</p>
      </div>
    </main>
  );
}

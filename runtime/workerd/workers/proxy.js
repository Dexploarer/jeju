/**
 * Minimal workerd proxy worker
 * Forwards requests to the Bun development server
 */
export default {
  async fetch(request, env) {
    const targetUrl = env.TARGET_URL || 'http://127.0.0.1:3001';
    const url = new URL(request.url);
    const proxyUrl = targetUrl + url.pathname + url.search;
    
    try {
      const response = await fetch(proxyUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? await request.arrayBuffer() 
          : undefined
      });
      
      return new Response(response.body, {
        status: response.status,
        headers: response.headers
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Proxy error', 
        message: error.message,
        target: proxyUrl 
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

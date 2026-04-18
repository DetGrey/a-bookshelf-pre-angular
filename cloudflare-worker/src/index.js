/**
 * Cloudflare Worker for downloading and serving book cover images
 * 
 * Endpoints:
 * - POST /upload - Download an image from a URL, convert to WebP, and store it in R2
 * - GET /:key - Serve an image from R2
 */

// Helper to generate a safe filename from URL (always .webp)
function generateKey(url) {
  // Create a hash of the URL for uniqueness
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  return crypto.subtle.digest('SHA-256', data)
    .then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `${hashHex.substring(0, 16)}.webp`;
    });
}

function normalizeKeyPrefix(prefix = '') {
  if (!prefix) return ''
  return prefix.trim().replace(/^\/+|\/+$/g, '')
}

function buildObjectKey(prefix, fileName) {
  const normalizedPrefix = normalizeKeyPrefix(prefix)
  if (!normalizedPrefix) return fileName
  return `${normalizedPrefix}/${fileName}`
}

// Helper to convert image to WebP using Cloudflare's Image Resizing
async function convertToWebP(imageData, contentType) {
  try {
    // Create a temporary response with the image data
    const imageResponse = new Response(imageData, {
      headers: { 'Content-Type': contentType }
    });
    
    // Use Cloudflare's automatic WebP conversion via fetch with cf.image
    // This requires Image Resizing to be enabled, but will fallback gracefully
    const convertedResponse = await fetch(imageResponse.url || 'https://example.com/image', {
      cf: {
        image: {
          format: 'webp',
          quality: 85
        }
      },
      body: imageData,
      method: 'POST'
    }).catch(() => null);
    
    if (convertedResponse && convertedResponse.ok) {
      return await convertedResponse.arrayBuffer();
    }
    
    // Fallback: return original image data
    return imageData;
  } catch (err) {
    console.warn('WebP conversion failed, using original format:', err.message);
    return imageData;
  }
}

// CORS headers
function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// Check if origin is allowed
function isOriginAllowed(origin, env) {
  if (!origin) return false;
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    return origin === allowed || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(isOriginAllowed(origin, env) ? origin : null);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // POST /upload - Download and store image (with WebP conversion)
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const body = await request.json();
        const { imageUrl } = body;

        if (!imageUrl) {
          console.error('Upload failed: No imageUrl provided');
          return new Response(JSON.stringify({ 
            error: 'imageUrl is required',
            originalUrl: imageUrl 
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Validate URL
        let sourceUrl;
        try {
          sourceUrl = new URL(imageUrl);
        } catch (err) {
          console.error('Upload failed: Invalid URL:', imageUrl, err.message);
          return new Response(JSON.stringify({ 
            error: 'Invalid URL',
            originalUrl: imageUrl 
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Download the image
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': sourceUrl.origin
          }
        }).catch(err => {
          console.error('Upload failed: Could not fetch image:', imageUrl, err.message);
          throw err;
        });

        if (!imageResponse.ok) {
          const errorMsg = `Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`;
          console.error('Upload failed:', errorMsg, 'URL:', imageUrl);
          return new Response(JSON.stringify({ 
            error: errorMsg,
            originalUrl: imageUrl 
          }), {
            status: 502,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Check content type
        const contentType = imageResponse.headers.get('Content-Type');
        if (!contentType || !contentType.startsWith('image/')) {
          console.error('Upload failed: Not an image:', imageUrl, 'Content-Type:', contentType);
          return new Response(JSON.stringify({ 
            error: 'URL does not point to an image',
            originalUrl: imageUrl 
          }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Check image size
        const contentLength = imageResponse.headers.get('Content-Length');
        const maxSize = parseInt(env.MAX_IMAGE_SIZE || '10485760'); // 10MB default
        if (contentLength && parseInt(contentLength) > maxSize) {
          console.error('Upload failed: Image too large:', imageUrl, 'Size:', contentLength);
          return new Response(JSON.stringify({ 
            error: `Image too large (max ${maxSize} bytes)`,
            originalUrl: imageUrl 
          }), {
            status: 413,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        // Get image data
        const imageData = await imageResponse.arrayBuffer();
        
        // Convert to WebP (attempts conversion, falls back to original if fails)
        const webpData = await convertToWebP(imageData, contentType);
        
        // Generate key (always .webp extension)
        const fileName = await generateKey(imageUrl);
        const key = buildObjectKey(env.R2_KEY_PREFIX, fileName);

        // Try to store in R2
        try {
          await env.BOOK_COVERS.put(key, webpData, {
            httpMetadata: {
              contentType: 'image/webp'
            },
            customMetadata: {
              originalUrl: imageUrl,
              uploadedAt: new Date().toISOString(),
              keyPrefix: normalizeKeyPrefix(env.R2_KEY_PREFIX),
              originalContentType: contentType
            }
          });

          // Return the URL to access the image
          const workerUrl = new URL(request.url);
          const storedUrl = `${workerUrl.origin}/${key}`;

          console.log('Upload successful:', imageUrl, '→', storedUrl);
          
          return new Response(JSON.stringify({ 
            success: true,
            url: storedUrl,
            key: key
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (r2Error) {
          // R2 upload failed - log it and return original URL
          console.error('R2 upload failed, returning original URL:', imageUrl, r2Error.message);
          return new Response(JSON.stringify({ 
            success: false,
            error: 'Failed to store image in R2',
            originalUrl: imageUrl,
            url: imageUrl // Fallback to original URL
          }), {
            status: 200, // Return 200 so frontend uses original URL
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

      } catch (error) {
        // Any other error - log it and return original URL if available
        console.error('Upload error:', error.message, error.stack);
        const body = await request.json().catch(() => ({}));
        return new Response(JSON.stringify({ 
          success: false,
          error: error.message || 'Internal server error',
          originalUrl: body.imageUrl || '',
          url: body.imageUrl || '' // Fallback to original URL
        }), {
          status: 200, // Return 200 so frontend uses original URL
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // GET /:key - Serve image from R2
    if (request.method === 'GET' && url.pathname !== '/') {
      const key = url.pathname.slice(1); // Remove leading slash

      try {
        const object = await env.BOOK_COVERS.get(key);

        if (!object) {
          return new Response('Image not found', { 
            status: 404,
            headers: corsHeaders
          });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('etag', object.httpEtag);
        
        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });

        return new Response(object.body, {
          headers
        });

      } catch (error) {
        console.error('Fetch error:', error);
        return new Response('Internal server error', { 
          status: 500,
          headers: corsHeaders
        });
      }
    }

    // Root path - return info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        service: 'Bookshelf Image Proxy',
        version: '1.0.0',
        endpoints: {
          upload: 'POST /upload with { imageUrl: "..." }',
          serve: 'GET /:key'
        }
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};

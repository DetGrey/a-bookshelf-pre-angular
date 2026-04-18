/**
 * Upload an image URL to the Cloudflare Worker image proxy
 * @param {string} imageUrl - The URL of the image to download and store
 * @returns {Promise<string>} The new URL where the image is stored (or original URL if upload fails)
 */
export async function uploadImageToProxy(imageUrl) {
  if (!imageUrl) {
    throw new Error('No image URL provided');
  }

  // Get worker URL from environment variable or use default
  const workerUrl = import.meta.env.VITE_IMAGE_PROXY_URL;
  
  if (!workerUrl) {
    console.warn('VITE_IMAGE_PROXY_URL not set, using original URL');
    return imageUrl;
  }

  try {
    const response = await fetch(`${workerUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      console.warn('Image upload failed:', error.error || error, '- Using original URL');
      return imageUrl;
    }

    const data = await response.json();
    
    // Check if upload was successful
    if (data.success && data.url) {
      console.log('Image uploaded successfully:', imageUrl, '→', data.url);
      return data.url;
    }
    
    // Upload failed but worker returned fallback
    if (!data.success && data.url) {
      console.warn('Image upload failed, using original URL:', data.error);
      return data.url;
    }
    
    // No URL in response, use original
    console.warn('Invalid response from image proxy, using original URL');
    return imageUrl;
    
  } catch (error) {
    // Network error or other exception - log and use original URL
    console.warn('Failed to upload image to proxy:', error.message, '- Using original URL');
    return imageUrl;
  }
}

/**
 * Process a cover URL - upload to proxy if it's an external URL
 * @param {string} coverUrl - The cover URL to process
 * @returns {Promise<string>} The processed cover URL
 */
export async function processCoverUrl(coverUrl) {
  if (!coverUrl) return '';
  
  // Check if it's already a proxied URL
  const workerUrl = import.meta.env.VITE_IMAGE_PROXY_URL;
  if (workerUrl && coverUrl.startsWith(workerUrl)) {
    return coverUrl;
  }

  // Check if it's an external URL
  try {
    const url = new URL(coverUrl);
    // If it's an http/https URL from an external source, upload it
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return await uploadImageToProxy(coverUrl);
    }
  } catch {
    // Not a valid URL, return as-is
  }

  return coverUrl;
}

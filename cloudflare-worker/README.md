# Bookshelf Image Proxy Worker

A Cloudflare Worker that downloads and serves book cover images, storing them in Cloudflare R2 for reliable, fast delivery.

## Features

- **Download & Store**: Fetches images from external URLs and stores them in R2
- **WebP Conversion**: Automatically converts images to WebP format for better compression
- **Fast Delivery**: Images served via Cloudflare's global CDN
- **CORS Support**: Configured for browser requests
- **Secure**: Origin validation and file type checking
- **Graceful Fallback**: If upload fails, logs error and returns original URL
- **Cost-Effective**: R2 has no egress fees, Worker has generous free tier

## API Endpoints

### POST /upload

Upload an image from a URL to R2 storage.

**Request:**
```json
{
  "imageUrl": "https://example.com/cover.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://your-worker.workers.dev/abc123.jpg",
  "key": "abc123.jpg"
}
```

### GET /:key

Serve an image from R2 storage.

**Example:**
```
https://your-worker.workers.dev/abc123.jpg
```

## Setup

See the main [GUIDE.md](../GUIDE.md) for complete setup instructions.

### Quick Start

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create R2 buckets
wrangler r2 bucket create bookshelf-covers
wrangler r2 bucket create bookshelf-covers-preview

# Update wrangler.toml with your allowed origins

# Deploy
npm run deploy
```

## Configuration

Edit `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://yourdomain.com,http://localhost:5173"
MAX_IMAGE_SIZE = "10485760"  # 10MB
```

## Development

```bash
# Run locally
npm run dev

# Test locally
curl -X POST http://localhost:8787/upload \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/image.jpg"}'
```

## Security

- Origin validation via ALLOWED_ORIGINS
- Content-Type verification (images only)
- File size limits (default 10MB)
- User-Agent headers for source requests

## Cost

With Cloudflare's free tier:
- **R2 Storage**: 10GB free
- **Requests**: 100,000/day free
- **Bandwidth**: No egress fees!

Should be free for most personal projects.

## License

MIT

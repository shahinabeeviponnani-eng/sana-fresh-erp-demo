// Cloudflare R2 storage helper — product images & documents

import { getRequestContext } from '@cloudflare/next-on-pages';

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: { contentType?: string };
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
}

export interface R2ListOptions {
  prefix?: string;
  limit?: number;
}

function getR2(): R2Bucket {
  try {
    const ctx = getRequestContext();
    if ((ctx?.env as any)?.R2) return (ctx.env as any).R2 as R2Bucket;
  } catch {}

  const symCtx = (globalThis as any)[Symbol.for('__cloudflare-request-context__')];
  if (symCtx?.env?.R2) return symCtx.env.R2 as R2Bucket;

  const globalCtx = (globalThis as any).__cloudflare_request_context__;
  if (globalCtx?.env?.R2) return globalCtx.env.R2 as R2Bucket;

  if ((globalThis as any).R2) return (globalThis as any).R2 as R2Bucket;
  throw new Error('R2 bucket binding not available. Ensure wrangler.toml has [[r2_buckets]] binding = "R2"');
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadProductImage(
  file: File,
  productId: number
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, GIF images allowed');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Image must be under 5MB');
  }

  const ext = file.type.split('/')[1];
  const key = `products/${productId}/${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const r2 = getR2();
  await r2.put(key, buffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { productId: String(productId) },
  });

  // Return public URL — set up via Cloudflare R2 public bucket or custom domain
  const publicBase = process.env.R2_PUBLIC_URL || `https://pub-REPLACE.r2.dev`;
  return `${publicBase}/${key}`;
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  try {
    const r2 = getR2();
    // Extract key from URL
    const publicBase = process.env.R2_PUBLIC_URL || '';
    const key = imageUrl.replace(`${publicBase}/`, '');
    if (key && key.startsWith('products/')) {
      await r2.delete(key);
    }
  } catch {
    // Non-fatal — log but don't throw
    console.warn('R2 delete failed for:', imageUrl);
  }
}

export async function getProductImageStream(key: string): Promise<R2ObjectBody | null> {
  const r2 = getR2();
  return r2.get(key);
}

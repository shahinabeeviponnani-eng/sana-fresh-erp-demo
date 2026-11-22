'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_KEY_PREFIX = 'sf_products_cache_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface CachedProduct {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  stock_quantity: number;
  unit: string;
  category_name: string;
  category_code: string;
  image_url: string | null;
  reorder_level: number;
  min_wholesale_qty: number;
}

interface CacheStore {
  userId: number;
  loadedAt: number;
  products: CachedProduct[];
}

function getCacheKey(userId: number) {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

function readCache(userId: number): CacheStore | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const store: CacheStore = JSON.parse(raw);
    if (Date.now() - store.loadedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(userId));
      return null;
    }
    return store;
  } catch {
    return null;
  }
}

function writeCache(userId: number, products: CachedProduct[]) {
  try {
    const store: CacheStore = { userId, loadedAt: Date.now(), products };
    localStorage.setItem(getCacheKey(userId), JSON.stringify(store));
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

function mergeIntoCache(userId: number, incoming: CachedProduct[]) {
  const store = readCache(userId);
  const existing = store ? store.products : [];
  const map = new Map(existing.map((p) => [p.id, p]));
  for (const p of incoming) map.set(p.id, p);
  writeCache(userId, Array.from(map.values()));
}

function toCache(p: any): CachedProduct {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode || '',
    name: p.name,
    retail_price: Number(p.retail_price),
    wholesale_price: Number(p.wholesale_price),
    cost_price: Number(p.cost_price),
    stock_quantity: Number(p.stock_quantity),
    unit: p.unit || 'pcs',
    category_name: p.category_name || '',
    category_code: p.category_code || '',
    image_url: p.image_url || null,
    reorder_level: Number(p.reorder_level) || 0,
    min_wholesale_qty: Number(p.min_wholesale_qty) || 1,
  };
}

function searchLocal(products: CachedProduct[], query: string): CachedProduct[] {
  const q = query.toLowerCase().trim();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
  );
}

export function useProductCache(userId: number | undefined) {
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheAge, setCacheAge] = useState<Date | null>(null);
  const loadedForUser = useRef<number | null>(null);

  const loadCache = useCallback(async (force = false) => {
    if (!userId) return;
    if (!force) {
      const existing = readCache(userId);
      if (existing) {
        setProducts(existing.products);
        setCacheAge(new Date(existing.loadedAt));
        setCacheReady(true);
        loadedForUser.current = userId;
        return;
      }
    }
    try {
      setCacheLoading(true);
      const res = await fetch('/api/products?limit=9999');
      if (!res.ok) return;
      const data = await res.json();
      const prods: CachedProduct[] = (data.products || []).map(toCache);
      writeCache(userId, prods);
      setProducts(prods);
      setCacheAge(new Date());
      setCacheReady(true);
      loadedForUser.current = userId;
    } catch {
      // fall through
    } finally {
      setCacheLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && loadedForUser.current !== userId) {
      loadCache(false);
    }
  }, [userId, loadCache]);

  // Local-first search, server fallback on miss
  const searchProducts = useCallback(async (query: string): Promise<CachedProduct[]> => {
    if (!query.trim()) return products;
    const localHits = searchLocal(products, query);
    if (localHits.length > 0) return localHits;
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      const serverProds: CachedProduct[] = (data.products || []).map(toCache);
      if (userId && serverProds.length > 0) {
        mergeIntoCache(userId, serverProds);
        setProducts((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          serverProds.forEach((p) => map.set(p.id, p));
          return Array.from(map.values());
        });
      }
      return serverProds;
    } catch {
      return [];
    }
  }, [products, userId]);

  // Fetch live price + stock for one product just before adding to cart
  const fetchLiveProduct = useCallback(async (productId: number): Promise<CachedProduct | null> => {
    try {
      const res = await fetch(`/api/products?id=${productId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const raw = data.product || (data.products || [])[0];
      if (!raw) return null;
      const updated = toCache(raw);
      if (userId) mergeIntoCache(userId, [updated]);
      setProducts((prev) => prev.map((cp) => (cp.id === updated.id ? updated : cp)));
      return updated;
    } catch {
      return null;
    }
  }, [userId]);

  // Call this after creating a new product so it appears in cache immediately
  const addProductToCache = useCallback((p: any) => {
    const cached = toCache(p);
    if (userId) mergeIntoCache(userId, [cached]);
    setProducts((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      map.set(cached.id, cached);
      return Array.from(map.values());
    });
  }, [userId]);

  const clearCache = useCallback(() => {
    if (userId) localStorage.removeItem(getCacheKey(userId));
    setProducts([]);
    setCacheReady(false);
    setCacheAge(null);
    loadedForUser.current = null;
  }, [userId]);

  const forceRefresh = useCallback(() => loadCache(true), [loadCache]);

  return {
    products,
    cacheReady,
    cacheLoading,
    cacheAge,
    searchProducts,
    fetchLiveProduct,
    addProductToCache,
    forceRefresh,
    clearCache,
  };
}

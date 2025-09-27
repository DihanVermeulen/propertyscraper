import { propertiesApi } from './api';

export interface ICachedData<T> {
  data: T;
  cachedAt: number;
  serverTimestamp: number;
}

// Cache duration: 2 hours in milliseconds
export const CACHE_DURATION = 2 * 60 * 60 * 1000;

// Storage key prefix
const CACHE_KEY_PREFIX = 'property_cache_';

/**
 * Get data from cache with timestamp checking
 */
export function getCachedData<T>(key: string): ICachedData<T> | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
    if (!cached) return null;
    
    return JSON.parse(cached) as ICachedData<T>;
  } catch (error) {
    console.warn('Error reading from cache:', error);
    return null;
  }
}

/**
 * Store data in cache with current timestamp
 */
export function setCachedData<T>(key: string, data: T, serverTimestamp: number): void {
  try {
    const cachedData: ICachedData<T> = {
      data,
      cachedAt: Date.now(),
      serverTimestamp
    };
    
    localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(cachedData));
  } catch (error) {
    console.warn('Error writing to cache:', error);
  }
}

/**
 * Check if cached data is still valid
 */
export function isCacheValid<T>(cachedData: ICachedData<T>, currentServerTimestamp: number): boolean {
  const now = Date.now();
  
  // Check if cache has expired (2 hours)
  if (now - cachedData.cachedAt > CACHE_DURATION) {
    return false;
  }
  
  // Check if server data has been updated since we cached
  if (currentServerTimestamp > cachedData.serverTimestamp) {
    return false;
  }
  
  return true;
}

/**
 * Clear cache for a specific key
 */
export function clearCache(key: string): void {
  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${key}`);
  } catch (error) {
    console.warn('Error clearing cache:', error);
  }
}

/**
 * Clear all property-related cache
 */
export function clearAllCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Error clearing all cache:', error);
  }
}

/**
 * Get cache key for a query
 */
export function getCacheKey(queryType: string, filters: Record<string, any>): string {
  // Create a deterministic key from the query type and filters
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {} as Record<string, any>);
    
  return `${queryType}_${JSON.stringify(sortedFilters)}`;
}

/**
 * Smart cache retrieval with server timestamp validation
 */
export async function getDataWithCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  skipTimestampCheck = false
): Promise<T> {
  try {
    // Get current server timestamp (unless skipped)
    let currentServerTimestamp = Date.now();
    if (!skipTimestampCheck) {
      const timestampResponse = await propertiesApi.getCacheTimestamp();
      currentServerTimestamp = timestampResponse.timestamp;
    }
    
    // Check cache first
    const cached = getCachedData<T>(cacheKey);
    if (cached && isCacheValid(cached, currentServerTimestamp)) {
      console.log('Using cached data for:', cacheKey);
      return cached.data;
    }
    
    // Fetch fresh data
    console.log('Fetching fresh data for:', cacheKey);
    const freshData = await fetchFn();
    
    // Cache the fresh data
    setCachedData(cacheKey, freshData, currentServerTimestamp);
    
    return freshData;
  } catch (error) {
    console.error('Error in getDataWithCache:', error);
    
    // Fallback to cached data if available, even if expired
    const cached = getCachedData<T>(cacheKey);
    if (cached) {
      console.log('Using expired cache as fallback for:', cacheKey);
      return cached.data;
    }
    
    // If no cache, re-throw the error
    throw error;
  }
}

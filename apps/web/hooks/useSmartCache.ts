import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { propertiesApi, rentalPropertiesApi } from '../lib/api';
import { getCacheKey, getDataWithCache } from '../lib/cache';
import { IPropertiesResponse, IRentalPropertiesResponse, IPropertyFilters, IRentalPropertyFilters } from '../@types/property';

/**
 * Custom hook for properties with smart caching
 */
export function useSmartPropertiesQuery(
  filters: IPropertyFilters
): UseQueryResult<IPropertiesResponse, Error> {
  const cacheKey = getCacheKey('properties', filters);
  
  return useQuery({
    queryKey: ['smart-properties', filters],
    queryFn: async () => {
      return getDataWithCache(
        cacheKey,
        () => propertiesApi.getProperties(filters)
      );
    },
    staleTime: 2 * 60 * 60 * 1000, // 2 hours - matches our cache duration
    gcTime: 4 * 60 * 60 * 1000, // 4 hours - keep in memory longer than cache
    refetchOnWindowFocus: false, // Don't refetch on focus since we have smart caching
    refetchOnMount: false, // Don't refetch on mount since we have smart caching
  });
}

/**
 * Custom hook for rental properties with smart caching
 */
export function useSmartRentalPropertiesQuery(
  filters: IRentalPropertyFilters
): UseQueryResult<IRentalPropertiesResponse, Error> {
  const cacheKey = getCacheKey('rental-properties', filters);
  
  return useQuery({
    queryKey: ['smart-rental-properties', filters],
    queryFn: async () => {
      return getDataWithCache(
        cacheKey,
        () => rentalPropertiesApi.getRentalProperties(filters)
      );
    },
    staleTime: 2 * 60 * 60 * 1000, // 2 hours - matches our cache duration
    gcTime: 4 * 60 * 60 * 1000, // 4 hours - keep in memory longer than cache
    refetchOnWindowFocus: false, // Don't refetch on focus since we have smart caching
    refetchOnMount: false, // Don't refetch on mount since we have smart caching
  });
}

/**
 * Hook to manually trigger cache invalidation and refetch
 */
export function useInvalidateSmartCache() {
  const { clearAllCache } = require('../lib/cache');
  
  return {
    invalidateAll: () => {
      clearAllCache();
      // Force a full page refresh to reload all queries
      window.location.reload();
    },
    
    invalidatePropertiesOnly: () => {
      const { clearCache } = require('../lib/cache');
      // Clear property-related caches
      Object.keys(localStorage).forEach(key => {
        if (key.includes('properties') && key.startsWith('property_cache_')) {
          const cacheKey = key.replace('property_cache_', '');
          clearCache(cacheKey);
        }
      });
    }
  };
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi, IPropertyFilters } from '../../lib/api';
import PropertyCard from '../../components/listings/PropertyCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Pagination from '../../components/ui/Pagination';
import PropertyFilters from '../../components/listings/PropertyFilters';

export default function ListingsPage() {
  const [filters, setFilters] = useState<IPropertyFilters>({
    limit: 12,
    offset: 0,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertiesApi.getProperties(filters),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const handleFilterChange = (newFilters: Partial<IPropertyFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0, // Reset to first page when filters change
    }));
  };

  const handlePageChange = (page: number) => {
    const limit = filters.limit || 12;
    setFilters(prev => ({
      ...prev,
      offset: (page - 1) * limit,
    }));
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-error-500 text-lg font-medium">
          Error loading properties
        </div>
        <p className="text-secondary-600 mt-2">
          Please try refreshing the page or check your connection.
        </p>
      </div>
    );
  }

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 12)) + 1;
  const totalPages = Math.ceil((data?.total || 0) / (filters.limit || 12));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            All Properties
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            {data?.total ? `${data.total.toLocaleString()} properties found` : 'Browse all scraped properties'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <PropertyFilters filters={filters} onFilterChange={handleFilterChange} />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Properties Grid */}
      {!isLoading && data?.properties && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {/* Empty State */}
          {data.properties.length === 0 && (
            <div className="text-center py-12">
              <div className="text-secondary-500 text-lg font-medium">
                No properties found
              </div>
              <p className="text-secondary-400 mt-2">
                Try adjusting your filters or check back later for new listings.
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import RentalPropertyFilters from '../../../components/listings/RentalPropertyFilters';
import RentalPropertyCard from '../../../components/listings/RentalPropertyCard';
import { rentalPropertiesApi } from '../../../lib/api';
import { Loader2, AlertCircle, Building } from 'lucide-react';

export default function RentalPropertiesPage() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
  });

  const {
    data: rentalData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rental-properties', filters],
    queryFn: () => rentalPropertiesApi.getRentalProperties(filters),
  });

  const properties = rentalData?.rental_properties || [];
  const totalCount = rentalData?.total || 0;
  const totalPages = Math.ceil(totalCount / filters.limit);

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...newFilters, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate flex items-center gap-2">
            <Building className="h-8 w-8" />
            Rental Properties
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Browse rental properties and analyze investment potential
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Properties</CardTitle>
          <CardDescription>
            Narrow down your search to find the perfect rental investment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RentalPropertyFilters
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {totalCount > 0 && (
              <>Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalCount)} of {totalCount} properties</>
            )}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-gray-600">Loading rental properties...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-12 text-red-600">
            <AlertCircle className="h-8 w-8 mr-2" />
            <span>Error loading properties. Please try again.</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && properties.length === 0 && (
          <div className="text-center py-12">
            <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rental properties found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your filters or check back later for new listings.
            </p>
          </div>
        )}

        {/* Properties Grid */}
        {!isLoading && !error && properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map((property: any) => (
              <RentalPropertyCard
                key={property.id}
                property={property}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-4">
            <button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page <= 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && filters.page > 3) {
                  pageNum = filters.page - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - 4 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      filters.page === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page >= totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

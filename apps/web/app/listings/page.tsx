'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useSmartPropertiesQuery, useSmartRentalPropertiesQuery } from '../../hooks/useSmartCache';
import PropertyCard from '../../components/listings/PropertyCard';
import RentalPropertyCard from '../../components/listings/RentalPropertyCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Pagination from '../../components/ui/Pagination';
import PropertyFilters from '../../components/listings/PropertyFilters';
import RentalPropertyFilters from '../../components/listings/RentalPropertyFilters';
import { Home, Building } from 'lucide-react';
import { IPropertyFilters, IRentalPropertyFilters } from '@/@types/property';

export default function ListingsPage() {
  const [saleFilters, setSaleFilters] = useState<IPropertyFilters>({
    limit: 12,
    offset: 0,
  });

  const [rentalFilters, setRentalFilters] = useState<IRentalPropertyFilters>({
    limit: 12,
    offset: 0,
  });

  // Sale Properties Query with Smart Caching
  const { data: saleData, isLoading: saleLoading, error: saleError } = useSmartPropertiesQuery(saleFilters);

  // Rental Properties Query with Smart Caching
  const { data: rentalData, isLoading: rentalLoading, error: rentalError } = useSmartRentalPropertiesQuery(rentalFilters);

  const handleSaleFilterChange = (newFilters: Partial<IPropertyFilters>) => {
    setSaleFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0, // Reset to first page when filters change
    }));
  };

  const handleRentalFilterChange = (newFilters: Partial<IRentalPropertyFilters>) => {
    setRentalFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0, // Reset to first page when filters change
    }));
  };

  const handleSalePageChange = (page: number) => {
    const limit = saleFilters.limit || 12;
    setSaleFilters(prev => ({
      ...prev,
      offset: (page - 1) * limit,
    }));
  };

  const handleRentalPageChange = (page: number) => {
    const limit = rentalFilters.limit || 12;
    setRentalFilters(prev => ({
      ...prev,
      offset: (page - 1) * limit,
    }));
  };

  const saleCurrentPage = Math.floor((saleFilters.offset || 0) / (saleFilters.limit || 12)) + 1;
  const saleTotalPages = Math.ceil((saleData?.total || 0) / (saleFilters.limit || 12));
  
  const rentalCurrentPage = Math.floor((rentalFilters.offset || 0) / (rentalFilters.limit || 12)) + 1;
  const rentalTotalPages = Math.ceil((rentalData?.total || 0) / (rentalFilters.limit || 12));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            All Properties
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Browse properties for sale and rent
          </p>
        </div>
      </div>

      {/* Property Type Tabs */}
      <Tabs defaultValue="for-sale" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="for-sale" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            For Sale
            {saleData?.total && saleData.total > 0 ? (
              <span className="bg-primary/10 text-primary text-xs px-2 rounded-full">
                {saleData.total.toLocaleString()}
              </span>
            ) : (
              <span className="bg-primary/10 text-primary text-xs px-2 rounded-full">
                0
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rentals" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Rentals
            {rentalData?.total && rentalData.total > 0 ? (
              <span className="bg-primary/10 text-primary text-xs px-2 rounded-full">
                {rentalData.total.toLocaleString()}
              </span>
            ) : (
              <span className="bg-primary/10 text-primary text-xs px-2 rounded-full">
                0
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* For Sale Properties Tab */}
        <TabsContent value="for-sale" className="space-y-6">
          <PropertyFilters filters={saleFilters} onFilterChange={handleSaleFilterChange} />

          {/* Loading State */}
          {saleLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* Error State */}
          {saleError && (
            <div className="text-center py-12">
              <div className="text-error-500 text-lg font-medium">
                Error loading properties for sale
              </div>
              <p className="text-secondary-600 mt-2">
                Please try refreshing the page or check your connection.
              </p>
            </div>
          )}

          {/* Properties Grid */}
          {!saleLoading && saleData?.properties && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {saleData.properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>

              {/* Empty State */}
              {saleData.properties.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-secondary-500 text-lg font-medium">
                    No properties for sale found
                  </div>
                  <p className="text-secondary-400 mt-2">
                    Try adjusting your filters or check back later for new listings.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {saleTotalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination
                    currentPage={saleCurrentPage}
                    totalPages={saleTotalPages}
                    onPageChange={handleSalePageChange}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Rental Properties Tab */}
        <TabsContent value="rentals" className="space-y-6">
          <RentalPropertyFilters filters={rentalFilters} onFilterChange={handleRentalFilterChange} />

          {/* Loading State */}
          {rentalLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {/* Error State */}
          {rentalError && (
            <div className="text-center py-12">
              <div className="text-error-500 text-lg font-medium">
                Error loading rental properties
              </div>
              <p className="text-secondary-600 mt-2">
                Please try refreshing the page or check your connection.
              </p>
            </div>
          )}

          {/* Rental Properties Grid */}
          {!rentalLoading && rentalData?.rental_properties && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rentalData.rental_properties.map((property) => (
                  <RentalPropertyCard key={property.id} property={property} />
                ))}
              </div>

              {/* Empty State */}
              {rentalData.rental_properties.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-secondary-500 text-lg font-medium">
                    No rental properties found
                  </div>
                  <p className="text-secondary-400 mt-2">
                    Try adjusting your filters or check back later for new listings.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {rentalTotalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination
                    currentPage={rentalCurrentPage}
                    totalPages={rentalTotalPages}
                    onPageChange={handleRentalPageChange}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

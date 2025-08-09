"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi, IPropertyFilters } from "../../lib/api";
import PropertyCard from "../../components/listings/PropertyCard";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Pagination from "../../components/ui/Pagination";
import {
  MagnifyingGlassIcon,
  BookmarkIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { SidebarInput } from "../../components/ui/sidebar";
import { Search } from "lucide-react";

export default function SearchPage() {
  const [filters, setFilters] = useState<IPropertyFilters>({
    limit: 12,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedSearches, setSavedSearches] = useState<
    Array<{ id: string; name: string; filters: IPropertyFilters }>
  >([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["properties", filters],
    queryFn: () => propertiesApi.getProperties(filters),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const handleFilterChange = (newFilters: Partial<IPropertyFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      offset: 0,
    }));
  };

  const handlePageChange = (page: number) => {
    const limit = filters.limit || 12;
    setFilters((prev) => ({
      ...prev,
      offset: (page - 1) * limit,
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
  };

  const saveSearch = () => {
    const name = prompt("Enter a name for this search:");
    if (name) {
      const newSearch = {
        id: Date.now().toString(),
        name,
        filters: { ...filters },
      };
      setSavedSearches((prev) => [...prev, newSearch]);
    }
  };

  const loadSavedSearch = (savedFilters: IPropertyFilters) => {
    setFilters({ ...savedFilters, offset: 0 });
  };

  const hasActiveFilters = Boolean(
    filters.min_price ||
      filters.max_price ||
      filters.bedrooms ||
      filters.bathrooms ||
      filters.property_type ||
      filters.location_city ||
      filters.location_suburb ||
      filters.source_website
  );

  const currentPage =
    Math.floor((filters.offset || 0) / (filters.limit || 12)) + 1;
  const totalPages = Math.ceil((data?.total || 0) / (filters.limit || 12));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Search & Filters
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Find properties with advanced search and filtering options
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={saveSearch}
            disabled={!hasActiveFilters}
            className="btn btn-secondary flex items-center space-x-2 disabled:opacity-50"
          >
            <BookmarkIcon className="h-4 w-4" />
            <span>Save Search</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card">
        <form onSubmit={handleSearch} className="relative flex flex-row items-center">
          <SidebarInput
            type="text"
            placeholder="Search by title, location, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 pr-4 w-full text-lg"
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
          <button type="submit" className="h-10 px-3 flex items-center">
            <span className="btn btn-primary">Search</span>
          </button>
        </form>
      </div>

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-secondary-900 mb-4">
            Saved Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((savedSearch) => (
              <button
                key={savedSearch.id}
                onClick={() => loadSavedSearch(savedSearch.filters)}
                className="inline-flex items-center px-3 py-2 border border-secondary-300 rounded-md text-sm bg-white hover:bg-secondary-50 transition-colors"
              >
                <BookmarkIcon className="h-4 w-4 mr-2 text-secondary-400" />
                {savedSearch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center space-x-2 text-secondary-700 hover:text-secondary-900 transition-colors"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            <span className="font-medium">
              {showAdvancedFilters ? "Hide" : "Show"} Advanced Filters
            </span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-secondary-600">View:</span>
            <div className="flex rounded-lg border border-secondary-200 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded ${viewMode === "grid" ? "bg-primary-600 text-white" : "text-secondary-600 hover:text-secondary-900"}`}
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1 rounded ${viewMode === "table" ? "bg-primary-600 text-white" : "text-secondary-600 hover:text-secondary-900"}`}
              >
                <ViewColumnsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-secondary-200">
            {/* Price Range */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Price Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min price"
                  value={filters.min_price || ""}
                  onChange={(e) =>
                    handleFilterChange({
                      min_price: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  className="input text-sm"
                />
                <input
                  type="number"
                  placeholder="Max price"
                  value={filters.max_price || ""}
                  onChange={(e) =>
                    handleFilterChange({
                      max_price: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  className="input text-sm"
                />
              </div>
            </div>

            {/* Bedrooms */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Bedrooms
              </label>
              <select
                value={filters.bedrooms || ""}
                onChange={(e) =>
                  handleFilterChange({
                    bedrooms: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="input text-sm"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <option key={num} value={num}>
                    {num}+ bedroom{num !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Bathrooms */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Bathrooms
              </label>
              <select
                value={filters.bathrooms || ""}
                onChange={(e) =>
                  handleFilterChange({
                    bathrooms: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="input text-sm"
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num}+ bathroom{num !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Property Type
              </label>
              <select
                value={filters.property_type || ""}
                onChange={(e) =>
                  handleFilterChange({
                    property_type: e.target.value || undefined,
                  })
                }
                className="input text-sm"
              >
                <option value="">Any Type</option>
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="townhouse">Townhouse</option>
                <option value="vacant land">Vacant Land</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            {/* Location - City */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                City
              </label>
              <input
                type="text"
                placeholder="Enter city name"
                value={filters.location_city || ""}
                onChange={(e) =>
                  handleFilterChange({
                    location_city: e.target.value || undefined,
                  })
                }
                className="input text-sm"
              />
            </div>

            {/* Location - Suburb */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Suburb
              </label>
              <input
                type="text"
                placeholder="Enter suburb name"
                value={filters.location_suburb || ""}
                onChange={(e) =>
                  handleFilterChange({
                    location_suburb: e.target.value || undefined,
                  })
                }
                className="input text-sm"
              />
            </div>

            {/* Source */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Source
              </label>
              <select
                value={filters.source_website || ""}
                onChange={(e) =>
                  handleFilterChange({
                    source_website: e.target.value || undefined,
                  })
                }
                className="input text-sm"
              >
                <option value="">All Sources</option>
                <option value="property24.com">Property24</option>
                <option value="privateproperty.co.za">Private Property</option>
              </select>
            </div>

            {/* Boolean Filters */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-secondary-700">
                Features
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-secondary-700">
                    Has Garage
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-secondary-700">
                    Pet Friendly
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-secondary-700">
                    Swimming Pool
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-secondary-200 mt-4">
            {filters.min_price && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                Min: R{filters.min_price.toLocaleString()}
              </span>
            )}
            {filters.max_price && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                Max: R{filters.max_price.toLocaleString()}
              </span>
            )}
            {filters.bedrooms && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.bedrooms}+ bedrooms
              </span>
            )}
            {filters.bathrooms && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.bathrooms}+ bathrooms
              </span>
            )}
            {filters.property_type && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 capitalize">
                {filters.property_type}
              </span>
            )}
            {filters.location_city && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.location_city}
              </span>
            )}
            {filters.source_website && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {filters.source_website === "property24.com"
                  ? "Property24"
                  : "Private Property"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-6">
        {/* Results Header */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-secondary-600">
            {data?.total
              ? `${data.total.toLocaleString()} properties found`
              : "No results"}
          </div>
          <select className="input text-sm">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-error-500 text-lg font-medium">
              Error loading properties
            </div>
            <p className="text-secondary-600 mt-2">
              Please try refreshing the page or adjusting your filters.
            </p>
          </div>
        )}

        {/* Properties Grid/Table */}
        {!isLoading && data?.properties && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data.properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-secondary-200">
                    <thead className="bg-secondary-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                          Property
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                          Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-secondary-200">
                      {data.properties.map((property) => (
                        <tr
                          key={property.id}
                          className="hover:bg-secondary-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-secondary-900 truncate max-w-xs">
                              {property.title}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-secondary-600">
                            {[property.location_suburb, property.location_city]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-secondary-900">
                            {property.price
                              ? `R${property.price.toLocaleString()}`
                              : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-secondary-600">
                            {[
                              property.bedrooms && `${property.bedrooms}bed`,
                              property.bathrooms && `${property.bathrooms}bath`,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </td>
                          <td className="px-6 py-4 text-sm text-secondary-600">
                            {property.source_website === "property24.com"
                              ? "Property24"
                              : "Private Property"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {data.properties.length === 0 && (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 mx-auto text-secondary-300 mb-4" />
                <h3 className="text-lg font-medium text-secondary-900 mb-2">
                  No properties found
                </h3>
                <p className="text-secondary-600">
                  Try adjusting your search terms or filters to find more
                  properties.
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
    </div>
  );
}

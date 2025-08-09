"use client";

import { useState } from "react";
import { IPropertyFilters as FilterProps } from "../../lib/api";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Search, X } from "lucide-react";
import { SidebarInput } from "../ui/sidebar";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface PropertyFiltersComponentProps {
  filters: FilterProps;
  onFilterChange: (filters: Partial<FilterProps>) => void;
}

export default function PropertyFilters({
  filters,
  onFilterChange,
}: PropertyFiltersComponentProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const propertyTypes = [
    "house",
    "apartment",
    "townhouse",
    "vacant land",
    "commercial",
  ];

  const sources = ["property24.com", "privateproperty.co.za"];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality if needed
  };

  const clearFilters = () => {
    onFilterChange({
      min_price: undefined,
      max_price: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      property_type: undefined,
      location_city: undefined,
      location_suburb: undefined,
      source_website: undefined,
    });
    setSearchTerm("");
  };

  const removeFilter = (filterKey: keyof FilterProps) => {
    onFilterChange({ [filterKey]: undefined });
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

  return (
    <div className="card space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          id="search"
          placeholder="Type to search..."
          className="h-10 pl-7"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
      </form>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="outline"
        >
          {isExpanded ? "Hide Filters" : "Show Filters"}
        </Button>

        {hasActiveFilters && (
          <Button
            onClick={clearFilters}
            variant="ghost"
            size="sm"
            className="text-secondary-600 hover:text-secondary-900"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-secondary-200">
          {/* Price Range */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Price Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.min_price || ""}
                onChange={(e) =>
                  onFilterChange({
                    min_price: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="input text-sm"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.max_price || ""}
                onChange={(e) =>
                  onFilterChange({
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
                onFilterChange({
                  bedrooms: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="input text-sm"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <option key={num} value={num}>
                  {num}+ bed{num !== 1 ? "s" : ""}
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
                onFilterChange({
                  bathrooms: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="input text-sm"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  {num}+ bath{num !== 1 ? "s" : ""}
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
                onFilterChange({ property_type: e.target.value || undefined })
              }
              className="input text-sm"
            >
              <option value="">Any Type</option>
              {propertyTypes.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type}
                </option>
              ))}
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
                onFilterChange({ location_city: e.target.value || undefined })
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
                onFilterChange({ location_suburb: e.target.value || undefined })
              }
              className="input text-sm"
            />
          </div>

          {/* Source Website */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Source
            </label>
            <select
              value={filters.source_website || ""}
              onChange={(e) =>
                onFilterChange({ source_website: e.target.value || undefined })
              }
              className="input text-sm"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source === "property24.com"
                    ? "Property24"
                    : "Private Property"}
                </option>
              ))}
            </select>
          </div>

          {/* Results Per Page */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Results Per Page
            </label>
            <select
              value={filters.limit || 12}
              onChange={(e) =>
                onFilterChange({ limit: Number(e.target.value) })
              }
              className="input text-sm"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-secondary-200">
          {filters.min_price && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Min: {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.min_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('min_price')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.max_price && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Max: {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.max_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('max_price')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.bedrooms && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.bedrooms}+ bedrooms
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('bedrooms')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.bathrooms && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.bathrooms}+ bathrooms
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('bathrooms')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.property_type && (
            <Badge variant="secondary" className="flex items-center gap-1 capitalize">
              {filters.property_type}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('property_type')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.location_city && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.location_city}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('location_city')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.location_suburb && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.location_suburb}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('location_suburb')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.source_website && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.source_website === "property24.com"
                ? "Property24"
                : "Private Property"}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('source_website')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Filter, Search, X } from "lucide-react";
import { SidebarInput } from "../ui/sidebar";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { IPropertyFilters } from "@/@types/property";

interface PropertyFiltersComponentProps {
  filters: IPropertyFilters;
  onFilterChange: (filters: Partial<IPropertyFilters>) => void;
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

  const cities = [
    "Cape Town",
    "Johannesburg", 
    "Pretoria",
    "Durban",
    "Port Elizabeth",
    "Bloemfontein"
  ];

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
      floor_area_range: undefined,
    });
    setSearchTerm("");
  };

  const removeFilter = (filterKey: keyof IPropertyFilters) => {
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
      filters.source_website ||
      filters.floor_area_range
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
        <Button onClick={() => setIsExpanded(!isExpanded)} variant="default">
          <Filter className="h-4 w-4" />
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
              <Input
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
              />
              <Input
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
              />
            </div>
          </div>

          {/* Bedrooms */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Bedrooms
            </label>
            <Select
              value={filters.bedrooms?.toString() || ""}
              onValueChange={(value) =>
                onFilterChange({
                  bedrooms: value ? Number(value) : undefined,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}+ bed{num !== 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bathrooms */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Bathrooms
            </label>
            <Select
              value={filters.bathrooms?.toString() || ""}
              onValueChange={(value) =>
                onFilterChange({
                  bathrooms: value ? Number(value) : undefined,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}+ bath{num !== 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Property Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Property Type
            </label>
            <Select
              value={filters.property_type || ""}
              onValueChange={(value) =>
                onFilterChange({ property_type: value || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any Type" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location - City */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              City
            </label>
            <Select
              value={filters.location_city || ""}
              onValueChange={(value) =>
                onFilterChange({ location_city: value || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any City" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location - Suburb */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Suburb
            </label>
            <Input
              type="text"
              placeholder="Enter suburb name"
              value={filters.location_suburb || ""}
              onChange={(e) =>
                onFilterChange({ location_suburb: e.target.value || undefined })
              }
            />
          </div>

          {/* Source Website */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Source
            </label>
            <Select
              value={filters.source_website || ""}
              onValueChange={(value) =>
                onFilterChange({ source_website: value || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                <option value="">All Sources</option>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source === "property24.com"
                      ? "Property24"
                      : "Private Property"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Floor Size */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Floor Size
            </label>
            <Select
              value={filters.floor_area_range || ""}
              onValueChange={(value) =>
                onFilterChange({
                  floor_area_range: value || undefined,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-50">Under 50 m²</SelectItem>
                <SelectItem value="50-100">50-100 m²</SelectItem>
                <SelectItem value="100-150">100-150 m²</SelectItem>
                <SelectItem value="150-200">150-200 m²</SelectItem>
                <SelectItem value="200-300">200-300 m²</SelectItem>
                <SelectItem value="300-500">300-500 m²</SelectItem>
                <SelectItem value="500+">Over 500 m²</SelectItem>
                <SelectItem value="not_listed">Size Not Listed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Per Page */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Results Per Page
            </label>
            <Select
              value={filters.limit?.toString() || "12"}
              onValueChange={(value) =>
                onFilterChange({ limit: Number(value) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
                <SelectItem value="96">96</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-secondary-200">
          {filters.min_price && (
            <Badge variant="default" className="flex items-center gap-1">
              Min:{" "}
              {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.min_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("min_price")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.max_price && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Max:{" "}
              {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.max_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("max_price")}
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
                onClick={() => removeFilter("bedrooms")}
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
                onClick={() => removeFilter("bathrooms")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.property_type && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 capitalize"
            >
              {filters.property_type}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("property_type")}
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
                onClick={() => removeFilter("location_city")}
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
                onClick={() => removeFilter("location_suburb")}
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
                onClick={() => removeFilter("source_website")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.floor_area_range && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {filters.floor_area_range === "not_listed"
                ? "Size Not Listed"
                : filters.floor_area_range === "0-50"
                  ? "Under 50 m²"
                  : filters.floor_area_range === "500+"
                    ? "Over 500 m²"
                    : filters.floor_area_range.replace("-", "-") + " m²"}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("floor_area_range")}
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

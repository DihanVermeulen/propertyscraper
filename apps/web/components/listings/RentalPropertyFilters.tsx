"use client";

import { useState } from "react";
import { IRentalPropertyFilters } from "../../lib/api";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Filter, Search, X } from "lucide-react";
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

interface IRentalPropertyFiltersProps {
  filters: IRentalPropertyFilters;
  onFilterChange: (filters: Partial<IRentalPropertyFilters>) => void;
}

export default function RentalPropertyFilters({
  filters,
  onFilterChange,
}: IRentalPropertyFiltersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const propertyTypes = [
    "house",
    "apartment",
    "townhouse",
    "studio",
    "commercial",
  ];

  const cities = [
    "Somerset West",
    "Cape Town", 
    "Johannesburg",
    "Pretoria",
    "Durban"
  ];

  const sources = ["property24.com", "privateproperty.co.za"];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality if needed
  };

  const clearFilters = () => {
    onFilterChange({
      min_rental_price: undefined,
      max_rental_price: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      property_type: undefined,
      location_city: undefined,
      location_suburb: undefined,
      source_website: undefined,
      furnished_status: undefined,
      pet_policy: undefined,
      available_from: undefined,
    });
    setSearchTerm("");
  };

  const removeFilter = (filterKey: keyof IRentalPropertyFilters) => {
    onFilterChange({ [filterKey]: undefined });
  };

  const hasActiveFilters = Boolean(
    filters.min_rental_price ||
      filters.max_rental_price ||
      filters.bedrooms ||
      filters.bathrooms ||
      filters.property_type ||
      filters.location_city ||
      filters.location_suburb ||
      filters.source_website ||
      filters.furnished_status ||
      filters.pet_policy ||
      filters.available_from
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
                value={filters.min_rental_price || ""}
                onChange={(e) =>
                  onFilterChange({
                    min_rental_price: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.max_rental_price || ""}
                onChange={(e) =>
                  onFilterChange({
                    max_rental_price: e.target.value
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

          {/* Furnished Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Furnished Status
            </label>
            <Select
              value={filters.furnished_status || ""}
              onValueChange={(value) =>
                onFilterChange({ furnished_status: value as any || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="furnished">Furnished</SelectItem>
                <SelectItem value="semi-furnished">Semi-Furnished</SelectItem>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pet Policy */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Pet Policy
            </label>
            <Select
              value={filters.pet_policy || ""}
              onValueChange={(value) =>
                onFilterChange({ pet_policy: value as any || undefined })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any" className="w-full" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allowed">Pets Allowed</SelectItem>
                <SelectItem value="not_allowed">No Pets</SelectItem>
                <SelectItem value="cats_only">Cats Only</SelectItem>
                <SelectItem value="dogs_only">Dogs Only</SelectItem>
                <SelectItem value="negotiable">Negotiable</SelectItem>
              </SelectContent>
            </Select>
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

          {/* Available From */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">
              Available From
            </label>
            <Input
              type="date"
              value={filters.available_from || ""}
              onChange={(e) =>
                onFilterChange({ available_from: e.target.value || undefined })
              }
            />
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
          {filters.min_rental_price && (
            <Badge variant="default" className="flex items-center gap-1">
              Min:{" "}
              {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.min_rental_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("min_rental_price")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.max_rental_price && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Max:{" "}
              {new Intl.NumberFormat("en-ZA", {
                style: "currency",
                currency: "ZAR",
                minimumFractionDigits: 0,
              }).format(filters.max_rental_price)}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("max_rental_price")}
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
          {filters.furnished_status && (
            <Badge variant="secondary" className="flex items-center gap-1 capitalize">
              {filters.furnished_status.replace('_', ' ')}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("furnished_status")}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.pet_policy && (
            <Badge variant="secondary" className="flex items-center gap-1 capitalize">
              {filters.pet_policy.replace('_', ' ')}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("pet_policy")}
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
          {filters.available_from && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Available: {filters.available_from}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter("available_from")}
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

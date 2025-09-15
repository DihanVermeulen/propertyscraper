"use client";

import { useState } from "react";
import {
  MapPinIcon,
  HomeIcon,
  BanknotesIcon,
  CalendarIcon,
  LinkIcon,
  CalculatorIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { Button } from "../ui/button";
import YieldCalculatorModal from "./YieldCalculatorModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Menu, TriangleAlert, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi } from "@/lib/api";
import { IProperty, IPropertiesResponse } from "@repo/core/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { toast } from "sonner";

interface PropertyCardProps {
  property: IProperty;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const [showCalculator, setShowCalculator] = useState(false);
  const queryClient = useQueryClient();

  // Helper function to update property status optimistically
  const updatePropertyStatus = (targetStatus: boolean) => {
    queryClient.setQueriesData<IPropertiesResponse>(
      { queryKey: ['properties-for-sale'] },
      (oldData) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          properties: oldData.properties.map((p) => 
            p.id === property.id 
              ? { ...p, is_active: targetStatus, updated_at: new Date().toISOString() }
              : p
          ),
          // Adjust total count based on status change
          total: targetStatus 
            ? oldData.total + 1  // Reactivating: increase count
            : Math.max(0, oldData.total - 1) // Deactivating: decrease count
        };
      }
    );
  };

  // Optimistic mutation for deactivating property
  const { mutate: deactivateProperty, isPending: isDeactivating } = useMutation({
    mutationFn: () => propertiesApi.deactivateProperty(property.id),
    
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['properties-for-sale'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['properties-for-sale'] });
      
      updatePropertyStatus(false); // Optimistically deactivate
      
      return { previousQueries };
    },
    
    onSuccess: () => {
      toast.success('Property deactivated successfully', {
        description: `"${property.title}" has been removed from active listings.`,
        duration: 4000,
      });
    },
    
    onError: (error, variables, context) => {
      console.error('Failed to deactivate property:', error);
      
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast.error('Failed to deactivate property', {
        description: 'Please try again or contact support if the problem persists.',
        duration: 5000,
      });
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['properties-for-sale'] });
    },
  });

  // Optimistic mutation for reactivating property
  const { mutate: reactivateProperty, isPending: isReactivating } = useMutation({
    mutationFn: () => propertiesApi.reactivateProperty(property.id),
    
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['properties-for-sale'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['properties-for-sale'] });
      
      updatePropertyStatus(true); // Optimistically reactivate
      
      return { previousQueries };
    },
    
    onSuccess: () => {
      toast.success('Property reactivated successfully', {
        description: `"${property.title}" is now active again.`,
        duration: 4000,
      });
    },
    
    onError: (error, variables, context) => {
      console.error('Failed to reactivate property:', error);
      
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast.error('Failed to reactivate property', {
        description: 'Please try again or contact support if the problem persists.',
        duration: 5000,
      });
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['properties-for-sale'] });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSourceDisplayName = (source: string) => {
    switch (source) {
      case "property24.com":
        return "Property24";
      case "privateproperty.co.za":
        return "Private Property";
      default:
        return source;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "property24.com":
        return "bg-blue-100 text-blue-800";
      case "privateproperty.co.za":
        return "bg-green-100 text-green-800";
      default:
        return "bg-secondary-100 text-secondary-800";
    }
  };

  const handleDeactivate = () => {
    const action = property.is_active ? 'deactivate' : 'reactivate';
    const confirmMessage = property.is_active 
      ? `Are you sure you want to deactivate "${property.title}"?`
      : `Are you sure you want to reactivate "${property.title}"?`;
      
    if (window.confirm(confirmMessage)) {
      if (property.is_active) {
        deactivateProperty();
      } else {
        reactivateProperty();
      }
    }
  };

  const isPending = isDeactivating || isReactivating;

  return (
    <div className={`card hover:shadow-strong transition-shadow duration-200 cursor-pointer group ${
      !property.is_active ? 'opacity-60 grayscale' : ''
    } ${isPending ? 'pointer-events-none' : ''}`}>
      {/* Image */}
      <div className="relative h-48 mb-4 bg-secondary-100 rounded-lg overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <img
            src={property.images[0]}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/house-placeholder.svg";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HomeIcon className="h-16 w-16 text-secondary-300" />
          </div>
        )}

        {/* Source Badge */}
        <div className="absolute bottom-3 right-3 flex gap-2">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(property.source_website)}`}
          >
            {getSourceDisplayName(property.source_website)}
          </span>
          {!property.is_active && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
              Inactive
            </span>
          )}
          {isPending && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              {isDeactivating ? 'Deactivating...' : 'Reactivating...'}
            </span>
          )}
        </div>

        {/* Property Warnings */}
        {property.expense_scraping_status === "skipped" && (
          <div className="absolute top-3 left-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="bg-orange-100 text-orange-600 hover:bg-orange-200 focus:bg-orange-200 dark:bg-orange-100 dark:text-orange-600 dark:hover:bg-orange-200 dark:focus:bg-orange-200 dark:hover:text-orange-600">
                  <TriangleAlert className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="bg-orange-100 text-orange-600">
                <ul className="list-disc list-inside text-orange-600">
                  <li>Expense scraping skipped</li>
                </ul>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Menu */}
        <div className="absolute top-3 right-3">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                variant={"ghost"}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCalculator(true);
                }}
                disabled={isPending}
              >
                <CalculatorIcon className="h-4 w-4 mr-2" />
                Calculate Yield
              </DropdownMenuItem>
              
              {property.is_active ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDeactivate}
                  disabled={isPending}
                >
                  {isDeactivating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    <>
                      <Menu className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  )}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="ghost"
                  onClick={handleDeactivate}
                  disabled={isPending}
                >
                  <Menu className="h-4 w-4 mr-2" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Price */}
        {property.price && (
          <div className="flex items-center space-x-2">
            <BanknotesIcon className="h-5 w-5 text-success-600" />
            <span className="text-xl font-bold text-secondary-900">
              {formatCurrency(property.price)}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-secondary-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {property.title}
        </h3>

        {/* Location */}
        {(property.location_suburb || property.location_city) && (
          <div className="flex items-center space-x-2 text-secondary-600">
            <MapPinIcon className="h-4 w-4" />
            <span className="text-sm">
              {[property.location_suburb, property.location_city]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}

        {/* Property Details */}
        <div className="flex items-center space-x-4 text-sm text-secondary-600">
          {property.bedrooms && (
            <span>
              {property.bedrooms} bed{property.bedrooms !== 1 ? "s" : ""}
            </span>
          )}
          {property.bathrooms && (
            <span>
              {property.bathrooms} bath{property.bathrooms !== 1 ? "s" : ""}
            </span>
          )}
          {property.parking_spaces && (
            <span>{property.parking_spaces} parking</span>
          )}
          {property.floor_area && <span>{property.floor_area} m²</span>}
        </div>

        {/* Property Type */}
        {property.property_type && (
          <div className="inline-block">
            <span className="px-3 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full capitalize">
              {property.property_type}
            </span>
          </div>
        )}

        {/* Scraped Date */}
        <div className="flex items-center justify-between text-xs text-secondary-500 pt-2 border-t border-secondary-100">
          <div className="flex items-center space-x-1">
            <CalendarIcon className="h-3 w-3" />
            <span>
              Scraped {format(new Date(property.scraped_at), "MMM dd, yyyy")}
            </span>
          </div>

          {/* External Link */}
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-primary-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span>View Original</span>
            <LinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Yield Calculator Modal */}
      <YieldCalculatorModal
        key={showCalculator ? `calculator-${property.id}` : "calculator-closed"}
        property={property}
        isOpen={showCalculator}
        onClose={() => {
          console.log("Closing calculator modal");
          setShowCalculator(false);
        }}
      />
    </div>
  );
}

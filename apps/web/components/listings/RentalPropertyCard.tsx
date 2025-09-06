'use client';

import { useState } from 'react';
import { IRentalProperty } from '../../lib/api';
import { 
  MapPinIcon, 
  HomeIcon, 
  BanknotesIcon,
  CalendarIcon,
  LinkIcon,
  ShieldCheckIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface IRentalPropertyCardProps {
  property: IRentalProperty;
}

export default function RentalPropertyCard({ property }: IRentalPropertyCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSourceDisplayName = (source: string) => {
    switch (source) {
      case 'property24.com':
        return 'Property24';
      case 'privateproperty.co.za':
        return 'Private Property';
      default:
        return source;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'property24.com':
        return 'bg-blue-100 text-blue-800';
      case 'privateproperty.co.za':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-secondary-100 text-secondary-800';
    }
  };

  const getFurnishedColor = (status: string) => {
    switch (status) {
      case 'furnished': return 'bg-green-100 text-green-800';
      case 'semi-furnished': return 'bg-yellow-100 text-yellow-800';
      case 'unfurnished': return 'bg-secondary-100 text-secondary-800';
      default: return 'bg-secondary-100 text-secondary-800';
    }
  };

  const getPetPolicyIcon = (policy: string) => {
    switch (policy) {
      case 'allowed': return '🐕';
      case 'cats_only': return '🐱';
      case 'dogs_only': return '🐕';
      case 'not_allowed': return '🚫';
      default: return '❓';
    }
  };

  const formatPetPolicy = (policy: string) => {
    switch (policy) {
      case 'allowed': return 'Pets Allowed';
      case 'cats_only': return 'Cats Only';
      case 'dogs_only': return 'Dogs Only';
      case 'not_allowed': return 'No Pets';
      case 'negotiable': return 'Pets Negotiable';
      default: return 'Pet Policy Unknown';
    }
  };

  return (
    <div className="card hover:shadow-strong transition-shadow duration-200 cursor-pointer group">
      {/* Image */}
      <div className="relative h-48 mb-4 bg-secondary-100 rounded-lg overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <img
            src={property.images[0]}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/house-placeholder.svg';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HomeIcon className="h-16 w-16 text-secondary-300" />
          </div>
        )}
        
        {/* Source Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(property.source_website)}`}>
            {getSourceDisplayName(property.source_website)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Price */}
        {property.rental_price && (
          <div className="flex items-center space-x-2">
            <BanknotesIcon className="h-5 w-5 text-success-600" />
            <div>
              <span className="text-xl font-bold text-secondary-900">
                {formatCurrency(property.rental_price)}
              </span>
              <span className="text-sm text-secondary-600 ml-1">
                / {property.rental_period}
              </span>
            </div>
          </div>
        )}

        {/* Deposit */}
        {property.deposit && (
          <div className="text-sm text-secondary-600">
            Deposit: {formatCurrency(property.deposit)}
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
              {[property.location_suburb, property.location_city].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Property Details */}
        <div className="flex items-center space-x-4 text-sm text-secondary-600">
          {property.bedrooms && (
            <span>{property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}</span>
          )}
          {property.bathrooms && (
            <span>{property.bathrooms} bath{property.bathrooms !== 1 ? 's' : ''}</span>
          )}
          {property.parking_spaces && (
            <span>{property.parking_spaces} parking</span>
          )}
          {property.floor_area && (
            <span>{property.floor_area} m²</span>
          )}
        </div>

        {/* Property Type */}
        <div className="flex items-center space-x-2 flex-wrap">
          {property.property_type && (
            <span className="px-3 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full capitalize">
              {property.property_type}
            </span>
          )}
          {property.furnished_status && (
            <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${getFurnishedColor(property.furnished_status)}`}>
              {property.furnished_status.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Rental-Specific Features */}
        <div className="space-y-2">
          {/* Available Date */}
          {property.available_date && (
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <CalendarIcon className="h-4 w-4" />
              <span>Available: {format(new Date(property.available_date), 'MMM dd, yyyy')}</span>
            </div>
          )}

          {/* Pet Policy */}
          {property.pet_policy && (
            <div className="flex items-center space-x-2 text-sm text-secondary-600">
              <span>{getPetPolicyIcon(property.pet_policy)}</span>
              <span>{formatPetPolicy(property.pet_policy)}</span>
            </div>
          )}

          {/* Utilities Included */}
          {property.utilities_included && property.utilities_included.length > 0 && (
            <div className="flex items-start space-x-2 text-sm text-secondary-600">
              <WifiIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {property.utilities_included.map((utility, index) => (
                  <span key={index} className="px-2 py-1 bg-secondary-100 text-secondary-800 text-xs rounded">
                    {utility}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lease Terms */}
        {property.lease_terms && (
          <div className="flex items-center space-x-2 text-sm text-secondary-600">
            <ShieldCheckIcon className="h-4 w-4" />
            <span className="line-clamp-1" title={property.lease_terms}>
              {property.lease_terms}
            </span>
          </div>
        )}

        {/* Agent Info */}
        {property.agent_name && (
          <div className="text-sm text-secondary-600 pt-2 border-t border-secondary-100">
            Listed by {property.agent_name}
            {property.agent_phone && (
              <span className="ml-2">{property.agent_phone}</span>
            )}
          </div>
        )}

        {/* Scraped Date */}
        <div className="flex items-center justify-between text-xs text-secondary-500 pt-2 border-t border-secondary-100">
          <div className="flex items-center space-x-1">
            <CalendarIcon className="h-3 w-3" />
            <span>Scraped {format(new Date(property.scraped_at), 'MMM dd, yyyy')}</span>
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
    </div>
  );
}

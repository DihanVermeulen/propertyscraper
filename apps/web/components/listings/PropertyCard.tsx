'use client';

import { Property } from '../../lib/api';
import { 
  MapPinIcon, 
  HomeIcon, 
  BanknotesIcon,
  CalendarIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
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

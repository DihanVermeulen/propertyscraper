'use client';

import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../../lib/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { MapPinIcon, HomeIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function LocationsPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: propertiesApi.getDashboardStats,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-error-500 text-lg font-medium">
          Error loading location data
        </div>
        <p className="text-secondary-600 mt-2">
          Please try refreshing the page or check your connection.
        </p>
      </div>
    );
  }

  const locations = stats?.top_locations || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Properties by Location
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Browse properties grouped by city and region
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-primary-100 p-3 rounded-lg">
                <MapPinIcon className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Total Locations
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {locations.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-success-100 p-3 rounded-lg">
                <HomeIcon className="h-6 w-6 text-success-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Total Properties
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {locations.reduce((sum, loc) => sum + loc.count, 0).toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-warning-100 p-3 rounded-lg">
                <ArrowTrendingUpIcon className="h-6 w-6 text-warning-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Avg Market Price
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {locations.length > 0 
                    ? formatCurrency(locations.reduce((sum, loc) => sum + loc.avg_price, 0) / locations.length)
                    : 'N/A'
                  }
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Location Grid */}
      {locations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location, index) => (
            <Link
              key={location.location_city}
              href={`/listings?location_city=${encodeURIComponent(location.location_city)}`}
              className="group"
            >
              <div className="card hover:shadow-strong transition-all duration-200 cursor-pointer group-hover:scale-[1.02] transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-yellow-600' :
                      'bg-primary-600'
                    }`}>
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-semibold text-secondary-900 group-hover:text-primary-600 transition-colors">
                      {location.location_city}
                    </h3>
                  </div>
                  <MapPinIcon className="h-5 w-5 text-secondary-400 group-hover:text-primary-500 transition-colors" />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-secondary-600">Properties</span>
                    <span className="text-lg font-bold text-secondary-900">
                      {location.count.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-secondary-600">Avg Price</span>
                    <span className="text-lg font-bold text-success-600">
                      {formatCurrency(location.avg_price)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-secondary-500">
                      <span>Market Share</span>
                      <span>
                        {((location.count / locations.reduce((sum, loc) => sum + loc.count, 0)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-500 group-hover:bg-primary-700"
                        style={{
                          width: `${(location.count / Math.max(...locations.map(l => l.count))) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-secondary-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary-500">
                      Click to view properties
                    </span>
                    <div className="transform group-hover:translate-x-1 transition-transform duration-200">
                      <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <MapPinIcon className="h-16 w-16 mx-auto text-secondary-300 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            No location data available
          </h3>
          <p className="text-secondary-600">
            Properties will be grouped by location once data is scraped.
          </p>
        </div>
      )}

      {/* Location Heatmap Placeholder */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">
            Property Distribution Map
          </h3>
          <span className="text-sm text-secondary-500">
            Coming Soon
          </span>
        </div>
        
        <div className="h-64 bg-secondary-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <MapPinIcon className="h-12 w-12 mx-auto text-secondary-400 mb-4" />
            <p className="text-lg font-medium text-secondary-500">Interactive Map</p>
            <p className="text-sm text-secondary-400 mt-1">
              Visual heatmap of property distribution across regions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

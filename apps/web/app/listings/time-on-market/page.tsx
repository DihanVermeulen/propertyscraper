'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../../lib/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { HomeIcon, MapPinIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';

export default function TimeOnMarketPage() {
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [minDays, setMinDays] = useState('');
  const [maxDays, setMaxDays] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: propertiesApi.getDashboardStats,
  });

  const { data: timeOnMarketData, isLoading: timeOnMarketLoading } = useQuery({
    queryKey: ['time-on-market-detailed', selectedLocation, minDays, maxDays],
    queryFn: () => propertiesApi.getTimeOnMarketStats({
      location_city: selectedLocation === 'all' ? undefined : selectedLocation,
      min_days: minDays ? parseInt(minDays) : undefined,
      max_days: maxDays ? parseInt(maxDays) : undefined,
      limit: 100
    }),
  });

  const isLoading = statsLoading || timeOnMarketLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTimeOnMarketColor = (days: number) => {
    if (days < 30) return 'text-success-700 bg-success-100';
    if (days < 90) return 'text-warning-700 bg-warning-100';
    if (days < 180) return 'text-orange-700 bg-orange-100';
    return 'text-error-700 bg-error-100';
  };

  const getTimeOnMarketLabel = (days: number) => {
    if (days < 30) return 'Fresh';
    if (days < 90) return 'Active';
    if (days < 180) return 'Stale';
    return 'Very Stale';
  };

  const applyTimeRangeFilter = (range: string) => {
    setSelectedTimeRange(range);
    switch (range) {
      case 'fresh':
        setMinDays('');
        setMaxDays('29');
        break;
      case 'active':
        setMinDays('30');
        setMaxDays('89');
        break;
      case 'stale':
        setMinDays('90');
        setMaxDays('179');
        break;
      case 'very-stale':
        setMinDays('180');
        setMaxDays('');
        break;
      default:
        setMinDays('');
        setMaxDays('');
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Time on Market Analysis
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Track how long properties have been listed and identify market trends
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Location
            </label>
            <Select
              value={selectedLocation}
              onValueChange={(value) => setSelectedLocation(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Locations</SelectLabel>
                  <SelectItem value="all">All Locations</SelectItem>
                  {stats?.top_locations?.map((location) => (
                    <SelectItem key={location.location_city} value={location.location_city}>
                      {location.location_city}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Time Range
            </label>
            <Select
              value={selectedTimeRange}
              onValueChange={(value) => applyTimeRangeFilter(value)}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder="Select Time Range" />
              </SelectTrigger>
              <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Time Range</SelectLabel>
                    <SelectItem value="all">All Properties</SelectItem>
                    <SelectItem value="fresh">Fresh (Under 30 days)</SelectItem>
                    <SelectItem value="active">Active (30-89 days)</SelectItem>
                    <SelectItem value="stale">Stale (90-179 days)</SelectItem>
                    <SelectItem value="very-stale">Very Stale (180+ days)</SelectItem>
                  </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Min Days
            </label>
            <Input
              type="number"
              value={minDays}
              onChange={(e) => setMinDays(e.target.value)}
              className="w-full"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Max Days
            </label>
            <Input
              type="number"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value)}
              className="w-full"
              placeholder="No limit"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-primary-100 p-3 rounded-lg">
                <HomeIcon className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Total Properties
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.total_properties?.toLocaleString() || '0'}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-success-100 p-3 rounded-lg">
                <ClockIcon className="h-6 w-6 text-success-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Average Days
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.avg_days_on_market || 0}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-warning-100 p-3 rounded-lg">
                <ClockIcon className="h-6 w-6 text-warning-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Longest Listed
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.max_days_on_market || 0} days
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-info-100 p-3 rounded-lg">
                <ClockIcon className="h-6 w-6 text-info-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Shortest Listed
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.min_days_on_market || 0} days
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div> */}

      {/* Properties List */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">
            Properties ({timeOnMarketData?.properties?.length || 0})
          </h3>
        </div>

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
                  Days on Market
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Listed Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              {timeOnMarketData?.properties?.map((property) => (
                <tr key={property.id} className="hover:bg-secondary-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <HomeIcon className="h-10 w-10 text-secondary-400" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-secondary-900 line-clamp-2">
                          {property.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-secondary-500">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      <span>
                        {property.location_suburb && `${property.location_suburb}, `}
                        {property.location_city}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm">
                      <CurrencyDollarIcon className="h-4 w-4 text-secondary-400 mr-1" />
                      <span className="font-medium text-secondary-900">
                        {formatCurrency(property.price)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-secondary-900">
                      {property.days_on_market} days
                    </div>
                    <div className="text-xs text-secondary-500">
                      {formatDistanceToNow(parseISO(property.listing_date || property.scraped_at), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-secondary-500">
                    {property.listing_date ? 
                      new Date(property.listing_date).toLocaleDateString() :
                      new Date(property.scraped_at).toLocaleDateString()
                    }
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTimeOnMarketColor(property.days_on_market)}`}>
                      {getTimeOnMarketLabel(property.days_on_market)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(!timeOnMarketData?.properties || timeOnMarketData.properties.length === 0) && (
            <div className="text-center py-12">
              <HomeIcon className="mx-auto h-12 w-12 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">No properties found</h3>
              <p className="mt-1 text-sm text-secondary-500">
                Try adjusting your filters to see more results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

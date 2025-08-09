'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';

interface LocationData {
  location_city: string;
  count: number;
  avg_price: number;
}

interface LocationStatsProps {
  data: LocationData[];
}

export default function LocationStats({ data }: LocationStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const maxCount = Math.max(...data.map(item => item.count));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">
          Top Locations
        </h3>
        <span className="text-sm text-secondary-500">
          By property count
        </span>
      </div>
      
      {data.length > 0 ? (
        <div className="space-y-4">
          {data.map((location, index) => (
            <div key={location.location_city} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-600">
                  {index + 1}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <MapPinIcon className="h-4 w-4 text-secondary-400" />
                  <p className="text-sm font-medium text-secondary-900 truncate">
                    {location.location_city}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1 bg-secondary-200 rounded-full h-2 mr-4">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
                        width: `${(location.count / maxCount) * 100}%`
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-semibold text-secondary-900">
                      {location.count.toLocaleString()}
                    </span>
                    <span className="text-secondary-500">
                      {formatCurrency(location.avg_price)} avg
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-secondary-500">
          <MapPinIcon className="h-12 w-12 mx-auto mb-4 text-secondary-300" />
          <p className="text-lg font-medium">No location data available</p>
          <p className="text-sm mt-1">Properties will be grouped by location once scraped</p>
        </div>
      )}
    </div>
  );
}

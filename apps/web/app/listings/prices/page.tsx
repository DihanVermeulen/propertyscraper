'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '../../../lib/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { ChartBarIcon, ArrowDownTrayIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from 'chart.js';
import { format, subDays, parseISO } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

export default function PriceHistoryPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [selectedLocation, setSelectedLocation] = useState('all');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: propertiesApi.getDashboardStats,
  });

  const { data: priceHistoryData, isLoading: priceHistoryLoading } = useQuery({
    queryKey: ['price-history', selectedTimeRange, selectedLocation],
    queryFn: () => propertiesApi.getPriceHistoryData({
      days: parseInt(selectedTimeRange),
      location_city: selectedLocation === 'all' ? undefined : selectedLocation,
    }),
  });

  const { data: timeOnMarketData, isLoading: timeOnMarketLoading } = useQuery({
    queryKey: ['time-on-market', selectedLocation],
    queryFn: () => propertiesApi.getTimeOnMarketStats({
      location_city: selectedLocation === 'all' ? undefined : selectedLocation,
      limit: 100
    }),
  });

  const isLoading = statsLoading || priceHistoryLoading || timeOnMarketLoading;

  // Prepare chart data from real API response
  const aggregatedHistory = priceHistoryData?.aggregated_history || [];
  const chartData = {
    labels: aggregatedHistory.map(d => format(parseISO(d.date), 'MMM dd')).reverse(),
    datasets: [
      {
        label: 'Average Price',
        data: aggregatedHistory.map(d => d.avg_price).reverse(),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#374151',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context: { parsed: { y: number } }) {
            return `Price: R${context.parsed.y.toLocaleString()}`;
          }
        }
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        grid: { 
          display: false 
        },
        ticks: { 
          color: '#6b7280', 
          font: { size: 12 } 
        },
      },
      y: {
        type: 'linear' as const,
        beginAtZero: false,
        grid: { 
          color: '#f3f4f6' 
        },
        ticks: {
          color: '#6b7280',
          font: { size: 12 },
          callback: function(value: number | string) {
            const numValue = typeof value === 'string' ? parseFloat(value) : value;
            return 'R' + (numValue / 1000000).toFixed(1) + 'M';
          }
        },
      },
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadCSV = () => {
    const csvContent = [
      ['Date', 'Average Price', 'Property Count', 'Price Changes'],
      ...aggregatedHistory.map(d => [d.date, d.avg_price, d.property_count, d.price_changes])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-history-${selectedLocation}-${selectedTimeRange}days.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const currentPrice = aggregatedHistory[0]?.avg_price || 0;
  const previousPrice = aggregatedHistory[1]?.avg_price || 0;
  const priceChange = currentPrice - previousPrice;
  const priceChangePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;
  
  // Time on market stats
  const avgTimeOnMarket = timeOnMarketData?.summary?.avg_days_on_market || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Price History
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Analyze property price trends and market movements over time
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={downloadCSV}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Time Range
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="input w-full"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 3 months</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="input w-full"
            >
              <option value="all">All Locations</option>
              {stats?.top_locations?.map((location) => (
                <option key={location.location_city} value={location.location_city}>
                  {location.location_city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Property Type
            </label>
            <select className="input w-full">
              <option value="all">All Types</option>
              <option value="house">Houses</option>
              <option value="apartment">Apartments</option>
              <option value="townhouse">Townhouses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Price Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="bg-primary-100 p-3 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-primary-600" />
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Current Avg Price
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {formatCurrency(currentPrice)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`p-3 rounded-lg ${priceChange >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
                <svg 
                  className={`h-6 w-6 ${priceChange >= 0 ? 'text-success-600' : 'text-error-600'}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d={priceChange >= 0 ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} 
                  />
                </svg>
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Daily Change
                </dt>
                <dd className={`text-lg font-semibold ${priceChange >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                  {priceChange >= 0 ? '+' : ''}{formatCurrency(priceChange)}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`p-3 rounded-lg ${priceChangePercent >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
                <span className={`text-lg font-bold ${priceChangePercent >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                  %
                </span>
              </div>
            </div>
            <div className="ml-5">
              <dl>
                <dt className="text-sm font-medium text-secondary-500">
                  Percentage Change
                </dt>
                <dd className={`text-lg font-semibold ${priceChangePercent >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                  {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
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
                  Avg Time on Market
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {avgTimeOnMarket} days
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Price Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">
            Price Trend - {selectedLocation === 'all' ? 'All Locations' : selectedLocation}
          </h3>
          <div className="flex items-center space-x-2 text-sm text-secondary-500">
            <CalendarIcon className="h-4 w-4" />
            <span>Last {selectedTimeRange} days</span>
          </div>
        </div>
        
        <div className="h-80">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Price Breakdown by Location */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">
            Price Trends by Location
          </h3>
          <span className="text-sm text-secondary-500">
            Average prices in major areas
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats?.top_locations?.slice(0, 6).map((location, index) => {
            const mockChange = (Math.random() - 0.5) * 0.1;
            const isPositive = mockChange > 0;
            
            return (
              <div key={location.location_city} className="p-4 bg-secondary-50 rounded-lg hover:bg-secondary-100 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-secondary-900 group-hover:text-primary-600 transition-colors">
                    {location.location_city}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isPositive ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700'
                  }`}>
                    {isPositive ? '+' : ''}{(mockChange * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-lg font-bold text-secondary-900">
                  {formatCurrency(location.avg_price)}
                </div>
                <div className="text-sm text-secondary-500 mt-1">
                  {location.count} properties
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time on Market Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Time on Market Distribution
            </h3>
          </div>
          
          {timeOnMarketData?.summary && (
            <div className="space-y-4">
              {Object.entries(timeOnMarketData.summary.time_ranges).map(([range, count]) => {
                const total = Object.values(timeOnMarketData.summary.time_ranges).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                
                return (
                  <div key={range} className="flex items-center justify-between">
                    <span className="text-sm text-secondary-600">{range}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-32 bg-secondary-200 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-secondary-900 w-12 text-right">
                        {count}
                      </span>
                      <span className="text-xs text-secondary-500 w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-secondary-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-secondary-500">Average</p>
                <p className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.avg_days_on_market || 0} days
                </p>
              </div>
              <div>
                <p className="text-xs text-secondary-500">Longest Listed</p>
                <p className="text-lg font-semibold text-secondary-900">
                  {timeOnMarketData?.summary?.max_days_on_market || 0} days
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Price Distribution
            </h3>
          </div>
          
          {priceHistoryData?.price_distribution && (
            <div className="h-64">
              <Doughnut 
                data={{
                  labels: priceHistoryData.price_distribution.map(d => d.price_range),
                  datasets: [{
                    data: priceHistoryData.price_distribution.map(d => d.count),
                    backgroundColor: [
                      '#ef4444', // red-500
                      '#f97316', // orange-500  
                      '#eab308', // yellow-500
                      '#22c55e', // green-500
                      '#3b82f6', // blue-500
                    ],
                    borderWidth: 0,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const label = context.label || '';
                          const value = context.parsed;
                          const total = priceHistoryData.price_distribution.reduce((sum, d) => sum + d.count, 0);
                          const percentage = ((value / total) * 100).toFixed(1);
                          return `${label}: ${value} properties (${percentage}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

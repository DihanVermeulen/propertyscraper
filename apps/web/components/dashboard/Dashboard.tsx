'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi, scraperApi } from '../../lib/api';
import { PlayIcon, ChartBarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import StatsCards from './StatsCards';
import RecentActivity from './RecentActivity';
import LocationStats from './LocationStats';
import SourceDistribution from './SourceDistribution';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false);
  
  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: propertiesApi.getDashboardStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRunAllScrapers = async () => {
    setIsRunning(true);
    try {
      await scraperApi.runAllScrapers();
      // Refetch stats after scraping
      setTimeout(() => {
        refetch();
      }, 2000);
    } catch (error) {
      console.error('Error running scrapers:', error);
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-error-500 text-lg font-medium">
          Error loading dashboard data
        </div>
        <p className="text-secondary-600 mt-2">
          Please try refreshing the page or check your connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Property Dashboard</h1>
            <p className="text-blue-100 text-lg">
              Real-time property scraping analytics and insights
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRunAllScrapers}
              disabled={isRunning}
              className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:bg-white/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg"
            >
              {isRunning ? (
                <>
                  <div className="loading-spinner border-white border-t-transparent" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  <span>Run All Scrapers</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCards stats={stats} />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity data={stats?.recent_activity || []} />
        <SourceDistribution data={stats?.source_distribution || []} />
      </div>

      {/* Location Statistics */}
      <LocationStats data={stats?.top_locations || []} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scraperApi, ScraperConfig } from '../../lib/api';
import ScraperStatus from '../../components/scraper/ScraperStatus';
import ScraperJobs from '../../components/scraper/ScraperJobs';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { PlayIcon } from '@heroicons/react/24/outline';
import { southAfricanLocations, provinces } from '../../lib/locations';

// ScraperConfig is now imported from api.ts

export default function ScraperPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [scraperConfig, setScraperConfig] = useState<ScraperConfig>({
    location: {
      city: 'Somerset West',
      province: 'Western Cape',
      country: 'South Africa',
      p24_id: '390' // Default to Somerset West
    },
    maxPages: 20,
    priceRange: {},
    propertyTypes: []
  });
  const queryClient = useQueryClient();

  const { data: scraperStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['scraper-status'],
    queryFn: scraperApi.getScraperStatus,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: scrapeJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: () => scraperApi.getScrapeJobs(50),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const runScraperMutation = useMutation({
    mutationFn: ({ source, config }: { source: string; config: ScraperConfig }) => scraperApi.runScraper(source, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const runAllScrapersMutation = useMutation({
    mutationFn: scraperApi.runAllScrapers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const handleRunScraper = async (source: string) => {
    console.log('handleRunScraper called with source:', source);
    
    // Prevent duplicate calls
    if (isRunning || runScraperMutation.isPending) {
      console.log('Scraper already running, ignoring duplicate call');
      return;
    }
    
    setIsRunning(true);
    try {
      console.log('Starting scraper mutation for:', source, 'with config:', scraperConfig);
      await runScraperMutation.mutateAsync({ source, config: scraperConfig });
      console.log('Scraper mutation completed for:', source);
    } catch (error) {
      console.error('Error running scraper:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunAllScrapers = async () => {
    console.log('handleRunAllScrapers called');
    
    // Prevent duplicate calls
    if (isRunning || runAllScrapersMutation.isPending) {
      console.log('All scrapers already running, ignoring duplicate call');
      return;
    }
    
    setIsRunning(true);
    try {
      console.log('Starting all scrapers mutation');
      await runAllScrapersMutation.mutateAsync();
      console.log('All scrapers mutation completed');
    } catch (error) {
      console.error('Error running all scrapers:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Scraper Controls
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Manage and monitor property scraping operations
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
          <button
            onClick={handleRunAllScrapers}
            disabled={isRunning || runAllScrapersMutation.isPending}
            className="btn btn-primary flex items-center space-x-2"
          >
            {(isRunning || runAllScrapersMutation.isPending) ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <PlayIcon className="h-4 w-4" />
                <span>Run All Scrapers</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scraper Config */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-6">Scraper Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Province */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">Province</label>
            <select
              value={scraperConfig.location.province}
              onChange={(e) => {
                const newProvince = e.target.value;
                const provinceData = southAfricanLocations[newProvince as keyof typeof southAfricanLocations] || {};
                const availableCities = Object.keys(provinceData);
                const firstCity = availableCities[0] || '';
                const firstCityData = provinceData[firstCity];
                setScraperConfig(prev => ({ 
                  ...prev, 
                  location: { 
                    ...prev.location,
                    province: newProvince,
                    city: firstCity,
                    p24_id: firstCityData?.p24_id || ''
                  } 
                }));
              }}
              className="input text-sm w-full"
            >
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
          
          {/* City */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">City</label>
            <select
              value={scraperConfig.location.city}
              onChange={(e) => {
                const newCity = e.target.value;
                const currentProvince = scraperConfig.location.province as keyof typeof southAfricanLocations;
                const provinceData = southAfricanLocations[currentProvince] || {};
                const cityData = provinceData[newCity];
                setScraperConfig(prev => ({ 
                  ...prev, 
                  location: { 
                    ...prev.location, 
                    city: newCity, 
                    p24_id: cityData?.p24_id || '' 
                  } 
                }));
              }}
              className="input text-sm w-full"
            >
              {Object.keys(
                southAfricanLocations[scraperConfig.location.province as keyof typeof southAfricanLocations] || {}
              ).map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          
          {/* Max Pages */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-secondary-700">Max Pages to Scrape</label>
            <input
              type="number"
              value={scraperConfig.maxPages}
              onChange={(e) => setScraperConfig(prev => ({ ...prev, maxPages: Number(e.target.value) }))}
              className="input text-sm w-full"
            />
          </div>
        </div>
        
        {/* Property24 ID Display */}
        {scraperConfig.location.p24_id && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>Property24 Area ID:</strong> {scraperConfig.location.p24_id}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              This ensures accurate targeting of the {scraperConfig.location.city} area on Property24.
            </div>
          </div>
        )}
      </div>

      {/* Scraper Status Cards */}
      {statusLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <ScraperStatus 
          status={scraperStatus || []} 
          onRunScraper={handleRunScraper}
          isRunning={isRunning}
        />
      )}

      {/* Scraper Jobs History */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-secondary-900">
            Recent Scraper Jobs
          </h3>
          <span className="text-sm text-secondary-500">
            Last 50 jobs
          </span>
        </div>
        
        {jobsLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <ScraperJobs jobs={scrapeJobs || []} />
        )}
      </div>

      {/* Scraper Settings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-secondary-900 mb-6">
          Scraper Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium text-secondary-900">Active Sources</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-secondary-700">Property24</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-secondary-700">Private Property</span>
              </label>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-secondary-900">Scraping Schedule</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-secondary-700">Enable automatic scraping</span>
              </label>
              <div className="ml-6">
                <select className="input text-sm w-full">
                  <option value="hourly">Every hour</option>
                  <option value="daily">Daily at 6 AM</option>
                  <option value="weekly">Weekly on Sunday</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-secondary-200">
          <button className="btn btn-secondary">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

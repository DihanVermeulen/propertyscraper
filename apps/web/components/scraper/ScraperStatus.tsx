'use client';

import { IScraperStatus as StatusType } from '../../lib/api';
import { PlayIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Button } from '../ui/button';

interface ScraperStatusProps {
  status: StatusType[];
  onRunScraper: (source: string) => void;
  isRunning: boolean;
  listingType?: 'sale' | 'rental';
}

export default function ScraperStatus({ status, onRunScraper, isRunning, listingType = 'sale' }: ScraperStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-success-600" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-error-600" />;
      case 'running':
        return <ClockIcon className="h-5 w-5 text-warning-600 animate-spin" />;
      case 'ready':
        return <PlayIcon className="h-5 w-5 text-primary-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-secondary-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-100 text-success-800';
      case 'failed':
        return 'bg-error-100 text-error-800';
      case 'running':
        return 'bg-warning-100 text-warning-800';
      case 'ready':
        return 'bg-primary-100 text-primary-800';
      default:
        return 'bg-secondary-100 text-secondary-800';
    }
  };

  const getSourceDisplayName = (source: string) => {
    switch (source) {
      case 'property24.com':
      case 'property24':
        return 'Property24';
      case 'privateproperty.co.za':
      case 'privateproperty':
        return 'Private Property';
      default:
        return source;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {status.map((scraper) => (
        <div key={scraper.source_website} className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(scraper.status)}
              <h3 className="text-lg font-semibold text-secondary-900">
                {getSourceDisplayName(scraper.source_website)}
              </h3>
            </div>
            <span className={`px-3 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(scraper.status)}`}>
              {scraper.status}
            </span>
          </div>

          <div className="space-y-3">
            {/* Last Run */}
            {scraper.last_run && (
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Last Run:</span>
                <span className="font-medium text-secondary-900">
                  {format(new Date(scraper.last_run), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            )}

            {/* Properties Found */}
            {scraper.properties_found !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Properties Found:</span>
                <span className="font-medium text-secondary-900">
                  {scraper.properties_found?.toLocaleString() || 0}
                </span>
              </div>
            )}

            {/* New Properties */}
            {scraper.properties_new !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">New Properties:</span>
                <span className="font-medium text-success-700">
                  {scraper.properties_new?.toLocaleString() || 0}
                </span>
              </div>
            )}

            {/* Updated Properties */}
            {scraper.properties_updated !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Updated Properties:</span>
                <span className="font-medium text-primary-700">
                  {scraper.properties_updated?.toLocaleString() || 0}
                </span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-6 pt-4 border-t border-secondary-200">
            <Button
              onClick={() => {
                console.log('ScraperStatus button clicked for:', scraper.source_website);
                onRunScraper(scraper.source_website);
              }}
              variant={'default'}
              disabled={isRunning || scraper.status === 'running'}
              className="w-full flex items-center justify-center space-x-2 h-15"
            >
              {scraper.status === 'running' ? (
                <>
                  <ClockIcon className="h-4 w-4 animate-spin font-bold" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 font-bold" />
                  <span className="font-bold">Run {listingType === 'rental' ? 'Rental' : 'Sale'} Scraper</span>
                </>
              )}
            </Button>
          </div>
        </div>
      ))}

      {/* Add New Scraper Card */}
      <div className="card border-dashed border-2 border-secondary-300 flex items-center justify-center">
        <div className="text-center py-8">
          <div className="text-secondary-400 mb-4">
            <PlayIcon className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            Add New Source
          </h3>
          <p className="text-sm text-secondary-600 mb-4">
            Configure additional property websites to scrape
          </p>
          <button className="btn btn-secondary">
            Add Source
          </button>
        </div>
      </div>
    </div>
  );
}

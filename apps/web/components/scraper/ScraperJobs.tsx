'use client';

import { IScrapeJob, ILogEntry } from '../../lib/api';
import { CheckCircleIcon, XCircleIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';

interface ScraperJobsProps {
  jobs: IScrapeJob[];
}

export default function ScraperJobs({ jobs }: ScraperJobsProps) {
  const [selectedJob, setSelectedJob] = useState<IScrapeJob | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-success-600" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-error-600" />;
      case 'running':
        return <ClockIcon className="h-5 w-5 text-warning-600 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-secondary-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success-100 text-success-800 border-success-200';
      case 'failed':
        return 'bg-error-100 text-error-800 border-error-200';
      case 'running':
        return 'bg-warning-100 text-warning-800 border-warning-200';
      default:
        return 'bg-secondary-100 text-secondary-800 border-secondary-200';
    }
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

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="h-12 w-12 mx-auto text-secondary-300 mb-4" />
        <p className="text-lg font-medium text-secondary-500">No scraper jobs found</p>
        <p className="text-sm text-secondary-400 mt-1">Run a scraper to see job history here</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              {jobs.map((job) => (
                <tr 
                  key={job.id} 
                  className="hover:bg-secondary-50 transition-colors duration-150 group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-secondary-900">
                        {getSourceDisplayName(job.source_website)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(job.status)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                    {format(new Date(job.started_at), 'MMM dd, HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500">
                    {job.completed_at 
                      ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)}s`
                      : job.status === 'running' ? 'Running...' : 'N/A'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-secondary-900">
                      <div className="flex items-center space-x-4">
                        <span className="text-success-600 font-medium">
                          +{job.properties_new || 0}
                        </span>
                        <span className="text-primary-600 font-medium">
                          ~{job.properties_updated || 0}
                        </span>
                        <span className="text-secondary-500">
                          /{job.properties_found || 0}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedJob(job)}
                      className="text-primary-600 hover:text-primary-900 transition-colors duration-150 opacity-0 group-hover:opacity-100 flex items-center space-x-1"
                    >
                      <EyeIcon className="h-4 w-4" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-strong max-w-2xl w-full max-h-[80vh] overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-secondary-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-secondary-900">
                Job Details - {getSourceDisplayName(selectedJob.source_website)}
              </h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-secondary-400 hover:text-secondary-600 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-96">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-secondary-700">Status</label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(selectedJob.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedJob.status)}`}>
                      {selectedJob.status}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700">Started At</label>
                  <p className="text-sm text-secondary-900 mt-1">
                    {format(new Date(selectedJob.started_at), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700">Properties Found</label>
                  <p className="text-sm text-secondary-900 mt-1">{selectedJob.properties_found || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700">New Properties</label>
                  <p className="text-sm text-success-600 font-medium mt-1">{selectedJob.properties_new || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary-700">Updated Properties</label>
                  <p className="text-sm text-primary-600 font-medium mt-1">{selectedJob.properties_updated || 0}</p>
                </div>
                {selectedJob.completed_at && (
                  <div>
                    <label className="text-sm font-medium text-secondary-700">Completed At</label>
                    <p className="text-sm text-secondary-900 mt-1">
                      {format(new Date(selectedJob.completed_at), 'MMM dd, yyyy HH:mm:ss')}
                    </p>
                  </div>
                )}
              </div>

              {selectedJob.error_message && (
                <div>
                  <label className="text-sm font-medium text-error-700">Error Message</label>
                  <p className="text-sm text-error-600 mt-1 bg-error-50 p-3 rounded-lg">
                    {selectedJob.error_message}
                  </p>
                </div>
              )}

              {selectedJob.logs && selectedJob.logs.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-secondary-700">Logs</label>
                  <div className="mt-1 bg-secondary-50 p-3 rounded-lg max-h-48 overflow-y-auto">
                    {selectedJob.logs.map((log, index) => {
                      // Handle both string logs and object logs
                      if (typeof log === 'string') {
                        return (
                          <p key={index} className="text-xs text-secondary-600 font-mono">
                            {log}
                          </p>
                        );
                      } else if (typeof log === 'object' && log !== null) {
                        // Handle log objects with timestamp, level, message
                        const logObj = log as ILogEntry;
                        return (
                          <div key={index} className="text-xs font-mono border-l-2 border-secondary-300 pl-2 mb-2">
                            <div className="flex items-center space-x-2 mb-1">
                              {logObj.timestamp && (
                                <span className="text-secondary-400">
                                  {new Date(logObj.timestamp).toLocaleTimeString()}
                                </span>
                              )}
                              {logObj.level && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  logObj.level === 'error' ? 'bg-error-100 text-error-700' :
                                  logObj.level === 'warn' ? 'bg-warning-100 text-warning-700' :
                                  'bg-info-100 text-info-700'
                                }`}>
                                  {logObj.level.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <p className="text-secondary-600">
                              {logObj.message || 'No message'}
                            </p>
                            {logObj.details && (
                              <pre className="text-secondary-500 mt-1 text-xs overflow-x-auto">
                                {typeof logObj.details === 'object' ? JSON.stringify(logObj.details, null, 2) : logObj.details}
                              </pre>
                            )}
                            {logObj.error && (
                              <pre className="text-error-600 mt-1 text-xs overflow-x-auto">
                                {logObj.error}
                              </pre>
                            )}
                            {logObj.result && (
                              <pre className="text-success-600 mt-1 text-xs overflow-x-auto">
                                {typeof logObj.result === 'object' ? JSON.stringify(logObj.result, null, 2) : logObj.result}
                              </pre>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <p key={index} className="text-xs text-secondary-600 font-mono">
                            {String(log)}
                          </p>
                        );
                      }
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

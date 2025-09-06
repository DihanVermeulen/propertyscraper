'use client';

import { useState } from 'react';
import MarketAnalysisDashboard from '../../../components/investor/MarketAnalysisDashboard';
import { BarChart } from 'lucide-react';

export default function MarketAnalysisPage() {
  const [selectedLocation, setSelectedLocation] = useState({
    province: 'Western Cape',
    city: 'Somerset West',
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate flex items-center gap-2">
            <BarChart className="h-8 w-8" />
            Market Analysis
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Comprehensive market insights and trends for informed investment decisions
          </p>
        </div>
      </div>

      <MarketAnalysisDashboard 
        defaultLocation={selectedLocation}
      />
    </div>
  );
}

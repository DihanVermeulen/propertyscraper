'use client';

import InvestmentOpportunities from '../../../components/investor/InvestmentOpportunities';
import { TrendingUp } from 'lucide-react';

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Investment Opportunities
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            High-yield properties and investment opportunities in your area
          </p>
        </div>
      </div>

      <InvestmentOpportunities 
        defaultFilters={{
          min_yield: 8,
        }}
      />
    </div>
  );
}

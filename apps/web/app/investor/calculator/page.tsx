'use client';

import RentalYieldCalculator from '../../../components/investor/RentalYieldCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Calculator } from 'lucide-react';

export default function CalculatorPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            Rental Yield Calculator
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Calculate rental yields and analyze investment potential
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RentalYieldCalculator />
        
        {/* Investment Tips Card */}
        <Card>
          <CardHeader>
            <CardTitle>Investment Tips</CardTitle>
            <CardDescription>
              Key guidelines for successful property investment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-green-700">Excellent Yield (10%+)</h4>
                <p className="text-sm text-gray-600">
                  Properties with exceptional rental returns. Consider location, condition, and growth potential.
                </p>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-semibold text-blue-700">Good Yield (8-10%)</h4>
                <p className="text-sm text-gray-600">
                  Solid investment opportunities with balanced risk-reward profiles.
                </p>
              </div>
              
              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-semibold text-yellow-700">Fair Yield (6-8%)</h4>
                <p className="text-sm text-gray-600">
                  Moderate returns. Focus on capital appreciation potential and area development.
                </p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-semibold text-red-700">Poor Yield (&lt;6%)</h4>
                <p className="text-sm text-gray-600">
                  Low rental returns. Consider if capital growth justifies the investment.
                </p>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Key Considerations</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Factor in vacancy periods (5-10% of rental income)</li>
                <li>• Budget for regular maintenance and repairs</li>
                <li>• Consider property management costs (8-12% of rental)</li>
                <li>• Research local rental demand and tenant quality</li>
                <li>• Evaluate long-term capital growth prospects</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

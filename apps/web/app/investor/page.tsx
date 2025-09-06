'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import RentalYieldCalculator from '../../components/investor/RentalYieldCalculator';
import MarketAnalysisDashboard from '../../components/investor/MarketAnalysisDashboard';
import InvestmentOpportunities from '../../components/investor/InvestmentOpportunities';
import { Calculator, BarChart, TrendingUp, Building } from 'lucide-react';

export default function InvestorDashboard() {
  const [selectedLocation, setSelectedLocation] = useState({
    province: 'Western Cape',
    city: 'Somerset West',
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-secondary-900 sm:text-3xl sm:truncate">
            Investor Dashboard
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Comprehensive tools and insights for real estate investment analysis
          </p>
        </div>
      </div>

      {/* Dashboard Content */}
      <Tabs defaultValue="opportunities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="opportunities" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="market" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Market Analysis
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Portfolio
          </TabsTrigger>
        </TabsList>

        {/* Investment Opportunities Tab */}
        <TabsContent value="opportunities" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <InvestmentOpportunities 
              defaultFilters={{
                min_yield: 8,
                location_city: selectedLocation.city,
              }}
            />
          </div>
        </TabsContent>

        {/* Rental Yield Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RentalYieldCalculator />
            
            {/* Quick Tips Card */}
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
                    <h4 className="font-semibold text-blue-700">{`Good Yield (8-10%)`}</h4>
                    <p className="text-sm text-gray-600">
                      Solid investment opportunities with balanced risk-reward profiles.
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold text-yellow-700">{`Fair Yield (6-8%)`}</h4>
                    <p className="text-sm text-gray-600">
                      Moderate returns. Focus on capital appreciation potential and area development.
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-semibold text-red-700">{`Poor Yield (<6%)`}</h4>
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
        </TabsContent>

        {/* Market Analysis Tab */}
        <TabsContent value="market" className="space-y-6">
          <MarketAnalysisDashboard 
            defaultLocation={selectedLocation}
          />
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Portfolio Tracker
              </CardTitle>
              <CardDescription>
                Track and analyze your property investment portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Building className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Portfolio Tracker Coming Soon</h3>
                <p className="text-sm max-w-md mx-auto">
                  Track your properties, monitor performance, and get detailed analytics on your real estate investments.
                </p>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md mx-auto">
                  <h4 className="font-medium mb-2">Planned Features:</h4>
                  <ul className="text-sm space-y-1 text-left">
                    <li>• Property performance tracking</li>
                    <li>• Cash flow analysis</li>
                    <li>• Portfolio diversification insights</li>
                    <li>• Tax optimization suggestions</li>
                    <li>• Maintenance scheduling</li>
                    <li>• Tenant management integration</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

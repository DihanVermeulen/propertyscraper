'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import LoadingSpinner from '../ui/LoadingSpinner';
import { investorApi, IMarketAnalysis } from '../../lib/api';
import { BarChart, TrendingUp, TrendingDown, Home, Building, DollarSign, Calendar, AlertCircle } from 'lucide-react';

interface IMarketAnalysisDashboardProps {
  defaultLocation?: {
    province: string;
    city: string;
    suburb?: string;
  };
}

export default function MarketAnalysisDashboard({ defaultLocation }: IMarketAnalysisDashboardProps) {
  const [location, setLocation] = useState(defaultLocation || {
    province: 'Western Cape',
    city: 'Somerset West',
  });
  const [propertyType, setPropertyType] = useState<string>('');

  const { data: marketAnalysis, isLoading, error, refetch } = useQuery({
    queryKey: ['market-analysis', location, propertyType],
    queryFn: () => investorApi.getMarketAnalysis(location, propertyType || undefined),
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: false,
  });

  const handleCalculateAnalysis = async () => {
    try {
      await investorApi.calculateMarketAnalysis(location, propertyType || undefined);
      refetch();
    } catch (error) {
      console.error('Failed to calculate market analysis:', error);
    }
  };

  const getTemperatureColor = (temperature: string) => {
    switch (temperature) {
      case 'hot': return 'bg-red-100 text-red-800 border-red-200';
      case 'warm': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cool': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cold': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`;
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Market Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            No market analysis found for {location.city}, {location.province}
          </p>
          <Button onClick={handleCalculateAnalysis}>
            Calculate Market Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Market Analysis Dashboard
          </CardTitle>
          <CardDescription>
            Comprehensive market insights for investment decision making
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <Select value={location.city} onValueChange={(value) => setLocation(prev => ({ ...prev, city: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Somerset West">Somerset West</SelectItem>
                  <SelectItem value="Cape Town">Cape Town</SelectItem>
                  <SelectItem value="Johannesburg">Johannesburg</SelectItem>
                  <SelectItem value="Pretoria">Pretoria</SelectItem>
                  <SelectItem value="Durban">Durban</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Property Type</label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleCalculateAnalysis} className="w-full">
                Refresh Analysis
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {marketAnalysis && (
        <>
          {/* Market Temperature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Market Temperature
                <Badge className={getTemperatureColor(marketAnalysis.market_temperature)}>
                  {marketAnalysis.market_temperature.toUpperCase()}
                </Badge>
              </CardTitle>
              <CardDescription>
                Overall market conditions in {location.city}, {location.province}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Home className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600">Sale Listings</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {marketAnalysis.total_sale_listings.toLocaleString()}
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Building className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600">Rental Listings</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {marketAnalysis.total_rental_listings.toLocaleString()}
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600">Price-to-Rent Ratio</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {marketAnalysis.avg_price_to_rent_ratio ? marketAnalysis.avg_price_to_rent_ratio.toFixed(1) : 'N/A'}
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-600">Avg Gross Yield</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {marketAnalysis.avg_gross_yield ? formatPercentage(marketAnalysis.avg_gross_yield) : 'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sale Market Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Sale Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Sale Price</span>
                  <span className="font-semibold">
                    {marketAnalysis.avg_sale_price ? formatCurrency(marketAnalysis.avg_sale_price) : 'N/A'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Median Sale Price</span>
                  <span className="font-semibold">
                    {marketAnalysis.median_sale_price ? formatCurrency(marketAnalysis.median_sale_price) : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Price Trend</span>
                  <div className="flex items-center gap-1">
                    {marketAnalysis.sale_price_trend && marketAnalysis.sale_price_trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-semibold ${marketAnalysis.sale_price_trend && marketAnalysis.sale_price_trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {marketAnalysis.sale_price_trend ? formatPercentage(marketAnalysis.sale_price_trend) : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Days on Market</span>
                  <span className="font-semibold">
                    {marketAnalysis.avg_days_on_market_sale ? `${marketAnalysis.avg_days_on_market_sale} days` : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Rental Market Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Rental Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Rental Price</span>
                  <span className="font-semibold">
                    {marketAnalysis.avg_rental_price ? formatCurrency(marketAnalysis.avg_rental_price) : 'N/A'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Median Rental Price</span>
                  <span className="font-semibold">
                    {marketAnalysis.median_rental_price ? formatCurrency(marketAnalysis.median_rental_price) : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rental Trend</span>
                  <div className="flex items-center gap-1">
                    {marketAnalysis.rental_price_trend && marketAnalysis.rental_price_trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`font-semibold ${marketAnalysis.rental_price_trend && marketAnalysis.rental_price_trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {marketAnalysis.rental_price_trend ? formatPercentage(marketAnalysis.rental_price_trend) : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Estimated Vacancy Rate</span>
                  <span className="font-semibold">
                    {marketAnalysis.estimated_vacancy_rate ? formatPercentage(marketAnalysis.estimated_vacancy_rate) : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Analysis Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Analysis Period:</span>
                  <div className="mt-1">
                    {new Date(marketAnalysis.analysis_period_start).toLocaleDateString()} - {new Date(marketAnalysis.analysis_period_end).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Last Updated:</span>
                  <div className="mt-1">
                    {new Date(marketAnalysis.calculated_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Location:</span>
                  <div className="mt-1">
                    {marketAnalysis.location_suburb ? `${marketAnalysis.location_suburb}, ` : ''}{marketAnalysis.location_city}, {marketAnalysis.location_province}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

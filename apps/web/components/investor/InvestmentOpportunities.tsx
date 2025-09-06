'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import LoadingSpinner from '../ui/LoadingSpinner';
import { investorApi, IInvestmentOpportunity } from '../../lib/api';
import { TrendingUp, MapPin, Bed, Bath, Car, Home, DollarSign, Star } from 'lucide-react';

interface IInvestmentOpportunitiesProps {
  defaultFilters?: {
    min_yield?: number;
    location_city?: string;
    max_price?: number;
  };
}

export default function InvestmentOpportunities({ defaultFilters }: IInvestmentOpportunitiesProps) {
  const [filters, setFilters] = useState({
    min_yield: defaultFilters?.min_yield || 8,
    location_city: defaultFilters?.location_city || '',
    max_price: defaultFilters?.max_price || undefined,
    limit: 10,
  });

  const { data: opportunities, isLoading, error, refetch } = useQuery({
    queryKey: ['investment-opportunities', filters],
    queryFn: () => investorApi.getInvestmentOpportunities(filters),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  const handleFilterChange = (field: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value,
    }));
  };

  const getYieldColor = (yieldValue: number) => {
    if (yieldValue >= 12) return 'bg-green-100 text-green-800 border-green-200';
    if (yieldValue >= 10) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (yieldValue >= 8) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Investment Opportunities
        </CardTitle>
        <CardDescription>
          High-yield properties with potential for strong rental returns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Minimum Yield (%)</label>
            <Input
              type="number"
              value={filters.min_yield || ''}
              onChange={(e) => handleFilterChange('min_yield', parseFloat(e.target.value) || 0)}
              placeholder="e.g. 8"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Select 
              value={filters.location_city || ''} 
              onValueChange={(value) => handleFilterChange('location_city', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Cities" />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Max Price (R)</label>
            <Input
              type="number"
              value={filters.max_price || ''}
              onChange={(e) => handleFilterChange('max_price', parseInt(e.target.value) || 0)}
              placeholder="e.g. 2000000"
            />
          </div>

          <div className="flex items-end">
            <Button onClick={() => refetch()} className="w-full">
              Search
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-red-600">
            <p>Failed to load investment opportunities</p>
            <Button onClick={() => refetch()} className="mt-2">
              Try Again
            </Button>
          </div>
        )}

        {/* Opportunities List */}
        {opportunities && (
          <div className="space-y-4">
            {opportunities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Home className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No investment opportunities found matching your criteria</p>
                <p className="text-sm mt-2">Try adjusting your filters to see more results</p>
              </div>
            ) : (
              opportunities.map((opportunity) => (
                <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      {/* Property Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-lg line-clamp-2">
                            {opportunity.title}
                          </h3>
                          <div className="flex items-center gap-1 ml-4">
                            <Star className={`h-4 w-4 ${getConfidenceColor(opportunity.confidence_score)}`} />
                            <span className={`text-sm font-medium ${getConfidenceColor(opportunity.confidence_score)}`}>
                              {Math.round(opportunity.confidence_score * 100)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-gray-600 mb-3">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">
                            {opportunity.location_suburb}, {opportunity.location_city}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                          {opportunity.bedrooms && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-4 w-4" />
                              <span>{opportunity.bedrooms}</span>
                            </div>
                          )}
                          {opportunity.bathrooms && (
                            <div className="flex items-center gap-1">
                              <Bath className="h-4 w-4" />
                              <span>{opportunity.bathrooms}</span>
                            </div>
                          )}
                          {opportunity.floor_area && (
                            <div className="flex items-center gap-1">
                              <Home className="h-4 w-4" />
                              <span>{opportunity.floor_area}m²</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{opportunity.property_type}</span>
                          </div>
                        </div>

                        {/* Investment Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Purchase Price</span>
                            <div className="font-semibold text-lg">
                              {formatCurrency(opportunity.price)}
                            </div>
                          </div>
                          
                          <div>
                            <span className="text-gray-500">Est. Monthly Rental</span>
                            <div className="font-semibold text-lg text-green-600">
                              {formatCurrency(opportunity.estimated_monthly_rental)}
                            </div>
                          </div>

                          <div>
                            <span className="text-gray-500">Monthly Cash Flow</span>
                            <div className={`font-semibold text-lg ${
                              opportunity.net_monthly_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(opportunity.net_monthly_cash_flow)}
                            </div>
                          </div>

                          <div>
                            <span className="text-gray-500">Annual Cash Flow</span>
                            <div className={`font-semibold text-lg ${
                              opportunity.net_monthly_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(opportunity.net_monthly_cash_flow * 12)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Yield Badges */}
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        <Badge className={`text-center py-2 ${getYieldColor(opportunity.gross_rental_yield)}`}>
                          <div>
                            <div className="font-bold text-lg">
                              {opportunity.gross_rental_yield.toFixed(1)}%
                            </div>
                            <div className="text-xs">Gross Yield</div>
                          </div>
                        </Badge>
                        
                        <Badge className={`text-center py-2 ${getYieldColor(opportunity.net_rental_yield)}`}>
                          <div>
                            <div className="font-bold text-lg">
                              {opportunity.net_rental_yield.toFixed(1)}%
                            </div>
                            <div className="text-xs">Net Yield</div>
                          </div>
                        </Badge>

                        <Button size="sm" className="mt-2">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Load More */}
        {opportunities && opportunities.length >= filters.limit && (
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setFilters(prev => ({ ...prev, limit: prev.limit + 10 }))}
            >
              Load More Opportunities
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface IRentalYieldAnalysis {
  id: number;
  sale_property_id: number;
  area_avg_rental: number;
  comparable_rental_count: number;
  estimated_monthly_rental: number;
  gross_rental_yield: number;
  net_rental_yield: number;
  cash_on_cash_return?: number;
  total_monthly_expenses: number;
  net_monthly_cash_flow: number;
  break_even_rental: number;
  analysis_date: string;
  calculation_method: string;
  confidence_score: number;
}

export interface IMarketAnalysis {
  id: number;
  location_province: string;
  location_city: string;
  location_suburb?: string;
  property_type?: string;
  // Sale market metrics
  avg_sale_price?: number;
  median_sale_price?: number;
  sale_price_trend?: number;
  avg_days_on_market_sale?: number;
  total_sale_listings: number;
  // Rental market metrics
  avg_rental_price?: number;
  median_rental_price?: number;
  rental_price_trend?: number;
  avg_days_on_market_rental?: number;
  total_rental_listings: number;
  estimated_vacancy_rate?: number;
  // Investment metrics
  avg_price_to_rent_ratio?: number;
  avg_gross_yield?: number;
  market_temperature: 'hot' | 'warm' | 'cool' | 'cold';
  // Analysis metadata
  analysis_period_start: string;
  analysis_period_end: string;
  calculated_at: string;
}

export interface IInvestmentOpportunity {
  // Property details
  id: number;
  title: string;
  price: number;
  location_city: string;
  location_suburb: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  floor_area?: number;
  // Investment metrics
  gross_rental_yield: number;
  net_rental_yield: number;
  net_monthly_cash_flow: number;
  estimated_monthly_rental: number;
  confidence_score: number;
}

export interface IRentalMarketStats {
  total_rental_properties: number;
  rental_price_stats: {
    avg_rental_price: number;
    min_rental_price: number;
    max_rental_price: number;
  };
  top_rental_locations: Array<{
    location_city: string;
    count: number;
    avg_rental_price: number;
  }>;
  furnished_distribution: Array<{
    furnished_status: string;
    count: number;
    avg_price: number;
  }>;
}
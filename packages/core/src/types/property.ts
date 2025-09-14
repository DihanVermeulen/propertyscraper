// ===== CORE PROPERTY TYPES =====

export interface IProperty {
  id: number;
  external_id: string;
  title: string;
  description?: string;
  price?: number;
  price_currency: string;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  floor_area?: number;
  erf_size?: number;
  location_province?: string;
  location_city?: string;
  location_suburb?: string;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  source_website: string;
  source_url: string;
  images?: string[];
  features?: string[];
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  listing_date?: string;
  scraped_at: string;
  updated_at: string;
  is_active: boolean;
  // Added from migration: expense scraping status fields
  expense_scraping_status?: 'pending' | 'success' | 'failed' | 'skipped' | null;
  expense_scraping_attempted_at?: string;
  expense_scraping_failure_reason?: string;
  expense_scraping_retries?: number;
}

export interface IRentalProperty {
  id: number;
  external_id: string;
  title: string;
  description?: string;
  rental_price: number;
  rental_period: 'monthly' | 'weekly' | 'daily';
  deposit?: number;
  lease_terms?: string;
  available_date?: string;
  furnished_status?: 'furnished' | 'semi-furnished' | 'unfurnished';
  utilities_included?: string[];
  pet_policy?: 'allowed' | 'not_allowed' | 'cats_only' | 'dogs_only' | 'negotiable';
  // Standard property fields
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  floor_area?: number;
  erf_size?: number;
  // Location fields
  location_province?: string;
  location_city?: string;
  location_suburb?: string;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  // Source and agent information
  source_website: string;
  source_url: string;
  images?: string[];
  features?: string[];
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  // Timestamps
  listing_date?: string;
  scraped_at: string;
  updated_at: string;
  is_active: boolean;
}

// ===== PRICE HISTORY =====

export interface IPriceHistory {
  id: number;
  property_id: number;
  price: number;
  price_currency: string;
  recorded_at: string;
  change_type: 'initial' | 'increase' | 'decrease' | 'update';
  previous_price?: number;
  change_amount?: number;
  change_percentage?: number;
}

export interface IRentalPriceHistory {
  id: number;
  rental_property_id: number;
  rental_price: number;
  rental_period: 'monthly' | 'weekly' | 'daily';
  recorded_at: string;
  change_type: 'initial' | 'increase' | 'decrease' | 'update';
  previous_price?: number;
  change_amount?: number;
  change_percentage?: number;
}

// ===== PROPERTY LIFECYCLE =====

export interface IPropertyLifecycle {
  id: number;
  property_id: number;
  event_type: 'listed' | 'delisted' | 'relisted' | 'price_changed';
  event_date: string;
  days_on_market?: number;
  metadata?: Record<string, any>;
}

export interface IRentalPropertyLifecycle {
  id: number;
  rental_property_id: number;
  event_type: 'listed' | 'delisted' | 'relisted' | 'price_changed' | 'rented';
  event_date: string;
  days_on_market?: number;
  metadata?: Record<string, any>;
}

// ===== PROPERTY EXPENSES =====

export interface IPropertyExpenses {
  id: number;
  property_id: number;
  property_table: 'properties' | 'rental_properties';
  // Monthly expenses
  municipal_rates?: number;
  body_corporate_levies?: number;
  insurance_estimate?: number;
  maintenance_reserve?: number;
  // Annual expenses
  municipal_taxes?: number;
  property_tax?: number;
  // Additional costs for investors
  transfer_costs?: number;
  bond_costs?: number;
  // Data source and timestamps
  data_source: 'scraped' | 'estimated' | 'user_input';
  scraped_at: string;
  updated_at: string;
}

// ===== RENTAL YIELD ANALYSIS =====

export interface IRentalYieldAnalysis {
  id: number;
  sale_property_id: number;
  // Rental market data
  area_avg_rental?: number;
  comparable_rental_count?: number;
  estimated_monthly_rental?: number;
  // Yield calculations
  gross_rental_yield?: number;
  net_rental_yield?: number;
  cash_on_cash_return?: number;
  // Investment metrics
  total_monthly_expenses?: number;
  net_monthly_cash_flow?: number;
  break_even_rental?: number;
  // Analysis metadata
  analysis_date: string;
  calculation_method?: string;
  confidence_score?: number;
}

// ===== MARKET ANALYSIS =====

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
  total_sale_listings?: number;
  // Rental market metrics
  avg_rental_price?: number;
  median_rental_price?: number;
  rental_price_trend?: number;
  avg_days_on_market_rental?: number;
  total_rental_listings?: number;
  estimated_vacancy_rate?: number;
  // Investment metrics
  avg_price_to_rent_ratio?: number;
  avg_gross_yield?: number;
  market_temperature?: 'hot' | 'warm' | 'cool' | 'cold';
  // Analysis metadata
  analysis_period_start?: string;
  analysis_period_end?: string;
  calculated_at: string;
}

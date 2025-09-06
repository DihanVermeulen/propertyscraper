export interface IPriceHistoryEntry {
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

export interface ILifecycleEvent {
  id: number;
  property_id: number;
  event_type: 'listed' | 'delisted' | 'relisted' | 'price_changed';
  event_date: string;
  days_on_market?: number;
  metadata?: string;
}

export interface IPriceHistoryResponse {
  price_history: IPriceHistoryEntry[];
  lifecycle_events: ILifecycleEvent[];
}

export interface IAggregatedPriceHistory {
  date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  property_count: number;
  price_changes: number;
}

export interface IMarketTrend {
  date: string;
  price_increases: number;
  price_decreases: number;
  avg_increase_pct: number;
  avg_decrease_pct: number;
  total_changes: number;
}

export interface IPriceDistribution {
  price_range: string;
  count: number;
  avg_price: number;
}

export interface IPriceHistoryData {
  aggregated_history: IAggregatedPriceHistory[];
  market_trends: IMarketTrend[];
  price_distribution: IPriceDistribution[];
}

export interface ITimeOnMarketProperty {
  id: number;
  title: string;
  location_city: string;
  location_suburb: string;
  price: number;
  listing_date: string;
  scraped_at: string;
  days_on_market: number;
  first_listed_date?: string;
  last_event_date?: string;
}

export interface ITimeOnMarketResponse {
  properties: ITimeOnMarketProperty[];
  summary: {
    total_properties: number;
    avg_days_on_market: number;
    max_days_on_market: number;
    min_days_on_market: number;
    time_ranges: Record<string, number>;
  };
}
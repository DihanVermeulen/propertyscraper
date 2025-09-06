export interface IDashboardStats {
  total_properties: number;
  price_stats: {
    avg_price: number;
    min_price: number;
    max_price: number;
  };
  top_locations: Array<{
    location_city: string;
    count: number;
    avg_price: number;
  }>;
  source_distribution: Array<{
    source_website: string;
    count: number;
  }>;
  recent_activity: Array<{
    date: string;
    properties_scraped: number;
  }>;
}
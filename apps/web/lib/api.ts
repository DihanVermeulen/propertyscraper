import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: {
    response?: {
      data?: unknown;
      status?: number;
      headers?: unknown;
    };
    message: string;
  }) => {
    return Promise.reject(error);
  }
);

// Types
export interface Property {
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
}

export interface IPropertyFilters {
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  location_city?: string;
  location_suburb?: string;
  source_website?: string;
  limit?: number;
  offset?: number;
}

export interface IPropertiesResponse {
  properties: Property[];
  total: number;
  limit: number;
  offset: number;
}

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

export interface ILogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: any;
  error?: string;
  result?: any;
  jobId?: string;
}

export interface IScrapeJob {
  id: number;
  source_website: string;
  status: string;
  properties_found: number;
  properties_new: number;
  properties_updated: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  logs: (string | ILogEntry)[];
}

export interface IScraperStatus {
  source_website: string;
  status: string;
  last_run?: string;
  properties_found?: number;
  properties_new?: number;
  properties_updated?: number;
}

export interface ScraperConfig {
  location: {
    city: string;
    province: string;
    country: string;
    p24_id?: string;
  };
  maxPages: number;
  priceRange: {
    min?: number;
    max?: number;
  };
  propertyTypes: string[];
}

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

// API functions
export const propertiesApi = {
  // Get properties with filters
  getProperties: async (
    filters: IPropertyFilters = {}
  ): Promise<IPropertiesResponse> => {
    const response = await api.get("/api/properties", { params: filters });
    return response.data;
  },

  // Get single property
  getProperty: async (id: number): Promise<Property> => {
    const response = await api.get(`/api/properties/${id}`);
    return response.data;
  },

  // Get dashboard statistics
  getDashboardStats: async (): Promise<IDashboardStats> => {
    const response = await api.get("/api/dashboard");
    return response.data;
  },

  // Get price history for a specific property
  getPropertyPriceHistory: async (propertyId: number, limit = 100): Promise<IPriceHistoryResponse> => {
    const response = await api.get(`/api/properties/${propertyId}/price-history`, {
      params: { limit }
    });
    return response.data;
  },

  // Get aggregated price history data
  getPriceHistoryData: async (filters: {
    location_city?: string;
    property_type?: string;
    source_website?: string;
    days?: number;
  } = {}): Promise<IPriceHistoryData> => {
    const response = await api.get("/api/price-history", { params: filters });
    return response.data;
  },

  // Get time on market statistics
  getTimeOnMarketStats: async (filters: {
    location_city?: string;
    min_days?: number;
    max_days?: number;
    limit?: number;
  } = {}): Promise<ITimeOnMarketResponse> => {
    const response = await api.get("/api/time-on-market", { params: filters });
    return response.data;
  },
};

export const scraperApi = {
  // Run scraper for specific source
  runScraper: async (source: string, config?: ScraperConfig): Promise<any> => {
    const response = await api.post(`/api/scraper/scrape/${source}`, config);
    return response.data;
  },

  // Run all scrapers
  runAllScrapers: async (): Promise<any> => {
    const response = await api.post("/api/scraper/scrape-all");
    return response.data;
  },

  // Get scrape jobs
  getScrapeJobs: async (limit = 20): Promise<IScrapeJob[]> => {
    const response = await api.get("/api/scraper/jobs", { params: { limit } });
    return response.data;
  },

  // Get scraper status
  getScraperStatus: async (): Promise<IScraperStatus[]> => {
    const response = await api.get("/api/scraper/status");
    return response.data;
  },
};

export default api;

export interface IScraperStatus {
  source_website: string;
  status: string;
  last_run?: string;
  properties_found?: number;
  properties_new?: number;
  properties_updated?: number;
}

export interface IScraperConfig {
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
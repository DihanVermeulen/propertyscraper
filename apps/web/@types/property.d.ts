// RENTAL PROPERTIES INTERFACES

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

export interface IRentalPropertyFilters {
  min_rental_price?: number;
  max_rental_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  location_city?: string;
  location_suburb?: string;
  source_website?: string;
  furnished_status?: 'furnished' | 'semi-furnished' | 'unfurnished';
  pet_policy?: 'allowed' | 'not_allowed' | 'cats_only' | 'dogs_only' | 'negotiable';
  available_from?: string;
  floor_area_range?: string;
  limit?: number;
  offset?: number;
}

export interface IRentalPropertiesResponse {
  rental_properties: IRentalProperty[];
  total: number;
  limit: number;
  offset: number;
}

// INVESTOR ANALYSIS INTERFACES

export interface IPropertyExpenses {
  id: number;
  property_id: number;
  property_table: 'properties' | 'rental_properties';
  municipal_rates?: number;
  body_corporate_levies?: number;
  insurance_estimate?: number;
  maintenance_reserve?: number;
  municipal_taxes?: number;
  property_tax?: number;
  transfer_costs?: number;
  bond_costs?: number;
  data_source: 'scraped' | 'estimated' | 'user_input';
  scraped_at: string;
  updated_at: string;
}

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
  min_floor_area?: number;
  max_floor_area?: number;
  floor_area_range?: string;
  limit?: number;
  offset?: number;
}

export interface IPropertiesResponse {
  properties: IProperty[];
  total: number;
  limit: number;
  offset: number;
}
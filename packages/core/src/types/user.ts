// ===== USER TYPES =====

export interface IUser {
  id: number;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  is_verified: boolean;
  last_login?: string;
  failed_login_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

export interface IRefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

export interface IUserSession {
  id: number;
  user_id: number;
  session_token: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  created_at: string;
}

export interface ISavedSearch {
  id: number;
  user_id?: number;
  name: string;
  filters: Record<string, any>;
  created_at: string;
  last_run?: string;
  is_active: boolean;
}

export interface IUserPreferences {
  id: number;
  user_id: number;
  preference_key: string;
  preference_value: string;
  created_at: string;
  updated_at: string;
}

// ===== SCRAPING TYPES =====

export interface IScrapeJob {
  id: number;
  source_website: string;
  status: 'running' | 'completed' | 'failed';
  properties_found: number;
  properties_new: number;
  properties_updated: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  logs?: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: Record<string, any>;
  }>;
}

// ===== RESPONSE TYPES =====

export interface IPropertiesResponse {
  properties: import('./property').IProperty[];
  total: number;
  limit: number;
  offset: number;
}

export interface IRentalPropertiesResponse {
  rental_properties: import('./property').IRentalProperty[];
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

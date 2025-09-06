import axios from "axios";
import { IDashboardStats } from "../@types/dashboard";
import { IPropertiesResponse, IProperty, IPropertyExpenses, IPropertyFilters, IRentalPropertiesResponse, IRentalProperty, IRentalPropertyFilters } from "../@types/property";
import { IPriceHistoryData, IPriceHistoryResponse, ITimeOnMarketResponse } from "../@types/analytics";
import { IInvestmentOpportunity, IMarketAnalysis, IRentalMarketStats, IRentalYieldAnalysis } from "../@types/investor";
import { IScrapeJob, IScraperConfig, IScraperStatus } from "../@types/scraper";

// Use relative path in development for Next.js rewrites, absolute URL for production
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? '' // Use relative paths for Next.js rewrites
  : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable credentials for cookies
  timeout: 10000, // 10 second timeout
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
  getProperty: async (id: number): Promise<IProperty> => {
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

// RENTAL PROPERTIES API
export const rentalPropertiesApi = {
  // Get rental properties with filters
  getRentalProperties: async (
    filters: IRentalPropertyFilters = {}
  ): Promise<IRentalPropertiesResponse> => {
    const response = await api.get("/api/rental-properties", { params: filters });
    return response.data;
  },

  // Get single rental property
  getRentalProperty: async (id: number): Promise<IRentalProperty> => {
    const response = await api.get(`/api/rental-properties/${id}`);
    return response.data;
  },

  // Get rental market statistics
  getRentalMarketStats: async (): Promise<IRentalMarketStats> => {
    const response = await api.get("/api/rental-market-stats");
    return response.data;
  },
};

// INVESTOR ANALYSIS API
export const investorApi = {
  // Calculate rental yield for a sale property
  calculateRentalYield: async (salePropertyId: number): Promise<IRentalYieldAnalysis> => {
    const response = await api.post(`/api/investor/rental-yield/${salePropertyId}`);
    return response.data;
  },

  // Get rental yield analysis for a property
  getRentalYieldAnalysis: async (salePropertyId: number): Promise<IRentalYieldAnalysis> => {
    const response = await api.get(`/api/investor/rental-yield/${salePropertyId}`);
    return response.data;
  },

  // Get market analysis for a location
  getMarketAnalysis: async (location: {
    province: string;
    city: string;
    suburb?: string;
  }, propertyType?: string): Promise<IMarketAnalysis> => {
    const response = await api.get("/api/investor/market-analysis", {
      params: { ...location, property_type: propertyType }
    });
    return response.data;
  },

  // Calculate fresh market analysis
  calculateMarketAnalysis: async (location: {
    province: string;
    city: string;
    suburb?: string;
  }, propertyType?: string): Promise<IMarketAnalysis> => {
    const response = await api.post("/api/investor/market-analysis", {
      location,
      property_type: propertyType
    });
    return response.data;
  },

  // Get investment opportunities
  getInvestmentOpportunities: async (filters: {
    min_yield?: number;
    location_city?: string;
    max_price?: number;
    limit?: number;
  } = {}): Promise<IInvestmentOpportunity[]> => {
    const response = await api.get("/api/investor/opportunities", { params: filters });
    return response.data;
  },

  // Get or create property expenses
  getPropertyExpenses: async (propertyId: number, propertyTable: 'properties' | 'rental_properties'): Promise<IPropertyExpenses> => {
    const response = await api.get(`/api/investor/expenses/${propertyTable}/${propertyId}`);
    return response.data;
  },

  // Update property expenses
  updatePropertyExpenses: async (expenses: Partial<IPropertyExpenses>): Promise<IPropertyExpenses> => {
    const response = await api.post("/api/investor/expenses", expenses);
    return response.data;
  },
};

export const scraperApi = {
  // Run scraper for specific source (with optional rental/sale type)
  runScraper: async (source: string, config?: IScraperConfig & { listingType?: 'sale' | 'rental' }): Promise<any> => {
    const response = await api.post(`/api/scraper/scrape/${source}`, config);
    return response.data;
  },

  // Run rental scraper specifically
  runRentalScraper: async (source: string, config?: IScraperConfig): Promise<any> => {
    console.log("🚀 ~ runRentalScraper: ~ source:", source)
    const response = await api.post(`/api/scraper/scrape-rentals/${source}`, config);
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

// USER MANAGEMENT API (Admin only)
export const userApi = {
  // Get all users
  getAllUsers: async (page = 1, limit = 20): Promise<{
    users: User[];
    pagination: {
      page: number;
      limit: number;
      hasMore: boolean;
    };
  }> => {
    const response = await api.get('/api/users/admin/users', {
      params: { page, limit }
    });
    return response.data;
  },

  // Update user role
  updateUserRole: async (userId: number, role: 'admin' | 'user' | 'viewer'): Promise<void> => {
    await api.put(`/api/users/admin/users/${userId}/role`, { role });
  },

  // Deactivate user
  deactivateUser: async (userId: number): Promise<void> => {
    await api.put(`/api/users/admin/users/${userId}/deactivate`);
  },

  // Create new user (manual registration by admin)
  createUser: async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<User> => {
    const response = await api.post('/api/users/auth/register', userData);
    return response.data.user;
  },

  // Update user's own password
  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.put('/api/users/profile/password', {
      currentPassword,
      newPassword
    });
  },
};

// User interface for management
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export default api;

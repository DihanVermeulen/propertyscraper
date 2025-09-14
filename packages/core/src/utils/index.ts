// ===== PROPERTY UTILITIES =====

import { PropertyType, MarketTemperature, DataSource } from '../enums';
import type { IProperty, IRentalProperty, IPropertyExpenses } from '../types';

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number | undefined, currency = 'ZAR'): string {
  if (price === undefined || price === null) return 'Price not listed';
  
  const formatter = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return formatter.format(price);
}

/**
 * Calculate gross rental yield
 */
export function calculateGrossRentalYield(
  purchasePrice: number,
  monthlyRental: number
): number {
  if (purchasePrice <= 0 || monthlyRental <= 0) return 0;
  const annualRental = monthlyRental * 12;
  return (annualRental / purchasePrice) * 100;
}

/**
 * Calculate net rental yield
 */
export function calculateNetRentalYield(
  purchasePrice: number,
  monthlyRental: number,
  monthlyExpenses: number
): number {
  if (purchasePrice <= 0 || monthlyRental <= 0) return 0;
  const annualRental = monthlyRental * 12;
  const annualExpenses = monthlyExpenses * 12;
  return ((annualRental - annualExpenses) / purchasePrice) * 100;
}

/**
 * Calculate total monthly expenses from property expenses object
 */
export function calculateMonthlyExpenses(expenses: IPropertyExpenses | null): number {
  if (!expenses) return 0;
  
  return (
    (expenses.municipal_rates || 0) +
    (expenses.body_corporate_levies || 0) +
    (expenses.insurance_estimate || 0) +
    (expenses.maintenance_reserve || 0)
  );
}

/**
 * Calculate price per square meter
 */
export function calculatePricePerSqm(price: number | undefined, floorArea: number | undefined): number | null {
  if (!price || !floorArea || floorArea <= 0) return null;
  return Math.round(price / floorArea);
}

/**
 * Generate property summary string
 */
export function generatePropertySummary(property: IProperty | IRentalProperty): string {
  const parts: string[] = [];
  
  if (property.bedrooms) {
    parts.push(`${property.bedrooms} bed${property.bedrooms > 1 ? 's' : ''}`);
  }
  
  if (property.bathrooms) {
    parts.push(`${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''}`);
  }
  
  if (property.parking_spaces) {
    parts.push(`${property.parking_spaces} parking`);
  }
  
  if (property.floor_area) {
    parts.push(`${property.floor_area}m²`);
  }
  
  return parts.join(' • ');
}

/**
 * Normalize property type string
 */
export function normalizePropertyType(propertyType: string | undefined): PropertyType {
  if (!propertyType) return PropertyType.OTHER;
  
  const normalized = propertyType.toLowerCase().trim();
  
  switch (normalized) {
    case 'house':
    case 'freehold':
      return PropertyType.HOUSE;
    case 'apartment':
    case 'flat':
      return PropertyType.APARTMENT;
    case 'townhouse':
    case 'town house':
      return PropertyType.TOWNHOUSE;
    case 'duplex':
      return PropertyType.DUPLEX;
    case 'cottage':
      return PropertyType.COTTAGE;
    case 'penthouse':
      return PropertyType.PENTHOUSE;
    case 'cluster home':
    case 'cluster':
      return PropertyType.CLUSTER_HOME;
    case 'security estate':
    case 'estate':
      return PropertyType.SECURITY_ESTATE;
    case 'vacant land':
    case 'land':
      return PropertyType.VACANT_LAND;
    case 'farm':
    case 'smallholding':
      return PropertyType.FARM;
    default:
      return PropertyType.OTHER;
  }
}

/**
 * Get market temperature color for UI
 */
export function getMarketTemperatureColor(temperature: MarketTemperature | undefined): string {
  switch (temperature) {
    case MarketTemperature.HOT:
      return '#ef4444'; // red
    case MarketTemperature.WARM:
      return '#f97316'; // orange
    case MarketTemperature.COOL:
      return '#3b82f6'; // blue
    case MarketTemperature.COLD:
      return '#6b7280'; // gray
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Calculate days on market
 */
export function calculateDaysOnMarket(listingDate: string | undefined, currentDate = new Date()): number {
  if (!listingDate) return 0;
  
  const listing = new Date(listingDate);
  const diffTime = Math.abs(currentDate.getTime() - listing.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format location string
 */
export function formatLocation(property: { location_suburb?: string; location_city?: string; location_province?: string }): string {
  const parts = [];
  
  if (property.location_suburb) parts.push(property.location_suburb);
  if (property.location_city) parts.push(property.location_city);
  if (property.location_province) parts.push(property.location_province);
  
  return parts.join(', ');
}

/**
 * Validate property data
 */
export function validatePropertyData(property: Partial<IProperty>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!property.external_id) errors.push('External ID is required');
  if (!property.title) errors.push('Title is required');
  if (!property.source_website) errors.push('Source website is required');
  if (!property.source_url) errors.push('Source URL is required');
  
  if (property.price !== undefined && property.price < 0) {
    errors.push('Price cannot be negative');
  }
  
  if (property.bedrooms !== undefined && property.bedrooms < 0) {
    errors.push('Bedrooms cannot be negative');
  }
  
  if (property.bathrooms !== undefined && property.bathrooms < 0) {
    errors.push('Bathrooms cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ===== SOURCE UTILITIES =====

/**
 * Normalize source website name
 */
export function normalizeSourceWebsite(source: string): string {
  return source.toLowerCase()
    .replace(/\.com$/, '')
    .replace(/\.co\.za$/, '')
    .trim();
}

/**
 * Get source website display name
 */
export function getSourceDisplayName(source: string): string {
  const normalized = normalizeSourceWebsite(source);
  
  switch (normalized) {
    case 'property24':
      return 'Property24';
    case 'privateproperty':
      return 'Private Property';
    case 'seeff':
      return 'Seeff';
    case 'pamplemousse':
      return 'Pamplemousse';
    case 'remax':
      return 'RE/MAX';
    case 'harcourts':
      return 'Harcourts';
    case 'rawson':
      return 'Rawson Properties';
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

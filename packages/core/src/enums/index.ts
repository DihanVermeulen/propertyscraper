// ===== PROPERTY ENUMS =====

export enum PropertyType {
  HOUSE = 'house',
  APARTMENT = 'apartment', 
  TOWNHOUSE = 'townhouse',
  FLAT = 'flat',
  DUPLEX = 'duplex',
  COTTAGE = 'cottage',
  PENTHOUSE = 'penthouse',
  CLUSTER_HOME = 'cluster_home',
  SECURITY_ESTATE = 'security_estate',
  VACANT_LAND = 'vacant_land',
  FARM = 'farm',
  COMMERCIAL = 'commercial',
  INDUSTRIAL = 'industrial',
  OTHER = 'other'
}

export enum PriceCurrency {
  ZAR = 'ZAR',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

export enum SourceWebsite {
  PROPERTY24 = 'property24',
  PRIVATE_PROPERTY = 'privateproperty',
  SEEFF = 'seeff',
  PAMPLEMOUSSE = 'pamplemousse',
  RE_MAX = 'remax',
  HARCOURTS = 'harcourts',
  RAWSON = 'rawson',
  OTHER = 'other'
}

export enum ChangeType {
  INITIAL = 'initial',
  INCREASE = 'increase',
  DECREASE = 'decrease',
  UPDATE = 'update'
}

export enum PropertyLifecycleEvent {
  LISTED = 'listed',
  DELISTED = 'delisted',
  RELISTED = 'relisted',
  PRICE_CHANGED = 'price_changed'
}

// ===== RENTAL PROPERTY ENUMS =====

export enum RentalPeriod {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily'
}

export enum FurnishedStatus {
  FURNISHED = 'furnished',
  SEMI_FURNISHED = 'semi-furnished',
  UNFURNISHED = 'unfurnished'
}

export enum PetPolicy {
  ALLOWED = 'allowed',
  NOT_ALLOWED = 'not_allowed',
  CATS_ONLY = 'cats_only',
  DOGS_ONLY = 'dogs_only',
  NEGOTIABLE = 'negotiable'
}

export enum RentalLifecycleEvent {
  LISTED = 'listed',
  DELISTED = 'delisted',
  RELISTED = 'relisted',
  PRICE_CHANGED = 'price_changed',
  RENTED = 'rented'
}

// ===== USER ENUMS =====

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

// ===== SCRAPING ENUMS =====

export enum ScrapeJobStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug'
}

export enum DataSource {
  SCRAPED = 'scraped',
  ESTIMATED = 'estimated',
  USER_INPUT = 'user_input'
}

export enum ExpenseScrapingStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

// ===== MARKET ANALYSIS ENUMS =====

export enum MarketTemperature {
  HOT = 'hot',
  WARM = 'warm',
  COOL = 'cool',
  COLD = 'cold'
}

-- Property Scraper Database Schema

-- Properties table to store scraped property data
CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE NOT NULL, -- ID from the source website
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(15,2),
    price_currency TEXT DEFAULT 'ZAR',
    property_type TEXT, -- house, apartment, townhouse, etc.
    bedrooms INTEGER,
    bathrooms INTEGER,
    parking_spaces INTEGER,
    floor_area INTEGER, -- in square meters
    erf_size INTEGER, -- in square meters
    location_province TEXT,
    location_city TEXT,
    location_suburb TEXT,
    location_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    source_website TEXT NOT NULL, -- property24, privateproperty, etc.
    source_url TEXT NOT NULL,
    images TEXT, -- JSON array of image URLs
    features TEXT, -- JSON array of features
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    listing_date DATE,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Price history to track price changes over time
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    price_currency TEXT DEFAULT 'ZAR',
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_type TEXT DEFAULT 'update', -- 'initial', 'increase', 'decrease', 'update'
    previous_price DECIMAL(15,2),
    change_amount DECIMAL(15,2),
    change_percentage DECIMAL(5,2),
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);

-- Property lifecycle events to track listing dates and market presence
CREATE TABLE IF NOT EXISTS property_lifecycle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'listed', 'delisted', 'relisted', 'price_changed'
    event_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    days_on_market INTEGER, -- calculated field for time on market
    metadata TEXT, -- JSON field for additional event data
    FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);

-- Scraping jobs to track scraper runs
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_website TEXT NOT NULL,
    status TEXT NOT NULL, -- running, completed, failed
    properties_found INTEGER DEFAULT 0,
    properties_new INTEGER DEFAULT 0,
    properties_updated INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    logs TEXT -- JSON array of log messages
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'user', 'viewer'
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table for JWT token management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- User sessions for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- User searches (for saved searches functionality)
CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Link to authenticated users
    name TEXT NOT NULL,
    filters TEXT NOT NULL, -- JSON object with search filters
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Rental Properties table (separate from sale properties)
CREATE TABLE IF NOT EXISTS rental_properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE NOT NULL, -- ID from the source website
    title TEXT NOT NULL,
    description TEXT,
    rental_price DECIMAL(10,2), -- Monthly rental amount
    rental_period TEXT DEFAULT 'monthly', -- 'monthly', 'weekly', 'daily'
    deposit DECIMAL(10,2), -- Security deposit amount
    lease_terms TEXT, -- Minimum lease period, special conditions
    available_date DATE, -- When property becomes available
    furnished_status TEXT, -- 'furnished', 'semi-furnished', 'unfurnished'
    utilities_included TEXT, -- JSON array of included utilities (water, electricity, wifi, etc.)
    pet_policy TEXT, -- 'allowed', 'not_allowed', 'cats_only', 'dogs_only', 'negotiable'
    -- Standard property fields
    property_type TEXT, -- house, apartment, townhouse, etc.
    bedrooms INTEGER,
    bathrooms INTEGER,
    parking_spaces INTEGER,
    floor_area INTEGER, -- in square meters
    erf_size INTEGER, -- in square meters
    -- Location fields
    location_province TEXT,
    location_city TEXT,
    location_suburb TEXT,
    location_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    -- Source and agent information
    source_website TEXT NOT NULL, -- property24, privateproperty, etc.
    source_url TEXT NOT NULL,
    images TEXT, -- JSON array of image URLs
    features TEXT, -- JSON array of features
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    -- Timestamps
    listing_date DATE,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Property Expenses table (for both sale and rental properties)
CREATE TABLE IF NOT EXISTS property_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL, -- References either properties or rental_properties
    property_table TEXT NOT NULL, -- 'properties' or 'rental_properties'
    -- Monthly expenses
    municipal_rates DECIMAL(10,2), -- Monthly municipal rates
    body_corporate_levies DECIMAL(10,2), -- Monthly body corporate levies
    insurance_estimate DECIMAL(10,2), -- Monthly insurance estimate
    maintenance_reserve DECIMAL(10,2), -- Monthly maintenance reserve
    -- Annual expenses
    municipal_taxes DECIMAL(10,2), -- Annual municipal taxes
    property_tax DECIMAL(10,2), -- Annual property tax
    -- Additional costs for investors
    transfer_costs DECIMAL(10,2), -- One-time transfer costs (for sale properties)
    bond_costs DECIMAL(10,2), -- Bond registration and legal costs
    -- Data source and timestamps
    data_source TEXT, -- 'scraped', 'estimated', 'user_input'
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rental Yield Analysis table (for investment analysis)
CREATE TABLE IF NOT EXISTS rental_yield_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_property_id INTEGER NOT NULL, -- Reference to properties table
    -- Rental market data
    area_avg_rental DECIMAL(10,2), -- Average monthly rental in area
    comparable_rental_count INTEGER, -- Number of comparable rentals used
    estimated_monthly_rental DECIMAL(10,2), -- Estimated rental for this property
    -- Yield calculations
    gross_rental_yield DECIMAL(5,2), -- (Annual Rent / Purchase Price) * 100
    net_rental_yield DECIMAL(5,2), -- After all expenses
    cash_on_cash_return DECIMAL(5,2), -- For leveraged purchases
    -- Investment metrics
    total_monthly_expenses DECIMAL(10,2), -- All monthly costs
    net_monthly_cash_flow DECIMAL(10,2), -- Rental income minus expenses
    break_even_rental DECIMAL(10,2), -- Minimum rental needed to break even
    -- Analysis metadata
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    calculation_method TEXT, -- Method used for estimation
    confidence_score DECIMAL(3,2), -- 0-1 score for estimate reliability
    FOREIGN KEY (sale_property_id) REFERENCES properties (id) ON DELETE CASCADE
);

-- Market Analysis table (for area-based investment insights)
CREATE TABLE IF NOT EXISTS market_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_province TEXT NOT NULL,
    location_city TEXT NOT NULL,
    location_suburb TEXT,
    property_type TEXT, -- Filter by property type or NULL for all types
    -- Sale market metrics
    avg_sale_price DECIMAL(15,2),
    median_sale_price DECIMAL(15,2),
    sale_price_trend DECIMAL(5,2), -- Percentage change month-over-month
    avg_days_on_market_sale INTEGER,
    total_sale_listings INTEGER,
    -- Rental market metrics
    avg_rental_price DECIMAL(10,2),
    median_rental_price DECIMAL(10,2),
    rental_price_trend DECIMAL(5,2), -- Percentage change month-over-month
    avg_days_on_market_rental INTEGER,
    total_rental_listings INTEGER,
    estimated_vacancy_rate DECIMAL(5,2),
    -- Investment metrics
    avg_price_to_rent_ratio DECIMAL(5,2), -- Purchase price / (Annual rent)
    avg_gross_yield DECIMAL(5,2),
    market_temperature TEXT, -- 'hot', 'warm', 'cool', 'cold'
    -- Analysis metadata
    analysis_period_start DATE,
    analysis_period_end DATE,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rental Price History table (similar to price_history but for rental properties)
CREATE TABLE IF NOT EXISTS rental_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rental_property_id INTEGER NOT NULL,
    rental_price DECIMAL(10,2) NOT NULL,
    rental_period TEXT DEFAULT 'monthly',
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_type TEXT DEFAULT 'update', -- 'initial', 'increase', 'decrease', 'update'
    previous_price DECIMAL(10,2),
    change_amount DECIMAL(10,2),
    change_percentage DECIMAL(5,2),
    FOREIGN KEY (rental_property_id) REFERENCES rental_properties (id) ON DELETE CASCADE
);

-- Rental Property Lifecycle table (similar to property_lifecycle but for rentals)
CREATE TABLE IF NOT EXISTS rental_property_lifecycle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rental_property_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- 'listed', 'delisted', 'relisted', 'price_changed', 'rented'
    event_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    days_on_market INTEGER, -- calculated field for time on market
    metadata TEXT, -- JSON field for additional event data
    FOREIGN KEY (rental_property_id) REFERENCES rental_properties (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location_province, location_city, location_suburb);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_scraped_at ON properties(scraped_at);
CREATE INDEX IF NOT EXISTS idx_properties_source ON properties(source_website);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_property ON property_lifecycle(property_id);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_event_type ON property_lifecycle(event_type);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_event_date ON property_lifecycle(event_date);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

-- Rental properties indexes
CREATE INDEX IF NOT EXISTS idx_rental_properties_location ON rental_properties(location_province, location_city, location_suburb);
CREATE INDEX IF NOT EXISTS idx_rental_properties_price ON rental_properties(rental_price);
CREATE INDEX IF NOT EXISTS idx_rental_properties_scraped_at ON rental_properties(scraped_at);
CREATE INDEX IF NOT EXISTS idx_rental_properties_source ON rental_properties(source_website);
CREATE INDEX IF NOT EXISTS idx_rental_properties_active ON rental_properties(is_active);
CREATE INDEX IF NOT EXISTS idx_rental_properties_available_date ON rental_properties(available_date);
CREATE INDEX IF NOT EXISTS idx_rental_properties_furnished ON rental_properties(furnished_status);

-- Rental price history indexes
CREATE INDEX IF NOT EXISTS idx_rental_price_history_property ON rental_price_history(rental_property_id);
CREATE INDEX IF NOT EXISTS idx_rental_price_history_recorded_at ON rental_price_history(recorded_at);

-- Rental property lifecycle indexes
CREATE INDEX IF NOT EXISTS idx_rental_property_lifecycle_property ON rental_property_lifecycle(rental_property_id);
CREATE INDEX IF NOT EXISTS idx_rental_property_lifecycle_event_type ON rental_property_lifecycle(event_type);
CREATE INDEX IF NOT EXISTS idx_rental_property_lifecycle_event_date ON rental_property_lifecycle(event_date);

-- Property expenses indexes
CREATE INDEX IF NOT EXISTS idx_property_expenses_property ON property_expenses(property_id, property_table);
CREATE INDEX IF NOT EXISTS idx_property_expenses_scraped_at ON property_expenses(scraped_at);

-- Rental yield analysis indexes
CREATE INDEX IF NOT EXISTS idx_rental_yield_analysis_property ON rental_yield_analysis(sale_property_id);
CREATE INDEX IF NOT EXISTS idx_rental_yield_analysis_date ON rental_yield_analysis(analysis_date);
CREATE INDEX IF NOT EXISTS idx_rental_yield_analysis_yield ON rental_yield_analysis(gross_rental_yield);

-- Market analysis indexes
CREATE INDEX IF NOT EXISTS idx_market_analysis_location ON market_analysis(location_province, location_city, location_suburb);
CREATE INDEX IF NOT EXISTS idx_market_analysis_calculated_at ON market_analysis(calculated_at);
CREATE INDEX IF NOT EXISTS idx_market_analysis_property_type ON market_analysis(property_type);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_event_date ON property_lifecycle(event_date);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON scrape_jobs(status);

-- Create triggers to update price history when property price changes
CREATE TRIGGER IF NOT EXISTS update_price_history 
AFTER UPDATE OF price ON properties
WHEN NEW.price != OLD.price AND NEW.price IS NOT NULL AND OLD.price IS NOT NULL
BEGIN
    INSERT INTO price_history (
        property_id, price, price_currency, 
        change_type, previous_price, change_amount, change_percentage
    ) VALUES (
        NEW.id, 
        NEW.price, 
        NEW.price_currency,
        CASE 
            WHEN NEW.price > OLD.price THEN 'increase'
            WHEN NEW.price < OLD.price THEN 'decrease'
            ELSE 'update'
        END,
        OLD.price,
        NEW.price - OLD.price,
        ROUND(((NEW.price - OLD.price) / OLD.price) * 100, 2)
    );
    
    -- Record lifecycle event for price change
    INSERT INTO property_lifecycle (property_id, event_type, metadata)
    VALUES (
        NEW.id, 
        'price_changed', 
        json_object(
            'old_price', OLD.price,
            'new_price', NEW.price,
            'change_amount', NEW.price - OLD.price,
            'change_percentage', ROUND(((NEW.price - OLD.price) / OLD.price) * 100, 2)
        )
    );
    
    UPDATE properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to track new property listings
CREATE TRIGGER IF NOT EXISTS track_new_property_listing
AFTER INSERT ON properties
BEGIN
    -- Record initial price in price history
    INSERT INTO price_history (
        property_id, price, price_currency, change_type
    ) VALUES (
        NEW.id, NEW.price, NEW.price_currency, 'initial'
    );
    
    -- Record listing event in lifecycle
    INSERT INTO property_lifecycle (property_id, event_type, days_on_market, metadata)
    VALUES (
        NEW.id, 
        'listed', 
        0,
        json_object(
            'initial_price', NEW.price,
            'listing_date', NEW.listing_date,
            'source', NEW.source_website
        )
    );
END;

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_properties_timestamp 
AFTER UPDATE ON properties
BEGIN
    UPDATE properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- RENTAL PROPERTIES TRIGGERS --

-- Trigger to update rental price history when rental price changes
CREATE TRIGGER IF NOT EXISTS update_rental_price_history 
AFTER UPDATE OF rental_price ON rental_properties
WHEN NEW.rental_price != OLD.rental_price AND NEW.rental_price IS NOT NULL AND OLD.rental_price IS NOT NULL
BEGIN
    INSERT INTO rental_price_history (
        rental_property_id, rental_price, rental_period, 
        change_type, previous_price, change_amount, change_percentage
    ) VALUES (
        NEW.id, 
        NEW.rental_price, 
        NEW.rental_period,
        CASE 
            WHEN NEW.rental_price > OLD.rental_price THEN 'increase'
            WHEN NEW.rental_price < OLD.rental_price THEN 'decrease'
            ELSE 'update'
        END,
        OLD.rental_price,
        NEW.rental_price - OLD.rental_price,
        ROUND(((NEW.rental_price - OLD.rental_price) / OLD.rental_price) * 100, 2)
    );
    
    -- Record lifecycle event for rental price change
    INSERT INTO rental_property_lifecycle (rental_property_id, event_type, metadata)
    VALUES (
        NEW.id, 
        'price_changed', 
        json_object(
            'old_price', OLD.rental_price,
            'new_price', NEW.rental_price,
            'change_amount', NEW.rental_price - OLD.rental_price,
            'change_percentage', ROUND(((NEW.rental_price - OLD.rental_price) / OLD.rental_price) * 100, 2)
        )
    );
    
    UPDATE rental_properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to track new rental property listings
CREATE TRIGGER IF NOT EXISTS track_new_rental_property_listing
AFTER INSERT ON rental_properties
BEGIN
    -- Record initial price in rental price history
    INSERT INTO rental_price_history (
        rental_property_id, rental_price, rental_period, change_type
    ) VALUES (
        NEW.id, NEW.rental_price, NEW.rental_period, 'initial'
    );
    
    -- Record listing event in rental lifecycle
    INSERT INTO rental_property_lifecycle (rental_property_id, event_type, days_on_market, metadata)
    VALUES (
        NEW.id, 
        'listed', 
        0,
        json_object(
            'initial_price', NEW.rental_price,
            'rental_period', NEW.rental_period,
            'listing_date', NEW.listing_date,
            'furnished_status', NEW.furnished_status,
            'source', NEW.source_website
        )
    );
END;

-- Trigger to update rental properties updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_rental_properties_timestamp 
AFTER UPDATE ON rental_properties
BEGIN
    UPDATE rental_properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

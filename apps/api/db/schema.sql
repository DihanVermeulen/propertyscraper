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

-- User searches (for saved searches functionality)
CREATE TABLE IF NOT EXISTS saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filters TEXT NOT NULL, -- JSON object with search filters
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run DATETIME,
    is_active BOOLEAN DEFAULT TRUE
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

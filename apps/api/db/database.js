const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        // Create db directory if it doesn't exist
        const dbDir = path.join(__dirname);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Connect to SQLite database
        const dbPath = path.join(__dirname, 'properties.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                throw err;
            }
            console.log('Connected to SQLite database');
            this.initSchema();
        });

        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');
    }

    async initSchema() {
        try {
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute the entire schema as one statement
            await new Promise((resolve, reject) => {
                this.db.exec(schema, (err) => {
                    if (err) {
                        console.error('Error executing schema:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            console.log('Database schema initialized successfully');
        } catch (error) {
            console.error('Error initializing database schema:', error.message);
            throw error;
        }
    }

    // Generic query method
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Generic run method for INSERT, UPDATE, DELETE
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Get a single row
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }

    // Property-specific methods
    async insertProperty(property) {
        const sql = `
            INSERT OR REPLACE INTO properties (
                external_id, title, description, price, price_currency,
                property_type, bedrooms, bathrooms, parking_spaces,
                floor_area, erf_size, location_province, location_city,
                location_suburb, location_address, latitude, longitude,
                source_website, source_url, images, features,
                agent_name, agent_phone, agent_email, listing_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            property.external_id, property.title, property.description,
            property.price, property.price_currency || 'ZAR', property.property_type,
            property.bedrooms, property.bathrooms, property.parking_spaces,
            property.floor_area, property.erf_size, property.location_province,
            property.location_city, property.location_suburb, property.location_address,
            property.latitude, property.longitude, property.source_website,
            property.source_url, JSON.stringify(property.images || []),
            JSON.stringify(property.features || []), property.agent_name,
            property.agent_phone, property.agent_email, property.listing_date
        ];

        return await this.run(sql, params);
    }

    async getProperties(filters = {}, limit = 50, offset = 0) {
        let sql = 'SELECT * FROM properties WHERE is_active = 1';
        const params = [];

        // Add filters
        if (filters.min_price) {
            sql += ' AND price >= ?';
            params.push(filters.min_price);
        }
        if (filters.max_price) {
            sql += ' AND price <= ?';
            params.push(filters.max_price);
        }
        if (filters.bedrooms) {
            sql += ' AND bedrooms >= ?';
            params.push(filters.bedrooms);
        }
        if (filters.bathrooms) {
            sql += ' AND bathrooms >= ?';
            params.push(filters.bathrooms);
        }
        if (filters.property_type) {
            sql += ' AND property_type = ?';
            params.push(filters.property_type);
        }
        if (filters.location_city) {
            sql += ' AND location_city LIKE ?';
            params.push(`%${filters.location_city}%`);
        }
        if (filters.location_suburb) {
            sql += ' AND location_suburb LIKE ?';
            params.push(`%${filters.location_suburb}%`);
        }
        if (filters.source_website) {
            sql += ' AND source_website = ?';
            params.push(filters.source_website);
        }

        sql += ' ORDER BY scraped_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await this.query(sql, params);
    }

    async getPropertyCount(filters = {}) {
        let sql = 'SELECT COUNT(*) as count FROM properties WHERE is_active = 1';
        const params = [];

        // Add same filters as getProperties
        if (filters.min_price) {
            sql += ' AND price >= ?';
            params.push(filters.min_price);
        }
        if (filters.max_price) {
            sql += ' AND price <= ?';
            params.push(filters.max_price);
        }
        if (filters.bedrooms) {
            sql += ' AND bedrooms >= ?';
            params.push(filters.bedrooms);
        }
        if (filters.bathrooms) {
            sql += ' AND bathrooms >= ?';
            params.push(filters.bathrooms);
        }
        if (filters.property_type) {
            sql += ' AND property_type = ?';
            params.push(filters.property_type);
        }
        if (filters.location_city) {
            sql += ' AND location_city LIKE ?';
            params.push(`%${filters.location_city}%`);
        }
        if (filters.location_suburb) {
            sql += ' AND location_suburb LIKE ?';
            params.push(`%${filters.location_suburb}%`);
        }
        if (filters.source_website) {
            sql += ' AND source_website = ?';
            params.push(filters.source_website);
        }

        const result = await this.get(sql, params);
        return result.count;
    }

    async getDashboardStats() {
        const stats = {};
        
        // Total properties
        const totalResult = await this.get('SELECT COUNT(*) as count FROM properties WHERE is_active = 1');
        stats.total_properties = totalResult.count;

        // Price statistics
        const priceStats = await this.get(`
            SELECT 
                AVG(price) as avg_price,
                MIN(price) as min_price,
                MAX(price) as max_price
            FROM properties 
            WHERE is_active = 1 AND price > 0
        `);
        stats.price_stats = priceStats;

        // Properties by location (top 10)
        const locationStats = await this.query(`
            SELECT 
                location_city,
                COUNT(*) as count,
                AVG(price) as avg_price
            FROM properties 
            WHERE is_active = 1 AND location_city IS NOT NULL
            GROUP BY location_city
            ORDER BY count DESC
            LIMIT 10
        `);
        stats.top_locations = locationStats;

        // Properties by source
        const sourceStats = await this.query(`
            SELECT 
                source_website,
                COUNT(*) as count
            FROM properties 
            WHERE is_active = 1
            GROUP BY source_website
        `);
        stats.source_distribution = sourceStats;

        // Recent scraping activity (last 7 days)
        const recentActivity = await this.query(`
            SELECT 
                DATE(scraped_at) as date,
                COUNT(*) as properties_scraped
            FROM properties 
            WHERE scraped_at >= date('now', '-7 days')
            GROUP BY DATE(scraped_at)
            ORDER BY date DESC
        `);
        stats.recent_activity = recentActivity;

        return stats;
    }

    async insertScrapeJob(job) {
        const timestamp = new Date().toISOString();
        const enhancedLogs = [
            {
                timestamp,
                level: 'info',
                message: 'Scrape job created',
                details: {
                    source: job.source_website,
                    initial_status: job.status
                }
            },
            ...(job.logs || [])
        ];

        const sql = `
            INSERT INTO scrape_jobs (source_website, status, logs)
            VALUES (?, ?, ?)
        `;
        return await this.run(sql, [job.source_website, job.status, JSON.stringify(enhancedLogs)]);
    }

    async updateScrapeJob(id, updates) {
        const timestamp = new Date().toISOString();
        const fields = [];
        const params = [];

        Object.keys(updates).forEach(key => {
            if (key === 'logs') {
                fields.push(`${key} = ?`);
                params.push(JSON.stringify([
                    {
                        timestamp,
                        level: 'info',
                        message: 'Job updated',
                        details: updates
                    },
                    ...updates[key]
                ]));
            } else {
                fields.push(`${key} = ?`);
                params.push(updates[key]);
            }
        });

        params.push(id);
        const sql = `UPDATE scrape_jobs SET ${fields.join(', ')} WHERE id = ?`;
        return await this.run(sql, params);
    }

    async getRecentScrapeJobs(limit = 20) {
        return await this.query(`
            SELECT * FROM scrape_jobs 
            ORDER BY started_at DESC 
            LIMIT ?
        `, [limit]);
    }

    // Price history methods
    async getPriceHistory(propertyId, limit = 100) {
        return await this.query(`
            SELECT * FROM price_history 
            WHERE property_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
        `, [propertyId, limit]);
    }

    async getAggregatedPriceHistory(filters = {}, days = 30) {
        let sql = `
            SELECT 
                DATE(ph.recorded_at) as date,
                AVG(ph.price) as avg_price,
                MIN(ph.price) as min_price,
                MAX(ph.price) as max_price,
                COUNT(DISTINCT ph.property_id) as property_count,
                COUNT(*) as price_changes
            FROM price_history ph
            JOIN properties p ON ph.property_id = p.id
            WHERE ph.recorded_at >= datetime('now', '-' || ? || ' days')
            AND p.is_active = 1
        `;
        const params = [days];

        // Add filters
        if (filters.location_city) {
            sql += ' AND p.location_city = ?';
            params.push(filters.location_city);
        }
        if (filters.property_type) {
            sql += ' AND p.property_type = ?';
            params.push(filters.property_type);
        }
        if (filters.source_website) {
            sql += ' AND p.source_website = ?';
            params.push(filters.source_website);
        }

        sql += `
            GROUP BY DATE(ph.recorded_at)
            ORDER BY date DESC
        `;

        return await this.query(sql, params);
    }

    async getPriceDistribution(filters = {}) {
        let sql = `
            SELECT 
                CASE 
                    WHEN price < 500000 THEN 'Under R500k'
                    WHEN price < 1000000 THEN 'R500k - R1M'
                    WHEN price < 2000000 THEN 'R1M - R2M'
                    WHEN price < 5000000 THEN 'R2M - R5M'
                    ELSE 'Over R5M'
                END as price_range,
                COUNT(*) as count,
                AVG(price) as avg_price
            FROM properties 
            WHERE is_active = 1 AND price IS NOT NULL
        `;
        const params = [];

        if (filters.location_city) {
            sql += ' AND location_city = ?';
            params.push(filters.location_city);
        }
        if (filters.property_type) {
            sql += ' AND property_type = ?';
            params.push(filters.property_type);
        }

        sql += `
            GROUP BY price_range
            ORDER BY avg_price ASC
        `;

        return await this.query(sql, params);
    }

    // Property lifecycle methods
    async getPropertyLifecycle(propertyId) {
        return await this.query(`
            SELECT * FROM property_lifecycle 
            WHERE property_id = ?
            ORDER BY event_date DESC
        `, [propertyId]);
    }

    async getTimeOnMarketStats(filters = {}) {
        let sql = `
            SELECT 
                p.id,
                p.title,
                p.location_city,
                p.location_suburb,
                p.price,
                p.listing_date,
                p.scraped_at,
                CASE 
                    WHEN p.listing_date IS NOT NULL THEN 
                        CAST((julianday('now') - julianday(p.listing_date)) AS INTEGER)
                    ELSE 
                        CAST((julianday('now') - julianday(p.scraped_at)) AS INTEGER)
                END as days_on_market,
                pl_first.event_date as first_listed_date,
                pl_latest.event_date as last_event_date
            FROM properties p
            LEFT JOIN (
                SELECT property_id, MIN(event_date) as event_date
                FROM property_lifecycle 
                WHERE event_type = 'listed'
                GROUP BY property_id
            ) pl_first ON p.id = pl_first.property_id
            LEFT JOIN (
                SELECT property_id, MAX(event_date) as event_date
                FROM property_lifecycle 
                GROUP BY property_id
            ) pl_latest ON p.id = pl_latest.property_id
            WHERE p.is_active = 1
        `;
        const params = [];

        if (filters.location_city) {
            sql += ' AND p.location_city = ?';
            params.push(filters.location_city);
        }
        if (filters.min_days) {
            sql += ' AND days_on_market >= ?';
            params.push(filters.min_days);
        }
        if (filters.max_days) {
            sql += ' AND days_on_market <= ?';
            params.push(filters.max_days);
        }

        sql += ' ORDER BY days_on_market DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.query(sql, params);
    }

    async getMarketTrends(days = 30) {
        return await this.query(`
            SELECT 
                DATE(recorded_at) as date,
                COUNT(CASE WHEN change_type = 'increase' THEN 1 END) as price_increases,
                COUNT(CASE WHEN change_type = 'decrease' THEN 1 END) as price_decreases,
                AVG(CASE WHEN change_type = 'increase' THEN change_percentage END) as avg_increase_pct,
                AVG(CASE WHEN change_type = 'decrease' THEN change_percentage END) as avg_decrease_pct,
                COUNT(*) as total_changes
            FROM price_history 
            WHERE recorded_at >= datetime('now', '-' || ? || ' days')
            AND change_type IN ('increase', 'decrease')
            GROUP BY DATE(recorded_at)
            ORDER BY date DESC
        `, [days]);
    }
}

// Create singleton instance
const database = new Database();

module.exports = database;

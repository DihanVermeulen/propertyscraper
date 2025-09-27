const sqlite3 = require("sqlite3").verbose();
const { createClient } = require('@libsql/client');
const fs = require("fs");
const path = require("path");

class Database {
  constructor() {
    this.db = null;
    this.adapter = null;
    this.isTurso = false;
    this.initialized = false;
    this.initPromise = this.init();
  }

  // Sanitize a single SQL parameter to be Turso/SQLite-safe
  sanitizeValue(value) {
    if (value === undefined) return null;
    if (value === null) return null;

    // Date -> ISO string
    if (value instanceof Date) return value.toISOString();

    const t = typeof value;
    if (t === 'boolean') return value ? 1 : 0;
    if (t === 'bigint') return Number(value);

    // Leave binary data as-is
    if (value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value))) {
      return value;
    }

    // JSON-serialize arrays/objects
    if (t === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }

    return value;
  }

  // Sanitize an array of SQL parameters
  sanitizeArgs(args = []) {
    return Array.isArray(args) ? args.map((v) => this.sanitizeValue(v)) : [];
  }
  
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  async init() {
    const useTurso = process.env.USE_TURSO === 'true';
    console.log("🚀 ~ Database ~ init ~ useTurso:", useTurso)
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (useTurso) {
      await this.initTurso();
    } else {
      await this.initSQLite();
    }
    
    await this.initSchema();
    this.initialized = true;
  }
  
  async initTurso() {
    console.log('🌐 Initializing Turso database connection...');
    
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL is required when USE_TURSO=true');
    }
    
    const config = {
      url: process.env.TURSO_DATABASE_URL
    };
    
    if (process.env.TURSO_AUTH_TOKEN) {
      config.authToken = process.env.TURSO_AUTH_TOKEN;
    }
    
    // Support for embedded replicas
    if (process.env.TURSO_SYNC_URL) {
      config.syncUrl = process.env.TURSO_SYNC_URL;
      if (process.env.TURSO_LOCAL_DB_PATH) {
        config.syncInterval = 5000; // Sync every 5 seconds
        console.log('📱 Using embedded replica mode');
      }
    }
    
    try {
      this.db = createClient(config);
      this.isTurso = true;
      this.adapter = new TursoAdapter(this.db);
      
      // Test the connection
      await this.testConnection();
      console.log('✅ Connected to Turso database');
    } catch (error) {
      console.error('❌ Failed to connect to Turso:', error.message);
      throw error;
    }
  }
  
  async initSQLite() {
    console.log('🗄️ Initializing local SQLite database...');
    
    // Determine database path
    let dbPath;
    let dbDir;
    
    if (process.env.DB_PATH) {
      dbPath = path.resolve(process.env.DB_PATH);
      dbDir = path.dirname(dbPath);
      console.log(`🗄️ Using configured database path: ${dbPath}`);
    } else {
      dbDir = path.join(__dirname);
      dbPath = path.join(__dirname, "properties.db");
      console.log(`🗄️ Using default database path: ${dbPath}`);
    }
    
    // Create db directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`📁 Created database directory: ${dbDir}`);
      } catch (error) {
        console.error(`❌ Failed to create database directory: ${error.message}`);
        throw new Error(`Cannot create database directory: ${dbDir}`);
      }
    }
    
    // Connect to SQLite database
    this.db = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error("❌ Error opening database:", err.message);
          reject(err);
        } else {
          console.log(`✅ Connected to SQLite database: ${path.basename(dbPath)}`);
          resolve(db);
        }
      });
    });
    
    this.isTurso = false;
    this.adapter = new SQLiteAdapter(this.db);
    
    // Enable foreign keys
    await this.adapter.run("PRAGMA foreign_keys = ON");
  }
  
  async testConnection() {
    if (this.isTurso) {
      // Test Turso connection
      await this.db.execute('SELECT 1 as test');
    }
  }

  async initSchema() {
    try {
      const schemaPath = path.join(__dirname, "schema.sql");
      const schema = fs.readFileSync(schemaPath, "utf8");

      if (this.isTurso) {
        // For Turso, we need to parse and execute statements properly
        const statements = this.parseSQLStatements(schema);
        console.log(`Executing ${statements.length} SQL statements...`);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (statement.trim()) {
            try {
              await this.db.execute(statement);
            } catch (error) {
              console.error(`Error executing statement ${i + 1}:`, error.message);
              console.error('Statement:', statement.substring(0, 200) + (statement.length > 200 ? '...' : ''));
              throw error;
            }
          }
        }
      } else {
        // For SQLite, execute the entire schema as one statement
        await new Promise((resolve, reject) => {
          this.db.exec(schema, (err) => {
            if (err) {
              console.error("Error executing schema:", err.message);
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      console.log("Database schema initialized successfully");
    } catch (error) {
      console.error("Error initializing database schema:", error.message);
      throw error;
    }
  }
  
  /**
   * Properly parse SQL statements handling complex triggers and multi-line statements
   */
  parseSQLStatements(sql) {
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Track trigger blocks
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
        triggerDepth = 0;
      }
      
      if (inTrigger) {
        if (trimmedLine.toUpperCase().includes('BEGIN')) {
          triggerDepth++;
        }
        if (trimmedLine.toUpperCase().includes('END')) {
          triggerDepth--;
          if (triggerDepth <= 0) {
            // End of trigger, look for semicolon
            if (trimmedLine.endsWith(';')) {
              statements.push(currentStatement.trim());
              currentStatement = '';
              inTrigger = false;
            }
          }
        }
      } else {
        // Not in trigger, split on semicolon
        if (trimmedLine.endsWith(';')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
  }

  // Generic query method - delegates to adapter
  async query(sql, params = []) {
    await this.ensureInitialized();
return await this.adapter.query(sql, this.sanitizeArgs(params));
  }

  // Generic run method for INSERT, UPDATE, DELETE - delegates to adapter
  async run(sql, params = []) {
    await this.ensureInitialized();
return await this.adapter.run(sql, this.sanitizeArgs(params));
  }

  // Get a single row - delegates to adapter
  async get(sql, params = []) {
    await this.ensureInitialized();
return await this.adapter.get(sql, this.sanitizeArgs(params));
  }

  // Close database connection
  close() {
    if (this.isTurso) {
      if (this.db && this.db.close) {
        this.db.close();
        console.log("Turso database connection closed");
      }
    } else {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error("Error closing database:", err.message);
          } else {
            console.log("SQLite database connection closed");
          }
        });
      }
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
      property.external_id,
      property.title,
      property.description,
      property.price,
      property.price_currency || "ZAR",
      property.property_type,
      property.bedrooms,
      property.bathrooms,
      property.parking_spaces,
      property.floor_area,
      property.erf_size,
      property.location_province,
      property.location_city,
      property.location_suburb,
      property.location_address,
      property.latitude,
      property.longitude,
      property.source_website,
      property.source_url,
      JSON.stringify(property.images || []),
      JSON.stringify(property.features || []),
      property.agent_name,
      property.agent_phone,
      property.agent_email,
      property.listing_date,
    ];

    return await this.run(sql, params);
  }

  /**
   * Batch insert multiple properties in a single transaction
   * @param {Array} properties - Array of property objects
   * @returns {Promise<Object>} Result with insert statistics
   */
  async batchInsertProperties(properties) {
    if (!properties || properties.length === 0) {
      return { inserted: 0, errors: [] };
    }

    const errors = [];
    let inserted = 0;

    if (this.isTurso) {
      // For Turso, use batch transaction
      const statements = properties.map(property => ({
        sql: `INSERT OR REPLACE INTO properties (
                external_id, title, description, price, price_currency,
                property_type, bedrooms, bathrooms, parking_spaces,
                floor_area, erf_size, location_province, location_city,
                location_suburb, location_address, latitude, longitude,
                source_website, source_url, images, features,
                agent_name, agent_phone, agent_email, listing_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          property.external_id,
          property.title,
          property.description,
          property.price,
          property.price_currency || "ZAR",
          property.property_type,
          property.bedrooms,
          property.bathrooms,
          property.parking_spaces,
          property.floor_area,
          property.erf_size,
          property.location_province,
          property.location_city,
          property.location_suburb,
          property.location_address,
          property.latitude,
          property.longitude,
          property.source_website,
          property.source_url,
          JSON.stringify(property.images || []),
          JSON.stringify(property.features || []),
          property.agent_name,
          property.agent_phone,
          property.agent_email,
          property.listing_date,
        ]
      }));

      try {
        // Sanitize all statement args before sending to Turso
        const sanitizedStatements = statements.map(st => ({ sql: st.sql, args: this.sanitizeArgs(st.args) }));
        const results = await this.db.batch(sanitizedStatements);
        
        // Count successful inserts - Turso returns rowsAffected for successful operations
        inserted = 0;
        results.forEach((result, index) => {
          if (result && !result.error && (result.rowsAffected > 0 || result.changes > 0)) {
            inserted++;
          }
        });
        
        // Collect errors
        results.forEach((result, index) => {
          if (result.error) {
            errors.push({
              property: properties[index],
              error: result.error.message || 'Unknown error'
            });
          }
        });
      } catch (error) {
        console.error('Batch insert failed:', error.message);
        errors.push({ error: error.message });
      }
    } else {
      // For SQLite, use transaction with individual inserts
      try {
        await new Promise((resolve, reject) => {
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            
            properties.forEach((property, index) => {
              const sql = `INSERT OR REPLACE INTO properties (
                          external_id, title, description, price, price_currency,
                          property_type, bedrooms, bathrooms, parking_spaces,
                          floor_area, erf_size, location_province, location_city,
                          location_suburb, location_address, latitude, longitude,
                          source_website, source_url, images, features,
                          agent_name, agent_phone, agent_email, listing_date
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
              
              const params = [
                property.external_id,
                property.title,
                property.description,
                property.price,
                property.price_currency || "ZAR",
                property.property_type,
                property.bedrooms,
                property.bathrooms,
                property.parking_spaces,
                property.floor_area,
                property.erf_size,
                property.location_province,
                property.location_city,
                property.location_suburb,
                property.location_address,
                property.latitude,
                property.longitude,
                property.source_website,
                property.source_url,
                JSON.stringify(property.images || []),
                JSON.stringify(property.features || []),
                property.agent_name,
                property.agent_phone,
                property.agent_email,
                property.listing_date,
              ];
              
              this.db.run(sql, params, function(err) {
                completed++;
                if (err) {
                  errors.push({ property, error: err.message });
                } else {
                  inserted++;
                }
                
                if (completed === properties.length) {
                  this.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      resolve();
                    }
                  });
                }
              });
            });
          });
        });
      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          this.db.run('ROLLBACK', () => resolve());
        });
        console.error('Batch transaction failed:', error.message);
        errors.push({ error: error.message });
      }
    }

    return { inserted, errors };
  }

  /**
   * Batch update multiple existing properties in a single transaction
   * @param {Array} properties - Array of property objects with external_id for identification
   * @returns {Promise<Object>} Result with update statistics
   */
  async batchUpdateProperties(properties) {
    if (!properties || properties.length === 0) {
      return { updated: 0, errors: [] };
    }

    const errors = [];
    let updated = 0;

    if (this.isTurso) {
      // For Turso, use batch transaction
      const statements = properties.map(property => ({
        sql: `UPDATE properties SET 
                title = ?, description = ?, price = ?, 
                property_type = ?, bedrooms = ?, bathrooms = ?,
                parking_spaces = ?, location_city = ?, location_suburb = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE external_id = ? AND source_website = ?`,
        args: [
          property.title,
          property.description,
          property.price,
          property.property_type,
          property.bedrooms,
          property.bathrooms,
          property.parking_spaces,
          property.location_city,
          property.location_suburb,
          property.external_id,
          property.source_website
        ]
      }));

      try {
        // Sanitize all statement args before sending to Turso
        const sanitizedStatements = statements.map(st => ({ sql: st.sql, args: this.sanitizeArgs(st.args) }));
        const results = await this.db.batch(sanitizedStatements);
        
        // Count successful updates - Turso returns rowsAffected for successful operations
        updated = 0;
        results.forEach((result, index) => {
          if (result && !result.error && (result.rowsAffected > 0 || result.changes > 0)) {
            updated++;
          }
        });
        
        // Collect errors
        results.forEach((result, index) => {
          if (result.error) {
            errors.push({
              property: properties[index],
              error: result.error.message || 'Unknown error'
            });
          }
        });
      } catch (error) {
        console.error('Batch update failed:', error.message);
        errors.push({ error: error.message });
      }
    } else {
      // For SQLite, use transaction with individual updates
      try {
        await new Promise((resolve, reject) => {
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            
            properties.forEach((property, index) => {
              const sql = `UPDATE properties SET 
                          title = ?, description = ?, price = ?, 
                          property_type = ?, bedrooms = ?, bathrooms = ?,
                          parking_spaces = ?, location_city = ?, location_suburb = ?,
                          updated_at = CURRENT_TIMESTAMP
                        WHERE external_id = ? AND source_website = ?`;
              
              const params = [
                property.title,
                property.description,
                property.price,
                property.property_type,
                property.bedrooms,
                property.bathrooms,
                property.parking_spaces,
                property.location_city,
                property.location_suburb,
                property.external_id,
                property.source_website
              ];
              
              this.db.run(sql, params, function(err) {
                completed++;
                if (err) {
                  errors.push({ property, error: err.message });
                } else if (this.changes > 0) {
                  updated++;
                }
                
                if (completed === properties.length) {
                  this.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      resolve();
                    }
                  });
                }
              });
            });
          });
        });
      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          this.db.run('ROLLBACK', () => resolve());
        });
        console.error('Batch update transaction failed:', error.message);
        errors.push({ error: error.message });
      }
    }

    return { updated, errors };
  }

  /**
   * Deactivate a property by setting is_active to false
   * @param {number} propertyId
   */
  async deactivateProperty(propertyId) {
    console.log("Deactivating property:", propertyId);
    await this.run("UPDATE properties SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      propertyId,
    ]);
  }

  /**
   * Reactivate a property by setting is_active to true
   * @param {number} propertyId
   */
  async reactivateProperty(propertyId) {
    console.log("Reactivating property:", propertyId);
    await this.run("UPDATE properties SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
      propertyId,
    ]);
  }

  async getProperties(filters = {}, limit = 50, offset = 0) {
    let sql = "SELECT * FROM properties WHERE is_active = 1";
    const params = [];

    // Add filters
    if (filters.min_price) {
      sql += " AND price >= ?";
      params.push(filters.min_price);
    }
    if (filters.max_price) {
      sql += " AND price <= ?";
      params.push(filters.max_price);
    }
    if (filters.bedrooms) {
      sql += " AND bedrooms >= ?";
      params.push(filters.bedrooms);
    }
    if (filters.bathrooms) {
      sql += " AND bathrooms >= ?";
      params.push(filters.bathrooms);
    }
    if (filters.property_type) {
      sql += " AND property_type = ?";
      params.push(filters.property_type);
    }
    if (filters.location_city) {
      sql += " AND location_city LIKE ?";
      params.push(`%${filters.location_city}%`);
    }
    if (filters.location_suburb) {
      sql += " AND location_suburb LIKE ?";
      params.push(`%${filters.location_suburb}%`);
    }
    if (filters.source_website) {
      sql += " AND source_website = ?";
      params.push(filters.source_website);
    }
    if (filters.min_floor_area) {
      sql += " AND floor_area >= ?";
      params.push(filters.min_floor_area);
    }
    if (filters.max_floor_area) {
      sql += " AND floor_area <= ?";
      params.push(filters.max_floor_area);
    }
    if (filters.floor_area_range) {
      if (filters.floor_area_range === "not_listed") {
        sql += " AND (floor_area IS NULL OR floor_area = 0)";
      } else if (filters.floor_area_range === "500+") {
        sql += " AND floor_area >= 500";
      } else if (filters.floor_area_range.includes("-")) {
        const [min, max] = filters.floor_area_range.split("-").map(Number);
        sql += " AND floor_area >= ? AND floor_area <= ?";
        params.push(min, max);
      }
    }
    sql += " AND is_active = 1";

    sql += " ORDER BY scraped_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return await this.query(sql, params);
  }

  async getPropertyCount(filters = {}) {
    let sql = "SELECT COUNT(*) as count FROM properties WHERE is_active = 1";
    const params = [];

    // Add same filters as getProperties
    if (filters.min_price) {
      sql += " AND price >= ?";
      params.push(filters.min_price);
    }
    if (filters.max_price) {
      sql += " AND price <= ?";
      params.push(filters.max_price);
    }
    if (filters.bedrooms) {
      sql += " AND bedrooms >= ?";
      params.push(filters.bedrooms);
    }
    if (filters.bathrooms) {
      sql += " AND bathrooms >= ?";
      params.push(filters.bathrooms);
    }
    if (filters.property_type) {
      sql += " AND property_type = ?";
      params.push(filters.property_type);
    }
    if (filters.location_city) {
      sql += " AND location_city LIKE ?";
      params.push(`%${filters.location_city}%`);
    }
    if (filters.location_suburb) {
      sql += " AND location_suburb LIKE ?";
      params.push(`%${filters.location_suburb}%`);
    }
    if (filters.source_website) {
      sql += " AND source_website = ?";
      params.push(filters.source_website);
    }
    if (filters.min_floor_area) {
      sql += " AND floor_area >= ?";
      params.push(filters.min_floor_area);
    }
    if (filters.max_floor_area) {
      sql += " AND floor_area <= ?";
      params.push(filters.max_floor_area);
    }
    if (filters.floor_area_range) {
      if (filters.floor_area_range === "not_listed") {
        sql += " AND (floor_area IS NULL OR floor_area = 0)";
      } else if (filters.floor_area_range === "500+") {
        sql += " AND floor_area >= 500";
      } else if (filters.floor_area_range.includes("-")) {
        const [min, max] = filters.floor_area_range.split("-").map(Number);
        sql += " AND floor_area >= ? AND floor_area <= ?";
        params.push(min, max);
      }
    }

    const result = await this.get(sql, params);
    return result.count;
  }

  async getDashboardStats() {
    const stats = {};

    // Total properties
    const totalResult = await this.get(
      "SELECT COUNT(*) as count FROM properties WHERE is_active = 1"
    );
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
        level: "info",
        message: "Scrape job created",
        details: {
          source: job.source_website,
          initial_status: job.status,
        },
      },
      ...(job.logs || []),
    ];

    const sql = `
            INSERT INTO scrape_jobs (source_website, status, logs)
            VALUES (?, ?, ?)
        `;
    return await this.run(sql, [
      job.source_website,
      job.status,
      JSON.stringify(enhancedLogs),
    ]);
  }

  async updateScrapeJob(id, updates) {
    const timestamp = new Date().toISOString();
    const fields = [];
    const params = [];

    Object.keys(updates).forEach((key) => {
      if (key === "logs") {
        fields.push(`${key} = ?`);
        params.push(
          JSON.stringify([
            {
              timestamp,
              level: "info",
              message: "Job updated",
              details: updates,
            },
            ...updates[key],
          ])
        );
      } else {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });

    params.push(id);
    const sql = `UPDATE scrape_jobs SET ${fields.join(", ")} WHERE id = ?`;
    return await this.run(sql, params);
  }

  async getRecentScrapeJobs(limit = 20) {
    return await this.query(
      `
            SELECT * FROM scrape_jobs 
            ORDER BY started_at DESC 
            LIMIT ?
        `,
      [limit]
    );
  }

  // Price history methods
  async getPriceHistory(propertyId, limit = 100) {
    return await this.query(
      `
            SELECT * FROM price_history 
            WHERE property_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
        `,
      [propertyId, limit]
    );
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
      sql += " AND p.location_city = ?";
      params.push(filters.location_city);
    }
    if (filters.property_type) {
      sql += " AND p.property_type = ?";
      params.push(filters.property_type);
    }
    if (filters.source_website) {
      sql += " AND p.source_website = ?";
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
      sql += " AND location_city = ?";
      params.push(filters.location_city);
    }
    if (filters.property_type) {
      sql += " AND property_type = ?";
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
    return await this.query(
      `
            SELECT * FROM property_lifecycle 
            WHERE property_id = ?
            ORDER BY event_date DESC
        `,
      [propertyId]
    );
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
      sql += " AND p.location_city = ?";
      params.push(filters.location_city);
    }
    if (filters.min_days) {
      sql += " AND days_on_market >= ?";
      params.push(filters.min_days);
    }
    if (filters.max_days) {
      sql += " AND days_on_market <= ?";
      params.push(filters.max_days);
    }

    sql += " ORDER BY days_on_market DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    return await this.query(sql, params);
  }

  async getMarketTrends(days = 30) {
    return await this.query(
      `
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
        `,
      [days]
    );
  }

  // RENTAL PROPERTIES METHODS

  async insertRentalProperty(property) {
    const sql = `
            INSERT OR REPLACE INTO rental_properties (
                external_id, title, description, rental_price, rental_period,
                deposit, lease_terms, available_date, furnished_status, utilities_included, pet_policy,
                property_type, bedrooms, bathrooms, parking_spaces,
                floor_area, erf_size, location_province, location_city,
                location_suburb, location_address, latitude, longitude,
                source_website, source_url, images, features,
                agent_name, agent_phone, agent_email, listing_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const params = [
      property.external_id,
      property.title,
      property.description,
      property.rental_price,
      property.rental_period || "monthly",
      property.deposit,
      property.lease_terms,
      property.available_date,
      property.furnished_status,
      JSON.stringify(property.utilities_included || []),
      property.pet_policy,
      property.property_type,
      property.bedrooms,
      property.bathrooms,
      property.parking_spaces,
      property.floor_area,
      property.erf_size,
      property.location_province,
      property.location_city,
      property.location_suburb,
      property.location_address,
      property.latitude,
      property.longitude,
      property.source_website,
      property.source_url,
      JSON.stringify(property.images || []),
      JSON.stringify(property.features || []),
      property.agent_name,
      property.agent_phone,
      property.agent_email,
      property.listing_date,
    ];

    return await this.run(sql, params);
  }

  /**
   * Batch insert multiple rental properties in a single transaction
   * @param {Array} properties - Array of rental property objects
   * @returns {Promise<Object>} Result with insert statistics
   */
  async batchInsertRentalProperties(properties) {
    if (!properties || properties.length === 0) {
      return { inserted: 0, errors: [] };
    }

    const errors = [];
    let inserted = 0;

    if (this.isTurso) {
      // For Turso, use batch transaction
      const statements = properties.map(property => ({
        sql: `INSERT OR REPLACE INTO rental_properties (
                external_id, title, description, rental_price, rental_period,
                deposit, lease_terms, available_date, furnished_status, utilities_included, pet_policy,
                property_type, bedrooms, bathrooms, parking_spaces,
                floor_area, erf_size, location_province, location_city,
                location_suburb, location_address, latitude, longitude,
                source_website, source_url, images, features,
                agent_name, agent_phone, agent_email, listing_date
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          property.external_id,
          property.title,
          property.description,
          property.rental_price,
          property.rental_period || "monthly",
          property.deposit,
          property.lease_terms,
          property.available_date,
          property.furnished_status,
          JSON.stringify(property.utilities_included || []),
          property.pet_policy,
          property.property_type,
          property.bedrooms,
          property.bathrooms,
          property.parking_spaces,
          property.floor_area,
          property.erf_size,
          property.location_province,
          property.location_city,
          property.location_suburb,
          property.location_address,
          property.latitude,
          property.longitude,
          property.source_website,
          property.source_url,
          JSON.stringify(property.images || []),
          JSON.stringify(property.features || []),
          property.agent_name,
          property.agent_phone,
          property.agent_email,
          property.listing_date,
        ]
      }));

      try {
        // Sanitize all statement args before sending to Turso
        const sanitizedStatements = statements.map(st => ({ sql: st.sql, args: this.sanitizeArgs(st.args) }));
        const results = await this.db.batch(sanitizedStatements);
        
        // Count successful inserts - Turso returns rowsAffected for successful operations
        inserted = 0;
        results.forEach((result, index) => {
          if (result && !result.error && (result.rowsAffected > 0 || result.changes > 0)) {
            inserted++;
          }
        });
        
        // Collect errors
        results.forEach((result, index) => {
          if (result.error) {
            errors.push({
              property: properties[index],
              error: result.error.message || 'Unknown error'
            });
          }
        });
      } catch (error) {
        console.error('Batch insert rental properties failed:', error.message);
        errors.push({ error: error.message });
      }
    } else {
      // For SQLite, use transaction with individual inserts
      try {
        await new Promise((resolve, reject) => {
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            
            properties.forEach((property, index) => {
              const sql = `INSERT OR REPLACE INTO rental_properties (
                          external_id, title, description, rental_price, rental_period,
                          deposit, lease_terms, available_date, furnished_status, utilities_included, pet_policy,
                          property_type, bedrooms, bathrooms, parking_spaces,
                          floor_area, erf_size, location_province, location_city,
                          location_suburb, location_address, latitude, longitude,
                          source_website, source_url, images, features,
                          agent_name, agent_phone, agent_email, listing_date
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
              
              const params = [
                property.external_id,
                property.title,
                property.description,
                property.rental_price,
                property.rental_period || "monthly",
                property.deposit,
                property.lease_terms,
                property.available_date,
                property.furnished_status,
                JSON.stringify(property.utilities_included || []),
                property.pet_policy,
                property.property_type,
                property.bedrooms,
                property.bathrooms,
                property.parking_spaces,
                property.floor_area,
                property.erf_size,
                property.location_province,
                property.location_city,
                property.location_suburb,
                property.location_address,
                property.latitude,
                property.longitude,
                property.source_website,
                property.source_url,
                JSON.stringify(property.images || []),
                JSON.stringify(property.features || []),
                property.agent_name,
                property.agent_phone,
                property.agent_email,
                property.listing_date,
              ];
              
              this.db.run(sql, params, function(err) {
                completed++;
                if (err) {
                  errors.push({ property, error: err.message });
                } else {
                  inserted++;
                }
                
                if (completed === properties.length) {
                  this.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      resolve();
                    }
                  });
                }
              });
            });
          });
        });
      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          this.db.run('ROLLBACK', () => resolve());
        });
        console.error('Batch rental insert transaction failed:', error.message);
        errors.push({ error: error.message });
      }
    }

    return { inserted, errors };
  }

  /**
   * Batch update multiple existing rental properties in a single transaction
   * @param {Array} properties - Array of rental property objects with external_id for identification
   * @returns {Promise<Object>} Result with update statistics
   */
  async batchUpdateRentalProperties(properties) {
    if (!properties || properties.length === 0) {
      return { updated: 0, errors: [] };
    }

    const errors = [];
    let updated = 0;

    if (this.isTurso) {
      // For Turso, use batch transaction
      const statements = properties.map(property => ({
        sql: `UPDATE rental_properties SET 
                title = ?, description = ?, rental_price = ?, rental_period = ?,
                deposit = ?, lease_terms = ?, available_date = ?, furnished_status = ?,
                utilities_included = ?, pet_policy = ?, property_type = ?, 
                bedrooms = ?, bathrooms = ?, parking_spaces = ?, floor_area = ?,
                location_city = ?, location_suburb = ?, updated_at = CURRENT_TIMESTAMP
              WHERE external_id = ? AND source_website = ?`,
        args: [
          property.title, property.description, property.rental_price,
          property.rental_period, property.deposit, property.lease_terms,
          property.available_date, property.furnished_status,
          JSON.stringify(property.utilities_included || []), property.pet_policy,
          property.property_type, property.bedrooms, property.bathrooms,
          property.parking_spaces, property.floor_area, property.location_city,
          property.location_suburb, property.external_id, property.source_website
        ]
      }));

      try {
        // Sanitize all statement args before sending to Turso
        const sanitizedStatements = statements.map(st => ({ sql: st.sql, args: this.sanitizeArgs(st.args) }));
        const results = await this.db.batch(sanitizedStatements);
        
        // Count successful updates - Turso returns rowsAffected for successful operations
        updated = 0;
        results.forEach((result, index) => {
          if (result && !result.error && (result.rowsAffected > 0 || result.changes > 0)) {
            updated++;
          }
        });
        
        // Collect errors
        results.forEach((result, index) => {
          if (result.error) {
            errors.push({
              property: properties[index],
              error: result.error.message || 'Unknown error'
            });
          }
        });
      } catch (error) {
        console.error('Batch rental update failed:', error.message);
        errors.push({ error: error.message });
      }
    } else {
      // For SQLite, use transaction with individual updates
      try {
        await new Promise((resolve, reject) => {
          this.db.serialize(() => {
            this.db.run('BEGIN TRANSACTION');
            
            let completed = 0;
            
            properties.forEach((property, index) => {
              const sql = `UPDATE rental_properties SET 
                          title = ?, description = ?, rental_price = ?, rental_period = ?,
                          deposit = ?, lease_terms = ?, available_date = ?, furnished_status = ?,
                          utilities_included = ?, pet_policy = ?, property_type = ?, 
                          bedrooms = ?, bathrooms = ?, parking_spaces = ?, floor_area = ?,
                          location_city = ?, location_suburb = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE external_id = ? AND source_website = ?`;
              
              const params = [
                property.title, property.description, property.rental_price,
                property.rental_period, property.deposit, property.lease_terms,
                property.available_date, property.furnished_status,
                JSON.stringify(property.utilities_included || []), property.pet_policy,
                property.property_type, property.bedrooms, property.bathrooms,
                property.parking_spaces, property.floor_area, property.location_city,
                property.location_suburb, property.external_id, property.source_website
              ];
              
              this.db.run(sql, params, function(err) {
                completed++;
                if (err) {
                  errors.push({ property, error: err.message });
                } else if (this.changes > 0) {
                  updated++;
                }
                
                if (completed === properties.length) {
                  this.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      resolve();
                    }
                  });
                }
              });
            });
          });
        });
      } catch (error) {
        // Rollback on error
        await new Promise((resolve) => {
          this.db.run('ROLLBACK', () => resolve());
        });
        console.error('Batch rental update transaction failed:', error.message);
        errors.push({ error: error.message });
      }
    }

    return { updated, errors };
  }

  async getRentalProperties(filters = {}, limit = 50, offset = 0) {
    let sql = "SELECT * FROM rental_properties WHERE is_active = 1";
    const params = [];

    // Add filters
    if (filters.min_rental_price) {
      sql += " AND rental_price >= ?";
      params.push(filters.min_rental_price);
    }
    if (filters.max_rental_price) {
      sql += " AND rental_price <= ?";
      params.push(filters.max_rental_price);
    }
    if (filters.bedrooms) {
      sql += " AND bedrooms >= ?";
      params.push(filters.bedrooms);
    }
    if (filters.bathrooms) {
      sql += " AND bathrooms >= ?";
      params.push(filters.bathrooms);
    }
    if (filters.property_type) {
      sql += " AND property_type = ?";
      params.push(filters.property_type);
    }
    if (filters.location_city) {
      sql += " AND location_city LIKE ?";
      params.push(`%${filters.location_city}%`);
    }
    if (filters.location_suburb) {
      sql += " AND location_suburb LIKE ?";
      params.push(`%${filters.location_suburb}%`);
    }
    if (filters.furnished_status) {
      sql += " AND furnished_status = ?";
      params.push(filters.furnished_status);
    }
    if (filters.pet_policy) {
      sql += " AND pet_policy = ?";
      params.push(filters.pet_policy);
    }
    if (filters.available_from) {
      sql += " AND (available_date IS NULL OR available_date <= ?)";
      params.push(filters.available_from);
    }
    if (filters.source_website) {
      sql += " AND source_website = ?";
      params.push(filters.source_website);
    }

    sql += " ORDER BY scraped_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return await this.query(sql, params);
  }

  async getRentalPropertyCount(filters = {}) {
    let sql =
      "SELECT COUNT(*) as count FROM rental_properties WHERE is_active = 1";
    const params = [];

    // Add same filters as getRentalProperties
    if (filters.min_rental_price) {
      sql += " AND rental_price >= ?";
      params.push(filters.min_rental_price);
    }
    if (filters.max_rental_price) {
      sql += " AND rental_price <= ?";
      params.push(filters.max_rental_price);
    }
    if (filters.bedrooms) {
      sql += " AND bedrooms >= ?";
      params.push(filters.bedrooms);
    }
    if (filters.bathrooms) {
      sql += " AND bathrooms >= ?";
      params.push(filters.bathrooms);
    }
    if (filters.property_type) {
      sql += " AND property_type = ?";
      params.push(filters.property_type);
    }
    if (filters.location_city) {
      sql += " AND location_city LIKE ?";
      params.push(`%${filters.location_city}%`);
    }
    if (filters.location_suburb) {
      sql += " AND location_suburb LIKE ?";
      params.push(`%${filters.location_suburb}%`);
    }
    if (filters.furnished_status) {
      sql += " AND furnished_status = ?";
      params.push(filters.furnished_status);
    }
    if (filters.pet_policy) {
      sql += " AND pet_policy = ?";
      params.push(filters.pet_policy);
    }
    if (filters.available_from) {
      sql += " AND (available_date IS NULL OR available_date <= ?)";
      params.push(filters.available_from);
    }
    if (filters.source_website) {
      sql += " AND source_website = ?";
      params.push(filters.source_website);
    }

    const result = await this.get(sql, params);
    return result.count;
  }

  // PROPERTY EXPENSES METHODS

  async insertPropertyExpenses(expenses) {
    const sql = `
            INSERT OR REPLACE INTO property_expenses (
                property_id, property_table, municipal_rates, body_corporate_levies,
                insurance_estimate, maintenance_reserve, municipal_taxes, property_tax,
                transfer_costs, bond_costs, data_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const params = [
      expenses.property_id,
      expenses.property_table,
      expenses.municipal_rates,
      expenses.body_corporate_levies,
      expenses.insurance_estimate,
      expenses.maintenance_reserve,
      expenses.municipal_taxes,
      expenses.property_tax,
      expenses.transfer_costs,
      expenses.bond_costs,
      expenses.data_source || "scraped",
    ];

    return await this.run(sql, params);
  }

  async getPropertyExpenses(propertyId, propertyTable) {
    return await this.get(
      "SELECT * FROM property_expenses WHERE property_id = ? AND property_table = ? ORDER BY scraped_at DESC LIMIT 1",
      [propertyId, propertyTable]
    );
  }

  // RENTAL YIELD ANALYSIS METHODS

  async calculateRentalYield(salePropertyId) {
    // Get the sale property
    const saleProperty = await this.get(
      "SELECT * FROM properties WHERE id = ? AND is_active = 1",
      [salePropertyId]
    );

    if (!saleProperty) {
      throw new Error("Sale property not found");
    }

    // Get comparable rental properties in the same area
    const comparableRentals = await this.query(
      `
            SELECT rental_price, bedrooms, bathrooms, property_type, floor_area
            FROM rental_properties 
            WHERE is_active = 1
            AND location_city = ?
            AND location_suburb = ?
            AND property_type = ?
            AND bedrooms >= ? AND bedrooms <= ?
            AND rental_period = 'monthly'
        `,
      [
        saleProperty.location_city,
        saleProperty.location_suburb,
        saleProperty.property_type,
        Math.max(1, saleProperty.bedrooms - 1),
        saleProperty.bedrooms + 1,
      ]
    );

    if (comparableRentals.length === 0) {
      return null; // No comparable rentals found
    }

    // Calculate average rental
    const avgRental =
      comparableRentals.reduce((sum, r) => sum + r.rental_price, 0) /
      comparableRentals.length;
    const estimatedMonthlyRental = avgRental;
    const annualRental = estimatedMonthlyRental * 12;

    // Get property expenses
    const expenses = await this.getPropertyExpenses(
      salePropertyId,
      "properties"
    );
    const monthlyExpenses =
      (expenses?.municipal_rates || 0) +
      (expenses?.body_corporate_levies || 0) +
      (expenses?.insurance_estimate || 0) +
      (expenses?.maintenance_reserve || 0);
    const annualExpenses =
      monthlyExpenses * 12 +
      (expenses?.municipal_taxes || 0) +
      (expenses?.property_tax || 0);

    // Calculate yields
    const grossRentalYield = (annualRental / saleProperty.price) * 100;
    const netRentalYield =
      ((annualRental - annualExpenses) / saleProperty.price) * 100;
    const netMonthlyCashFlow = estimatedMonthlyRental - monthlyExpenses;
    const breakEvenRental = monthlyExpenses;

    // Insert analysis
    const analysisData = {
      sale_property_id: salePropertyId,
      area_avg_rental: avgRental,
      comparable_rental_count: comparableRentals.length,
      estimated_monthly_rental: estimatedMonthlyRental,
      gross_rental_yield: grossRentalYield,
      net_rental_yield: netRentalYield,
      total_monthly_expenses: monthlyExpenses,
      net_monthly_cash_flow: netMonthlyCashFlow,
      break_even_rental: breakEvenRental,
      calculation_method: "comparable_rentals",
      confidence_score: Math.min(1.0, comparableRentals.length / 5), // Higher confidence with more comparables
    };

    const sql = `
            INSERT OR REPLACE INTO rental_yield_analysis (
                sale_property_id, area_avg_rental, comparable_rental_count, estimated_monthly_rental,
                gross_rental_yield, net_rental_yield, total_monthly_expenses, net_monthly_cash_flow,
                break_even_rental, calculation_method, confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const params = [
      analysisData.sale_property_id,
      analysisData.area_avg_rental,
      analysisData.comparable_rental_count,
      analysisData.estimated_monthly_rental,
      analysisData.gross_rental_yield,
      analysisData.net_rental_yield,
      analysisData.total_monthly_expenses,
      analysisData.net_monthly_cash_flow,
      analysisData.break_even_rental,
      analysisData.calculation_method,
      analysisData.confidence_score,
    ];

    await this.run(sql, params);
    return analysisData;
  }

  async getRentalYieldAnalysis(salePropertyId) {
    return await this.get(
      "SELECT * FROM rental_yield_analysis WHERE sale_property_id = ? ORDER BY analysis_date DESC LIMIT 1",
      [salePropertyId]
    );
  }

  // MARKET ANALYSIS METHODS

  async getMarketAnalysis(location = {}, propertyType = null) {
    return await this.get(
      `
            SELECT * FROM market_analysis 
            WHERE location_province = ? 
            AND location_city = ?
            AND (location_suburb = ? OR location_suburb IS NULL)
            AND (property_type = ? OR property_type IS NULL)
            ORDER BY calculated_at DESC 
            LIMIT 1
        `,
      [location.province, location.city, location.suburb || null, propertyType]
    );
  }

  async calculateMarketAnalysis(location = {}, propertyType = null) {
    // Calculate sale market metrics
    const saleMetrics = await this.get(
      `
            SELECT 
                AVG(price) as avg_sale_price,
                COUNT(*) as total_sale_listings,
                AVG(
                    CASE 
                        WHEN listing_date IS NOT NULL THEN 
                            CAST((julianday('now') - julianday(listing_date)) AS INTEGER)
                        ELSE 
                            CAST((julianday('now') - julianday(scraped_at)) AS INTEGER)
                    END
                ) as avg_days_on_market_sale
            FROM properties 
            WHERE is_active = 1
            AND location_province = ?
            AND location_city = ?
            ${location.suburb ? "AND location_suburb = ?" : ""}
            ${propertyType ? "AND property_type = ?" : ""}
        `,
      [
        location.province,
        location.city,
        ...(location.suburb ? [location.suburb] : []),
        ...(propertyType ? [propertyType] : []),
      ]
    );

    // Calculate rental market metrics
    const rentalMetrics = await this.get(
      `
            SELECT 
                AVG(rental_price) as avg_rental_price,
                COUNT(*) as total_rental_listings,
                AVG(
                    CASE 
                        WHEN listing_date IS NOT NULL THEN 
                            CAST((julianday('now') - julianday(listing_date)) AS INTEGER)
                        ELSE 
                            CAST((julianday('now') - julianday(scraped_at)) AS INTEGER)
                    END
                ) as avg_days_on_market_rental
            FROM rental_properties 
            WHERE is_active = 1
            AND location_province = ?
            AND location_city = ?
            ${location.suburb ? "AND location_suburb = ?" : ""}
            ${propertyType ? "AND property_type = ?" : ""}
        `,
      [
        location.province,
        location.city,
        ...(location.suburb ? [location.suburb] : []),
        ...(propertyType ? [propertyType] : []),
      ]
    );

    // Calculate investment metrics
    let avgPriceToRentRatio = null;
    let avgGrossYield = null;

    if (saleMetrics.avg_sale_price && rentalMetrics.avg_rental_price) {
      avgPriceToRentRatio =
        saleMetrics.avg_sale_price / (rentalMetrics.avg_rental_price * 12);
      avgGrossYield =
        ((rentalMetrics.avg_rental_price * 12) / saleMetrics.avg_sale_price) *
        100;
    }

    // Determine market temperature based on days on market
    let marketTemperature = "cool";
    const avgDaysOnMarket =
      (saleMetrics.avg_days_on_market_sale +
        rentalMetrics.avg_days_on_market_rental) /
      2;
    if (avgDaysOnMarket < 30) marketTemperature = "hot";
    else if (avgDaysOnMarket < 60) marketTemperature = "warm";
    else if (avgDaysOnMarket > 120) marketTemperature = "cold";

    const marketAnalysis = {
      location_province: location.province,
      location_city: location.city,
      location_suburb: location.suburb || null,
      property_type: propertyType,
      avg_sale_price: saleMetrics.avg_sale_price,
      median_sale_price: saleMetrics.avg_sale_price, // Simplified - could calculate actual median
      avg_days_on_market_sale: saleMetrics.avg_days_on_market_sale,
      total_sale_listings: saleMetrics.total_sale_listings,
      avg_rental_price: rentalMetrics.avg_rental_price,
      median_rental_price: rentalMetrics.avg_rental_price, // Simplified
      avg_days_on_market_rental: rentalMetrics.avg_days_on_market_rental,
      total_rental_listings: rentalMetrics.total_rental_listings,
      avg_price_to_rent_ratio: avgPriceToRentRatio,
      avg_gross_yield: avgGrossYield,
      market_temperature: marketTemperature,
      analysis_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      analysis_period_end: new Date().toISOString().split("T")[0],
    };

    // Insert into database
    const sql = `
            INSERT OR REPLACE INTO market_analysis (
                location_province, location_city, location_suburb, property_type,
                avg_sale_price, median_sale_price, avg_days_on_market_sale, total_sale_listings,
                avg_rental_price, median_rental_price, avg_days_on_market_rental, total_rental_listings,
                avg_price_to_rent_ratio, avg_gross_yield, market_temperature,
                analysis_period_start, analysis_period_end
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const params = [
      marketAnalysis.location_province,
      marketAnalysis.location_city,
      marketAnalysis.location_suburb,
      marketAnalysis.property_type,
      marketAnalysis.avg_sale_price,
      marketAnalysis.median_sale_price,
      marketAnalysis.avg_days_on_market_sale,
      marketAnalysis.total_sale_listings,
      marketAnalysis.avg_rental_price,
      marketAnalysis.median_rental_price,
      marketAnalysis.avg_days_on_market_rental,
      marketAnalysis.total_rental_listings,
      marketAnalysis.avg_price_to_rent_ratio,
      marketAnalysis.avg_gross_yield,
      marketAnalysis.market_temperature,
      marketAnalysis.analysis_period_start,
      marketAnalysis.analysis_period_end,
    ];

    await this.run(sql, params);
    return marketAnalysis;
  }

  async getRentalMarketStats(filters = {}) {
    const stats = {};

    // Total rental properties
    const totalResult = await this.get(
      "SELECT COUNT(*) as count FROM rental_properties WHERE is_active = 1"
    );
    stats.total_rental_properties = totalResult.count;

    // Rental price statistics
    const rentalStats = await this.get(`
            SELECT 
                AVG(rental_price) as avg_rental_price,
                MIN(rental_price) as min_rental_price,
                MAX(rental_price) as max_rental_price
            FROM rental_properties 
            WHERE is_active = 1 AND rental_price > 0
        `);
    stats.rental_price_stats = rentalStats;

    // Rental properties by location (top 10)
    const locationStats = await this.query(`
            SELECT 
                location_city,
                COUNT(*) as count,
                AVG(rental_price) as avg_rental_price
            FROM rental_properties 
            WHERE is_active = 1 AND location_city IS NOT NULL
            GROUP BY location_city
            ORDER BY count DESC
            LIMIT 10
        `);
    stats.top_rental_locations = locationStats;

    // Furnished vs unfurnished distribution
    const furnishedStats = await this.query(`
            SELECT 
                furnished_status,
                COUNT(*) as count,
                AVG(rental_price) as avg_price
            FROM rental_properties 
            WHERE is_active = 1 AND furnished_status IS NOT NULL
            GROUP BY furnished_status
        `);
    stats.furnished_distribution = furnishedStats;

    return stats;
  }

  async getInvestmentOpportunities(filters = {}, limit = 10) {
    // Get properties with calculated rental yields
    return await this.query(
      `
            SELECT 
                p.*,
                rya.gross_rental_yield,
                rya.net_rental_yield,
                rya.net_monthly_cash_flow,
                rya.estimated_monthly_rental,
                rya.confidence_score
            FROM properties p
            JOIN rental_yield_analysis rya ON p.id = rya.sale_property_id
            WHERE p.is_active = 1
            ${filters.min_yield ? "AND rya.gross_rental_yield >= ?" : ""}
            ${filters.location_city ? "AND p.location_city = ?" : ""}
            ${filters.max_price ? "AND p.price <= ?" : ""}
            ORDER BY rya.gross_rental_yield DESC
            LIMIT ?
        `,
      [
        ...(filters.min_yield ? [filters.min_yield] : []),
        ...(filters.location_city ? [filters.location_city] : []),
        ...(filters.max_price ? [filters.max_price] : []),
        limit,
      ]
    );
  }
}

// Database Adapter Classes
class SQLiteAdapter {
  constructor(db) {
    this.db = db;
  }

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

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

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
}

class TursoAdapter {
  sanitizeValue(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    const t = typeof value;
    if (t === 'boolean') return value ? 1 : 0;
    if (t === 'bigint') return Number(value);
    if (value instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(value))) {
      return value;
    }
    if (t === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return value;
  }

  sanitizeArgs(args = []) {
    return Array.isArray(args) ? args.map((v) => this.sanitizeValue(v)) : [];
  }
  constructor(db) {
    this.db = db;
  }

  async query(sql, params = []) {
const result = await this.db.execute({ sql, args: this.sanitizeArgs(params) });
    return result.rows.map(row => {
      const obj = {};
      result.columns.forEach((col, index) => {
        const value = row[index];
        // Convert BigInt to Number for JSON serialization
        obj[col] = typeof value === 'bigint' ? Number(value) : value;
      });
      return obj;
    });
  }

  async run(sql, params = []) {
const result = await this.db.execute({ sql, args: this.sanitizeArgs(params) });
    return {
      id: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      changes: result.rowsAffected || 0
    };
  }

  async get(sql, params = []) {
const result = await this.db.execute({ sql, args: this.sanitizeArgs(params) });
    if (result.rows.length === 0) {
      return undefined;
    }
    
    const obj = {};
    result.columns.forEach((col, index) => {
      const value = result.rows[0][index];
      // Convert BigInt to Number for JSON serialization
      obj[col] = typeof value === 'bigint' ? Number(value) : value;
    });
    return obj;
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;

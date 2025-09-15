const database = require('../db/database');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, meta }) => {
      return `${timestamp} [${level.toUpperCase()}] DelistingDetection: ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'delisting-detection.log' }),
  ],
});

class DelistingDetectionService {
    constructor() {
        this.gracePeriodHours = 48; // Default grace period before marking as delisted
    }

    /**
     * Integrated delisting detection during scraper runs
     * Call this after each scraper completes
     * 
     * @param {string} sourceWebsite - 'property24', 'privateproperty', etc.
     * @param {string} propertyType - 'sale' or 'rental'
     * @param {string[]} foundExternalIds - Array of external_ids found during scraping
     * @param {Object} locationFilter - Optional location filter used during scraping
     * @param {number} gracePeriodHours - Hours to wait before marking as delisted
     */
    async runScraperIntegratedDetection(sourceWebsite, propertyType, foundExternalIds, locationFilter = null, gracePeriodHours = null) {
        const runId = await this.startDetectionRun('scraper_integrated', sourceWebsite, propertyType, locationFilter, gracePeriodHours);
        
        try {
            // Enhance grace period based on property type and scraping completeness
            const enhancedGracePeriod = this.calculateEnhancedGracePeriod(
                gracePeriodHours || this.gracePeriodHours, 
                propertyType, 
                locationFilter
            );
            
            logger.info('Starting scraper-integrated delisting detection', {
                sourceWebsite,
                propertyType,
                foundCount: foundExternalIds.length,
                baseGracePeriod: gracePeriodHours || this.gracePeriodHours,
                enhancedGracePeriod: enhancedGracePeriod,
                completenessRatio: locationFilter?.completenessRatio
            });

            const tableName = propertyType === 'rental' ? 'rental_properties' : 'properties';
            const gracePeriod = enhancedGracePeriod;
            
            // Get all currently active properties for this source that should have been found
            let query = `
                SELECT id, external_id, title, last_seen_at, scraped_at
                FROM ${tableName}
                WHERE source_website = ? 
                AND is_active = 1
                AND last_seen_at < datetime('now', '-${gracePeriod} hours')
            `;
            let params = [sourceWebsite];
            
            // Add location filter if provided
            if (locationFilter) {
                if (locationFilter.city) {
                    query += ' AND location_city = ?';
                    params.push(locationFilter.city);
                }
                if (locationFilter.province) {
                    query += ' AND location_province = ?';
                    params.push(locationFilter.province);
                }
                if (locationFilter.suburb) {
                    query += ' AND location_suburb = ?';
                    params.push(locationFilter.suburb);
                }
            }

            const candidateProperties = await database.query(query, params);
            
            logger.info(`Found ${candidateProperties.length} properties that haven't been seen recently`);

            let delistedCount = 0;
            let relistedCount = 0;
            
            for (const property of candidateProperties) {
                const isStillListed = foundExternalIds.includes(property.external_id);
                
                if (!isStillListed) {
                    // Property not found in recent scrape - mark as delisted
                    await this.delistProperty(tableName, property.id, 'not_found', property);
                    delistedCount++;
                    
                    logger.info(`Delisted property: ${property.title} (${property.external_id})`, {
                        lastSeen: property.last_seen_at,
                        daysSinceLastSeen: this.calculateDaysDifference(property.last_seen_at, new Date())
                    });
                }
            }

            // Check for relisted properties (previously delisted properties that are now found again)
            if (foundExternalIds.length > 0) {
                const relistedProperties = await this.checkForRelistedProperties(tableName, sourceWebsite, foundExternalIds, locationFilter);
                relistedCount = relistedProperties.length;
                
                for (const property of relistedProperties) {
                    await this.relistProperty(tableName, property.id, property);
                    
                    logger.info(`Relisted property: ${property.title} (${property.external_id})`, {
                        delistedAt: property.delisted_at,
                        daysSinceDelisted: this.calculateDaysDifference(property.delisted_at, new Date())
                    });
                }
            }

            await this.completeDetectionRun(runId, candidateProperties.length, foundExternalIds.length, delistedCount, relistedCount);
            
            logger.info('Scraper-integrated delisting detection completed', {
                checked: candidateProperties.length,
                found: foundExternalIds.length,
                delisted: delistedCount,
                relisted: relistedCount
            });

            return {
                success: true,
                propertiesChecked: candidateProperties.length,
                propertiesFound: foundExternalIds.length,
                propertiesDelisted: delistedCount,
                propertiesRelisted: relistedCount
            };

        } catch (error) {
            logger.error('Error in scraper-integrated delisting detection', { error: error.message });
            await this.failDetectionRun(runId, error.message);
            throw error;
        }
    }

    /**
     * Periodic delisting detection job
     * Run this as a scheduled job independent of scraping
     * 
     * @param {string} sourceWebsite - 'property24', 'privateproperty', etc.
     * @param {string} propertyType - 'sale' or 'rental'
     * @param {Object} options - Configuration options
     */
    async runPeriodicDetection(sourceWebsite, propertyType, options = {}) {
        const {
            locationFilter = null,
            gracePeriodHours = this.gracePeriodHours,
            staleThresholdDays = 7,
            maxPropertiesToCheck = 1000
        } = options;

        const runId = await this.startDetectionRun('periodic_check', sourceWebsite, propertyType, locationFilter, gracePeriodHours);

        try {
            logger.info('Starting periodic delisting detection', {
                sourceWebsite,
                propertyType,
                staleThresholdDays,
                gracePeriodHours
            });

            const tableName = propertyType === 'rental' ? 'rental_properties' : 'properties';
            
            // Find properties that haven't been seen for a while
            let query = `
                SELECT id, external_id, title, last_seen_at, scraped_at, source_url
                FROM ${tableName}
                WHERE source_website = ? 
                AND is_active = 1
                AND last_seen_at < datetime('now', '-${staleThresholdDays} days')
                ORDER BY last_seen_at ASC
                LIMIT ?
            `;
            let params = [sourceWebsite, maxPropertiesToCheck];

            // Add location filter if provided
            if (locationFilter) {
                if (locationFilter.city) {
                    query = query.replace('ORDER BY', 'AND location_city = ? ORDER BY');
                    params.splice(-1, 0, locationFilter.city);
                }
            }

            const staleProperties = await database.query(query, params);
            
            logger.info(`Found ${staleProperties.length} stale properties to check`);

            let delistedCount = 0;
            
            for (const property of staleProperties) {
                const daysSinceLastSeen = this.calculateDaysDifference(property.last_seen_at, new Date());
                
                // More aggressive delisting for very old properties
                const shouldDelist = daysSinceLastSeen >= staleThresholdDays;
                
                if (shouldDelist) {
                    await this.delistProperty(tableName, property.id, 'expired', property);
                    delistedCount++;
                    
                    logger.info(`Delisted stale property: ${property.title} (${property.external_id})`, {
                        daysSinceLastSeen,
                        lastSeen: property.last_seen_at
                    });
                }
            }

            await this.completeDetectionRun(runId, staleProperties.length, 0, delistedCount, 0);
            
            logger.info('Periodic delisting detection completed', {
                checked: staleProperties.length,
                delisted: delistedCount
            });

            return {
                success: true,
                propertiesChecked: staleProperties.length,
                propertiesDelisted: delistedCount
            };

        } catch (error) {
            logger.error('Error in periodic delisting detection', { error: error.message });
            await this.failDetectionRun(runId, error.message);
            throw error;
        }
    }

    /**
     * Manually delist a specific property
     */
    async manuallyDelistProperty(propertyType, propertyId, reason = 'manual') {
        const tableName = propertyType === 'rental' ? 'rental_properties' : 'properties';
        const property = await database.get(`SELECT * FROM ${tableName} WHERE id = ?`, [propertyId]);
        
        if (!property) {
            throw new Error('Property not found');
        }
        
        if (!property.is_active) {
            throw new Error('Property is already delisted');
        }

        await this.delistProperty(tableName, propertyId, reason, property);
        
        logger.info(`Manually delisted property: ${property.title} (${property.external_id})`, {
            reason,
            propertyType
        });

        return property;
    }

    /**
     * Internal method to delist a property
     */
    async delistProperty(tableName, propertyId, reason, propertyData) {
        await database.run(`
            UPDATE ${tableName} 
            SET is_active = 0, 
                delisted_at = CURRENT_TIMESTAMP, 
                delisting_reason = ?
            WHERE id = ?
        `, [reason, propertyId]);
    }

    /**
     * Internal method to relist a property
     */
    async relistProperty(tableName, propertyId, propertyData) {
        await database.run(`
            UPDATE ${tableName} 
            SET is_active = 1, 
                delisted_at = NULL, 
                delisting_reason = NULL,
                last_seen_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [propertyId]);
    }

    /**
     * Check for previously delisted properties that are now found again
     */
    async checkForRelistedProperties(tableName, sourceWebsite, foundExternalIds, locationFilter) {
        if (foundExternalIds.length === 0) return [];

        const placeholders = foundExternalIds.map(() => '?').join(',');
        let query = `
            SELECT id, external_id, title, delisted_at, delisting_reason
            FROM ${tableName}
            WHERE source_website = ? 
            AND is_active = 0 
            AND delisted_at IS NOT NULL
            AND external_id IN (${placeholders})
        `;
        let params = [sourceWebsite, ...foundExternalIds];

        // Add location filter if provided
        if (locationFilter) {
            if (locationFilter.city) {
                query += ' AND location_city = ?';
                params.push(locationFilter.city);
            }
        }

        return await database.query(query, params);
    }

    /**
     * Start a detection run and return run ID
     */
    async startDetectionRun(runType, sourceWebsite, propertyType, locationFilter, gracePeriodHours) {
        const result = await database.run(`
            INSERT INTO delisting_detection_runs (
                run_type, source_website, property_type, location_filter, grace_period_hours
            ) VALUES (?, ?, ?, ?, ?)
        `, [
            runType, 
            sourceWebsite, 
            propertyType, 
            locationFilter ? JSON.stringify(locationFilter) : null,
            gracePeriodHours || this.gracePeriodHours
        ]);

        return result.id;
    }

    /**
     * Complete a detection run
     */
    async completeDetectionRun(runId, totalChecked, propertiesFound, propertiesDelisted, propertiesRelisted) {
        await database.run(`
            UPDATE delisting_detection_runs 
            SET completed_at = CURRENT_TIMESTAMP,
                status = 'completed',
                total_properties_checked = ?,
                properties_found = ?,
                properties_delisted = ?,
                properties_relisted = ?
            WHERE id = ?
        `, [totalChecked, propertiesFound, propertiesDelisted, propertiesRelisted, runId]);
    }

    /**
     * Mark a detection run as failed
     */
    async failDetectionRun(runId, errorMessage) {
        await database.run(`
            UPDATE delisting_detection_runs 
            SET completed_at = CURRENT_TIMESTAMP,
                status = 'failed',
                error_message = ?
            WHERE id = ?
        `, [errorMessage, runId]);
    }

    /**
     * Get statistics about delisting detection
     */
    async getDetectionStats(days = 30) {
        const stats = await database.get(`
            SELECT 
                COUNT(*) as total_runs,
                SUM(total_properties_checked) as total_checked,
                SUM(properties_delisted) as total_delisted,
                SUM(properties_relisted) as total_relisted,
                AVG(total_properties_checked) as avg_checked_per_run,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs
            FROM delisting_detection_runs
            WHERE started_at >= datetime('now', '-${days} days')
        `);

        const recentRuns = await database.query(`
            SELECT *
            FROM delisting_detection_runs
            WHERE started_at >= datetime('now', '-${days} days')
            ORDER BY started_at DESC
            LIMIT 10
        `);

        return {
            summary: stats,
            recent_runs: recentRuns
        };
    }

    /**
     * Calculate enhanced grace period based on property type, value, and scraping completeness
     * @param {number} baseGracePeriodHours - Base grace period in hours
     * @param {string} propertyType - 'sale' or 'rental'
     * @param {Object} locationFilter - Location filter with potential completeness info
     * @returns {number} Enhanced grace period in hours
     */
    calculateEnhancedGracePeriod(baseGracePeriodHours, propertyType, locationFilter = null) {
        let gracePeriod = baseGracePeriodHours;
        
        // Property type adjustments
        if (propertyType === 'rental') {
            // Rental properties typically move faster, shorter grace period
            gracePeriod = Math.max(24, gracePeriod * 0.75); // At least 24 hours, 75% of base
            logger.info(`Adjusted grace period for rental properties: ${gracePeriod} hours`);
        } else if (propertyType === 'sale') {
            // Sale properties, especially high-value ones, get longer grace periods
            // This could be enhanced with actual price data in the future
            gracePeriod = gracePeriod; // Keep base for now
        }
        
        // Scraping completeness adjustments
        if (locationFilter?.completenessRatio !== undefined) {
            const completeness = locationFilter.completenessRatio;
            
            if (completeness < 0.5) {
                // Very incomplete scrape - extend grace period significantly
                gracePeriod = gracePeriod * 2;
                logger.warn(`Very incomplete scrape (${(completeness * 100).toFixed(1)}%) - doubling grace period to ${gracePeriod} hours`);
            } else if (completeness < 0.8) {
                // Somewhat incomplete - extend grace period moderately
                gracePeriod = gracePeriod * 1.5;
                logger.info(`Incomplete scrape (${(completeness * 100).toFixed(1)}%) - extending grace period to ${gracePeriod} hours`);
            } else if (completeness > 1.1) {
                // Found more than expected - might be duplicate listings, be more conservative
                gracePeriod = Math.max(24, gracePeriod * 0.9);
                logger.info(`Over-complete scrape (${(completeness * 100).toFixed(1)}%) - slightly reducing grace period to ${gracePeriod} hours`);
            }
        }
        
        // Ensure minimum grace period
        gracePeriod = Math.max(12, gracePeriod); // Never less than 12 hours
        
        return Math.round(gracePeriod);
    }

    /**
     * Enhanced delisting with property-specific logic
     * @param {string} tableName - Table name ('properties' or 'rental_properties')
     * @param {number} propertyId - Property ID
     * @param {string} reason - Delisting reason
     * @param {Object} propertyData - Property data for enhanced decision making
     */
    async delistPropertyEnhanced(tableName, propertyId, reason, propertyData) {
        // Future enhancement: Could add property-specific logic here
        // For example, high-value properties might get additional verification
        
        // For now, use the standard delisting process
        await this.delistProperty(tableName, propertyId, reason, propertyData);
        
        // Log enhanced delisting information
        logger.info(`Enhanced delisting completed for property ID ${propertyId}`, {
            reason,
            title: propertyData.title?.substring(0, 50),
            lastSeen: propertyData.last_seen_at,
            daysSinceLastSeen: this.calculateDaysDifference(propertyData.last_seen_at, new Date())
        });
    }

    /**
     * Utility method to calculate days between two dates
     */
    calculateDaysDifference(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

module.exports = DelistingDetectionService;

const express = require('express');
const database = require('../db/database');
const router = express.Router();

// Fetch rental properties with filters
router.get('/rental-properties', async (req, res) => {
    try {
        const filters = req.query || {};
        const limit = parseInt(filters.limit, 10) || 10;
        const offset = parseInt(filters.offset, 10) || 0;
        delete filters.limit;
        delete filters.offset;

        const rental_properties = await database.getRentalProperties(filters, limit, offset);
        const totalResult = await database.getRentalPropertyCount(filters);
        const total = typeof totalResult === 'object' ? totalResult.count : totalResult;

        // Parse JSON fields for each rental property
        const parsedRentalProperties = rental_properties.map(property => {
            const parsed = { ...property };
            if (property.images && typeof property.images === 'string') {
                try { parsed.images = JSON.parse(property.images); } catch (e) { parsed.images = []; }
            }
            if (property.features && typeof property.features === 'string') {
                try { parsed.features = JSON.parse(property.features); } catch (e) { parsed.features = []; }
            }
            if (property.utilities_included && typeof property.utilities_included === 'string') {
                try { parsed.utilities_included = JSON.parse(property.utilities_included); } catch (e) { parsed.utilities_included = []; }
            }
            return parsed;
        });

        res.json({ rental_properties: parsedRentalProperties, total, limit, offset });
    } catch (error) {
        console.error('Error fetching rental properties:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch a single rental property by id
router.get('/rental-properties/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const rental_property = await database.get('SELECT * FROM rental_properties WHERE id = ?', [id]);

        if (!rental_property) {
            return res.status(404).json({ error: 'Rental property not found' });
        }

        // Parse JSON fields
        if (rental_property.images) {
            rental_property.images = JSON.parse(rental_property.images);
        }
        if (rental_property.features) {
            rental_property.features = JSON.parse(rental_property.features);
        }
        if (rental_property.utilities_included) {
            rental_property.utilities_included = JSON.parse(rental_property.utilities_included);
        }

        res.json(rental_property);
    } catch (error) {
        console.error('Error fetching rental property:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch rental market statistics
router.get('/rental-market-stats', async (req, res) => {
    try {
        const stats = await database.getRentalMarketStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching rental market stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get rental price history for a specific rental property
router.get('/rental-properties/:id/price-history', async (req, res) => {
    try {
        const rentalPropertyId = parseInt(req.params.id, 10);
        const limit = parseInt(req.query.limit, 10) || 100;
        
        const priceHistory = await database.query(`
            SELECT * FROM rental_price_history 
            WHERE rental_property_id = ?
            ORDER BY recorded_at DESC
            LIMIT ?
        `, [rentalPropertyId, limit]);
        
        const lifecycle = await database.query(`
            SELECT * FROM rental_property_lifecycle 
            WHERE rental_property_id = ?
            ORDER BY event_date DESC
        `, [rentalPropertyId]);
        
        res.json({
            price_history: priceHistory,
            lifecycle_events: lifecycle
        });
    } catch (error) {
        console.error('Error fetching rental property price history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get aggregated rental price history data for charts
router.get('/rental-price-history', async (req, res) => {
    try {
        const filters = {
            location_city: req.query.location_city,
            property_type: req.query.property_type,
            source_website: req.query.source_website
        };
        const days = parseInt(req.query.days, 10) || 30;
        
        // Get aggregated rental price history
        const aggregatedHistory = await database.query(`
            SELECT 
                DATE(rph.recorded_at) as date,
                AVG(rph.rental_price) as avg_rental_price,
                MIN(rph.rental_price) as min_rental_price,
                MAX(rph.rental_price) as max_rental_price,
                COUNT(DISTINCT rph.rental_property_id) as property_count,
                COUNT(*) as price_changes
            FROM rental_price_history rph
            JOIN rental_properties rp ON rph.rental_property_id = rp.id
            WHERE rph.recorded_at >= datetime('now', '-' || ? || ' days')
            AND rp.is_active = 1
            ${filters.location_city ? 'AND rp.location_city = ?' : ''}
            ${filters.property_type ? 'AND rp.property_type = ?' : ''}
            ${filters.source_website ? 'AND rp.source_website = ?' : ''}
            GROUP BY DATE(rph.recorded_at)
            ORDER BY date DESC
        `, [
            days,
            ...(filters.location_city ? [filters.location_city] : []),
            ...(filters.property_type ? [filters.property_type] : []),
            ...(filters.source_website ? [filters.source_website] : [])
        ]);
        
        // Get rental market trends
        const marketTrends = await database.query(`
            SELECT 
                DATE(recorded_at) as date,
                COUNT(CASE WHEN change_type = 'increase' THEN 1 END) as price_increases,
                COUNT(CASE WHEN change_type = 'decrease' THEN 1 END) as price_decreases,
                AVG(CASE WHEN change_type = 'increase' THEN change_percentage END) as avg_increase_pct,
                AVG(CASE WHEN change_type = 'decrease' THEN change_percentage END) as avg_decrease_pct,
                COUNT(*) as total_changes
            FROM rental_price_history 
            WHERE recorded_at >= datetime('now', '-' || ? || ' days')
            AND change_type IN ('increase', 'decrease')
            GROUP BY DATE(recorded_at)
            ORDER BY date DESC
        `, [days]);
        
        // Get rental price distribution
        const priceDistribution = await database.query(`
            SELECT 
                CASE 
                    WHEN rental_price < 5000 THEN 'Under R5k'
                    WHEN rental_price < 10000 THEN 'R5k - R10k'
                    WHEN rental_price < 15000 THEN 'R10k - R15k'
                    WHEN rental_price < 25000 THEN 'R15k - R25k'
                    ELSE 'Over R25k'
                END as price_range,
                COUNT(*) as count,
                AVG(rental_price) as avg_price
            FROM rental_properties 
            WHERE is_active = 1 AND rental_price IS NOT NULL
            ${filters.location_city ? 'AND location_city = ?' : ''}
            ${filters.property_type ? 'AND property_type = ?' : ''}
            GROUP BY price_range
            ORDER BY avg_price ASC
        `, [
            ...(filters.location_city ? [filters.location_city] : []),
            ...(filters.property_type ? [filters.property_type] : [])
        ]);
        
        res.json({
            aggregated_history: aggregatedHistory,
            market_trends: marketTrends,
            price_distribution: priceDistribution
        });
    } catch (error) {
        console.error('Error fetching aggregated rental price history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get rental time on market statistics
router.get('/rental-time-on-market', async (req, res) => {
    try {
        const filters = {
            location_city: req.query.location_city,
            min_days: req.query.min_days ? parseInt(req.query.min_days, 10) : undefined,
            max_days: req.query.max_days ? parseInt(req.query.max_days, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 50
        };
        
        let sql = `
            SELECT 
                rp.id,
                rp.title,
                rp.location_city,
                rp.location_suburb,
                rp.rental_price,
                rp.listing_date,
                rp.scraped_at,
                CASE 
                    WHEN rp.listing_date IS NOT NULL THEN 
                        CAST((julianday('now') - julianday(rp.listing_date)) AS INTEGER)
                    ELSE 
                        CAST((julianday('now') - julianday(rp.scraped_at)) AS INTEGER)
                END as days_on_market,
                rpl_first.event_date as first_listed_date,
                rpl_latest.event_date as last_event_date
            FROM rental_properties rp
            LEFT JOIN (
                SELECT rental_property_id, MIN(event_date) as event_date
                FROM rental_property_lifecycle 
                WHERE event_type = 'listed'
                GROUP BY rental_property_id
            ) rpl_first ON rp.id = rpl_first.rental_property_id
            LEFT JOIN (
                SELECT rental_property_id, MAX(event_date) as event_date
                FROM rental_property_lifecycle 
                GROUP BY rental_property_id
            ) rpl_latest ON rp.id = rpl_latest.rental_property_id
            WHERE rp.is_active = 1
        `;
        const params = [];

        if (filters.location_city) {
            sql += ' AND rp.location_city = ?';
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

        const timeOnMarketStats = await database.query(sql, params);
        
        // Calculate summary statistics
        const avgDays = timeOnMarketStats.reduce((sum, prop) => sum + prop.days_on_market, 0) / timeOnMarketStats.length || 0;
        const maxDays = Math.max(...timeOnMarketStats.map(prop => prop.days_on_market), 0);
        const minDays = Math.min(...timeOnMarketStats.map(prop => prop.days_on_market), 0);
        
        // Group by time ranges
        const timeRanges = {
            'Under 30 days': timeOnMarketStats.filter(p => p.days_on_market < 30).length,
            '30-90 days': timeOnMarketStats.filter(p => p.days_on_market >= 30 && p.days_on_market < 90).length,
            '90-180 days': timeOnMarketStats.filter(p => p.days_on_market >= 90 && p.days_on_market < 180).length,
            'Over 180 days': timeOnMarketStats.filter(p => p.days_on_market >= 180).length
        };
        
        res.json({
            properties: timeOnMarketStats,
            summary: {
                total_properties: timeOnMarketStats.length,
                avg_days_on_market: Math.round(avgDays),
                max_days_on_market: maxDays,
                min_days_on_market: minDays,
                time_ranges: timeRanges
            }
        });
    } catch (error) {
        console.error('Error fetching rental time on market stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

const express = require('express');
const database = require('../db/database');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const router = express.Router();

// Fetch properties with filters (optionally authenticated for personalized results)
router.get('/properties', optionalAuth, async (req, res) => {
    try {
        const filters = req.query || {};
        const limit = parseInt(filters.limit, 10) || 10;
        const offset = parseInt(filters.offset, 10) || 0;
        delete filters.limit;
        delete filters.offset;

        const properties = await database.getProperties(filters, limit, offset);
        const total = await database.getPropertyCount(filters);

        res.json({ properties, total, limit, offset });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch a single property by id
router.get('/properties/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const property = await database.get('SELECT * FROM properties WHERE id = ?', [id]);

        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        res.json(property);
    } catch (error) {
        console.error('Error fetching property:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch dashboard statistics (require authentication)
router.get('/dashboard', ...requireAuth, async (req, res) => {
    try {
        const stats = await database.getDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get price history for a specific property
router.get('/properties/:id/price-history', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id, 10);
        const limit = parseInt(req.query.limit, 10) || 100;
        
        const priceHistory = await database.getPriceHistory(propertyId, limit);
        const lifecycle = await database.getPropertyLifecycle(propertyId);
        
        res.json({
            price_history: priceHistory,
            lifecycle_events: lifecycle
        });
    } catch (error) {
        console.error('Error fetching property price history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Deactivate a specific property (admin only)
router.patch('/properties/:id/deactivate', ...requireAuth, async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id, 10);
        
        // Validate property ID
        if (isNaN(propertyId) || propertyId <= 0) {
            return res.status(400).json({ error: 'Invalid property ID' });
        }
        
        // Check if property exists and is active
        const property = await database.get('SELECT id, is_active FROM properties WHERE id = ?', [propertyId]);
        
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        
        if (!property.is_active) {
            return res.status(400).json({ error: 'Property is already inactive' });
        }
        
        // Deactivate the property
        await database.run('UPDATE properties SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [propertyId]);
        
        // Log the deactivation in lifecycle
        await database.run(
            'INSERT INTO property_lifecycle (property_id, event_type, metadata) VALUES (?, ?, ?)',
            [propertyId, 'delisted', JSON.stringify({ 
                deactivated_by: req.user.id, 
                reason: 'manual_deactivation',
                timestamp: new Date().toISOString() 
            })]
        );
        
        res.json({
            success: true,
            message: 'Property deactivated successfully'
        });
    } catch (error) {
        console.error('Error deactivating property:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Reactivate a specific property (admin only)
router.patch('/properties/:id/reactivate', ...requireAuth, async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id, 10);
        
        // Validate property ID
        if (isNaN(propertyId) || propertyId <= 0) {
            return res.status(400).json({ error: 'Invalid property ID' });
        }
        
        // Check if property exists and is inactive
        const property = await database.get('SELECT id, is_active FROM properties WHERE id = ?', [propertyId]);
        
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }
        
        if (property.is_active) {
            return res.status(400).json({ error: 'Property is already active' });
        }
        
        // Reactivate the property
        await database.run('UPDATE properties SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [propertyId]);
        
        // Log the reactivation in lifecycle
        await database.run(
            'INSERT INTO property_lifecycle (property_id, event_type, metadata) VALUES (?, ?, ?)',
            [propertyId, 'relisted', JSON.stringify({ 
                reactivated_by: req.user.id, 
                reason: 'manual_reactivation',
                timestamp: new Date().toISOString() 
            })]
        );
        
        res.json({
            success: true,
            message: 'Property reactivated successfully'
        });
    } catch (error) {
        console.error('Error reactivating property:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get aggregated price history data for charts (require authentication)
router.get('/price-history', ...requireAuth, async (req, res) => {
    try {
        const filters = {
            location_city: req.query.location_city,
            property_type: req.query.property_type,
            source_website: req.query.source_website
        };
        const days = parseInt(req.query.days, 10) || 30;
        
        const aggregatedHistory = await database.getAggregatedPriceHistory(filters, days);
        const marketTrends = await database.getMarketTrends(days);
        const priceDistribution = await database.getPriceDistribution(filters);
        
        res.json({
            aggregated_history: aggregatedHistory,
            market_trends: marketTrends,
            price_distribution: priceDistribution
        });
    } catch (error) {
        console.error('Error fetching aggregated price history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get time on market statistics (require authentication)
router.get('/time-on-market', ...requireAuth, async (req, res) => {
    try {
        const filters = {
            location_city: req.query.location_city,
            min_days: req.query.min_days ? parseInt(req.query.min_days, 10) : undefined,
            max_days: req.query.max_days ? parseInt(req.query.max_days, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 50
        };
        
        const timeOnMarketStats = await database.getTimeOnMarketStats(filters);
        
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
        console.error('Error fetching time on market stats:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

const express = require('express');
const database = require('../db/database');
const router = express.Router();

// Calculate rental yield for a sale property
router.post('/investor/rental-yield/:propertyId', async (req, res) => {
    try {
        const salePropertyId = parseInt(req.params.propertyId, 10);
        
        if (!salePropertyId) {
            return res.status(400).json({ error: 'Invalid property ID' });
        }

        const analysis = await database.calculateRentalYield(salePropertyId);
        
        if (!analysis) {
            return res.status(404).json({ 
                error: 'No comparable rental properties found for yield calculation' 
            });
        }

        res.json(analysis);
    } catch (error) {
        console.error('Error calculating rental yield:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get existing rental yield analysis for a property
router.get('/investor/rental-yield/:propertyId', async (req, res) => {
    try {
        const salePropertyId = parseInt(req.params.propertyId, 10);
        
        if (!salePropertyId) {
            return res.status(400).json({ error: 'Invalid property ID' });
        }

        const analysis = await database.getRentalYieldAnalysis(salePropertyId);
        
        if (!analysis) {
            return res.status(404).json({ error: 'No rental yield analysis found for this property' });
        }

        res.json(analysis);
    } catch (error) {
        console.error('Error fetching rental yield analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get market analysis for a location
router.get('/investor/market-analysis', async (req, res) => {
    try {
        const location = {
            province: req.query.province,
            city: req.query.city,
            suburb: req.query.suburb
        };
        const propertyType = req.query.property_type;
        
        if (!location.province || !location.city) {
            return res.status(400).json({ error: 'Province and city are required' });
        }

        const analysis = await database.getMarketAnalysis(location, propertyType);
        
        if (!analysis) {
            return res.status(404).json({ 
                error: 'No market analysis found for this location. Try calculating fresh analysis.' 
            });
        }

        res.json(analysis);
    } catch (error) {
        console.error('Error fetching market analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Calculate fresh market analysis for a location
router.post('/investor/market-analysis', async (req, res) => {
    try {
        const { location, property_type } = req.body;
        
        if (!location || !location.province || !location.city) {
            return res.status(400).json({ error: 'Location with province and city is required' });
        }

        const analysis = await database.calculateMarketAnalysis(location, property_type);
        res.json(analysis);
    } catch (error) {
        console.error('Error calculating market analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get investment opportunities (high-yield properties)
router.get('/investor/opportunities', async (req, res) => {
    try {
        const filters = {
            min_yield: req.query.min_yield ? parseFloat(req.query.min_yield) : undefined,
            location_city: req.query.location_city,
            max_price: req.query.max_price ? parseInt(req.query.max_price, 10) : undefined,
        };
        const limit = parseInt(req.query.limit, 10) || 10;

        const opportunities = await database.getInvestmentOpportunities(filters, limit);
        res.json(opportunities);
    } catch (error) {
        console.error('Error fetching investment opportunities:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get property expenses
router.get('/investor/expenses/:propertyTable/:propertyId', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.propertyId, 10);
        const propertyTable = req.params.propertyTable;
        
        if (!propertyId || !['properties', 'rental_properties'].includes(propertyTable)) {
            return res.status(400).json({ error: 'Invalid property ID or table' });
        }

        const expenses = await database.getPropertyExpenses(propertyId, propertyTable);
        
        if (!expenses) {
            return res.status(404).json({ error: 'No expense data found for this property' });
        }

        res.json(expenses);
    } catch (error) {
        console.error('Error fetching property expenses:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create or update property expenses
router.post('/investor/expenses', async (req, res) => {
    try {
        const expenses = req.body;
        
        if (!expenses.property_id || !expenses.property_table) {
            return res.status(400).json({ error: 'Property ID and table are required' });
        }
        
        if (!['properties', 'rental_properties'].includes(expenses.property_table)) {
            return res.status(400).json({ error: 'Invalid property table' });
        }

        const result = await database.insertPropertyExpenses(expenses);
        
        // Fetch the created/updated expenses
        const updatedExpenses = await database.getPropertyExpenses(expenses.property_id, expenses.property_table);
        
        res.json(updatedExpenses);
    } catch (error) {
        console.error('Error updating property expenses:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Bulk calculate rental yields for all properties in a location
router.post('/investor/bulk-calculate-yields', async (req, res) => {
    try {
        const { location, property_type } = req.body;
        const limit = parseInt(req.body.limit, 10) || 50;
        
        if (!location || !location.province || !location.city) {
            return res.status(400).json({ error: 'Location with province and city is required' });
        }

        // Get properties in the specified location that don't have recent yield analysis
        const properties = await database.query(`
            SELECT p.id 
            FROM properties p
            LEFT JOIN rental_yield_analysis rya ON p.id = rya.sale_property_id 
                AND rya.analysis_date >= datetime('now', '-30 days')
            WHERE p.is_active = 1
            AND p.location_province = ?
            AND p.location_city = ?
            ${location.suburb ? 'AND p.location_suburb = ?' : ''}
            ${property_type ? 'AND p.property_type = ?' : ''}
            AND rya.id IS NULL
            LIMIT ?
        `, [
            location.province,
            location.city,
            ...(location.suburb ? [location.suburb] : []),
            ...(property_type ? [property_type] : []),
            limit
        ]);

        const results = [];
        let processed = 0;
        let successful = 0;

        for (const property of properties) {
            try {
                const analysis = await database.calculateRentalYield(property.id);
                if (analysis) {
                    results.push(analysis);
                    successful++;
                }
                processed++;
            } catch (error) {
                console.log(`Failed to calculate yield for property ${property.id}: ${error.message}`);
                processed++;
            }
        }

        res.json({
            message: `Bulk yield calculation completed`,
            properties_processed: processed,
            successful_calculations: successful,
            failed_calculations: processed - successful,
            results: results
        });
    } catch (error) {
        console.error('Error in bulk yield calculation:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get comprehensive investment dashboard data
router.get('/investor/dashboard', async (req, res) => {
    try {
        const location = {
            province: req.query.province,
            city: req.query.city,
            suburb: req.query.suburb
        };

        // Get recent market analysis
        const marketAnalysis = await database.getMarketAnalysis(location);
        
        // Get top investment opportunities
        const opportunities = await database.getInvestmentOpportunities({
            location_city: location.city,
            min_yield: 8 // 8%+ yield opportunities
        }, 5);

        // Get rental market stats
        const rentalStats = await database.getRentalMarketStats();

        // Get recent sale properties with potential for yield calculation
        const saleProperties = await database.query(`
            SELECT p.*, rya.gross_rental_yield, rya.confidence_score
            FROM properties p
            LEFT JOIN rental_yield_analysis rya ON p.id = rya.sale_property_id
            WHERE p.is_active = 1
            ${location.city ? 'AND p.location_city = ?' : ''}
            ORDER BY p.scraped_at DESC
            LIMIT 10
        `, location.city ? [location.city] : []);

        res.json({
            market_analysis: marketAnalysis,
            investment_opportunities: opportunities,
            rental_market_stats: rentalStats,
            recent_sale_properties: saleProperties,
            location: location
        });
    } catch (error) {
        console.error('Error fetching investor dashboard data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

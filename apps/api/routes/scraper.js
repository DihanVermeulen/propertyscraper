const express = require('express');
const database = require('../db/database');
const Property24Scraper = require('../scrapers/property24Scraper');
const PrivatePropertyScraper = require('../scrapers/privatePropertyScraper');
const { normalizeSource, isValidSource } = require('../utils/sourceUtils');
const { requireAdminAccess } = require('../middleware/auth');
const jobManager = require('../services/JobManager');
const router = express.Router();

// Manual scraper execution (Background) - Admin only
router.post('/scrape/:source', ...requireAdminAccess, async (req, res) => {
    console.log('=== SCRAPER ENDPOINT CALLED ===');
    console.log('Request timestamp:', new Date().toISOString());
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    try {
        const source = req.params.source;
        const config = req.body || {};
        const normalizedSource = normalizeSource(source);
        const listingType = config.listingType || 'sale'; // Default to sale listings
        console.log('Source:', source, '-> Normalized:', normalizedSource);
        console.log('Listing Type:', listingType);
        console.log('Config:', config);
        
        if (!isValidSource(normalizedSource)) {
            return res.status(400).json({ 
                error: 'Invalid scraper source',
                validSources: ['property24', 'privateproperty']
            });
        }

        if (!['sale', 'rent'].includes(listingType)) {
            return res.status(400).json({ 
                error: 'Invalid listing type',
                validTypes: ['sale', 'rent']
            });
        }

        const jobKey = `${normalizedSource}_${listingType}`;

        // Check if job is already running
        if (jobManager.isJobRunning('scraper', jobKey)) {
            return res.status(409).json({ 
                error: `Scraper for ${normalizedSource} ${listingType} listings is already running`,
                status: 'running'
            });
        }

        // Define the scraper job function
        const scraperJobFunction = async (jobContext) => {
            let scraper;
            
            switch (normalizedSource) {
                case 'property24':
                    scraper = new Property24Scraper(listingType);
                    break;
                case 'privateproperty':
                    scraper = new PrivatePropertyScraper();
                    break;
                default:
                    throw new Error('Invalid scraper source');
            }
            
            // Build scraper options from config
            const scraperOptions = {
                location: {
                    city: config.location?.city || 'Somerset West',
                    province: config.location?.province || 'Western Cape', 
                    country: config.location?.country || 'South Africa',
                    p24_id: config.location?.p24_id || '390' // Default to Somerset West
                },
                maxPages: config.maxPages || 20,
                priceRange: config.priceRange || {},
                propertyTypes: config.propertyTypes || []
            };
            
            console.log('Running scraper with options:', scraperOptions);
            
            // Run the scraper with configuration
            return await scraper.scrape(scraperOptions);
        };

        // Start the job in background with 15-minute timeout
        const jobPromise = jobManager.startJob(
            'scraper', 
            jobKey, 
            scraperJobFunction,
            { 
                timeout: 15 * 60 * 1000 // 15 minutes
            }
        );

        // Don't await the job - let it run in background
        jobPromise.catch(error => {
            console.error(`Background scraper job failed for ${jobKey}:`, error);
        });

        // Return immediately with job started status
        res.json({ 
            message: `${normalizedSource} ${listingType} scraper started successfully in background`,
            status: 'started',
            source: normalizedSource,
            listingType: listingType,
            jobId: `scraper_${jobKey}_${Date.now()}`,
            estimatedDuration: '5-15 minutes',
            location: 'Somerset West, Western Cape, South Africa'
        });
        
    } catch (error) {
        console.error('Error starting scraper job:', error);
        res.status(500).json({ 
            error: 'Failed to start scraper job', 
            details: error.message 
        });
    }
});

// Dedicated rental property scraper endpoint - Admin only
router.post('/scrape-rentals/:source', ...requireAdminAccess, async (req, res) => {
    console.log('=== RENTAL SCRAPER ENDPOINT CALLED ===');
    console.log('Request timestamp:', new Date().toISOString());
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    
    try {
        const source = req.params.source;
        const config = req.body || {};
        const normalizedSource = normalizeSource(source);
        const listingType = 'rent'; // Fixed to rental properties
        console.log('Source:', source, '-> Normalized:', normalizedSource);
        console.log('Config:', config);
        
        if (!isValidSource(normalizedSource)) {
            return res.status(400).json({ 
                error: 'Invalid scraper source',
                validSources: ['property24', 'privateproperty']
            });
        }

        const jobKey = `${normalizedSource}_${listingType}`;

        // Check if job is already running
        if (jobManager.isJobRunning('scraper', jobKey)) {
            return res.status(409).json({ 
                error: `Rental scraper for ${normalizedSource} is already running`,
                status: 'running'
            });
        }

        // Define the scraper job function
        const scraperJobFunction = async (jobContext) => {
            let scraper;
            
            switch (normalizedSource) {
                case 'property24':
                    scraper = new Property24Scraper(listingType);
                    break;
                case 'privateproperty':
                    scraper = new PrivatePropertyScraper();
                    break;
                default:
                    throw new Error('Invalid scraper source');
            }
            
            // Build scraper options from config
            const scraperOptions = {
                location: {
                    city: config.location?.city || 'Somerset West',
                    province: config.location?.province || 'Western Cape', 
                    country: config.location?.country || 'South Africa',
                    p24_id: config.location?.p24_id || '390' // Default to Somerset West
                },
                maxPages: config.maxPages || 20,
                priceRange: config.priceRange || {},
                propertyTypes: config.propertyTypes || []
            };
            
            console.log('Running rental scraper with options:', scraperOptions);
            
            // Run the scraper with configuration
            return await scraper.scrape(scraperOptions);
        };

        // Start the job in background with 15-minute timeout
        const jobPromise = jobManager.startJob(
            'scraper', 
            jobKey, 
            scraperJobFunction,
            { 
                timeout: 15 * 60 * 1000 // 15 minutes
            }
        );

        // Don't await the job - let it run in background
        jobPromise.catch(error => {
            console.error(`Background rental scraper job failed for ${jobKey}:`, error);
        });

        // Return immediately with job started status
        res.json({ 
            message: `${normalizedSource} rental scraper started successfully in background`,
            status: 'started',
            source: normalizedSource,
            listingType: 'rent',
            jobId: `scraper_${jobKey}_${Date.now()}`,
            estimatedDuration: '5-15 minutes',
            location: 'Somerset West, Western Cape, South Africa'
        });
        
    } catch (error) {
        console.error('Error starting rental scraper job:', error);
        res.status(500).json({ 
            error: 'Failed to start rental scraper job', 
            details: error.message 
        });
    }
});

// Run all scrapers (Background)
router.post('/scrape-all', async (req, res) => {
    try {
        const config = req.body || {};
        const includeRentals = config.includeRentals || false;
        // const scraperSources = ['property24', 'privateproperty'];
        const scraperSources = ['property24'];
        const listingTypes = includeRentals ? ['sale', 'rent'] : ['sale'];
        const jobResults = [];
        const errors = [];

        for (const source of scraperSources) {
            for (const listingType of listingTypes) {
                try {
                    const jobKey = `${source}_${listingType}`;
                    
                    // Check if job is already running
                    if (jobManager.isJobRunning('scraper', jobKey)) {
                        jobResults.push({ 
                            source, 
                            listingType,
                            status: 'already_running',
                            message: `Scraper for ${source} ${listingType} listings is already running`
                        });
                        continue;
                    }

                    // Define the scraper job function
                    const scraperJobFunction = async (jobContext) => {
                        let scraper;
                        
                        switch (source) {
                            case 'property24':
                                scraper = new Property24Scraper(listingType);
                                break;
                            case 'privateproperty':
                                scraper = new PrivatePropertyScraper();
                                break;
                            default:
                                throw new Error('Invalid scraper source');
                        }
                        
                        // Use default scraper options for scrape-all
                        const scraperOptions = {
                            location: {
                                city: 'Somerset West',
                                province: 'Western Cape',
                                country: 'South Africa'
                            },
                            maxPages: 10 // Conservative default for scrape-all
                        };
                        
                        return await scraper.scrape(scraperOptions);
                    };

                    // Start the job in background with 15-minute timeout
                    const jobPromise = jobManager.startJob(
                        'scraper', 
                        jobKey, 
                        scraperJobFunction,
                        { 
                            timeout: 15 * 60 * 1000 // 15 minutes
                        }
                    );

                    // Don't await the job - let it run in background
                    jobPromise.catch(error => {
                        console.error(`Background scraper job failed for ${jobKey}:`, error);
                    });

                    jobResults.push({ 
                        source, 
                        listingType,
                        status: 'started',
                        message: `${source} ${listingType} scraper started successfully in background`
                    });
                    
                } catch (error) {
                    errors.push({ source, listingType, error: error.message });
                    jobResults.push({ 
                        source, 
                        listingType,
                        status: 'failed_to_start',
                        error: error.message
                    });
                }
            }
        }

        res.json({ 
            message: 'All available scrapers have been started in background',
            results: jobResults,
            errors: errors.length > 0 ? errors : undefined,
            location: 'Somerset West, Western Cape, South Africa',
            estimatedDuration: '5-15 minutes per scraper'
        });
        
    } catch (error) {
        console.error('Error running all scrapers:', error);
        res.status(500).json({ 
            error: 'Failed to start scraper jobs', 
            details: error.message 
        });
    }
});

// Get current running jobs
router.get('/jobs/running', async (req, res) => {
    try {
        const runningJobs = jobManager.getRunningJobs();
        const stats = jobManager.getStats();
        
        res.json({
            runningJobs,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching running jobs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Cancel a running job
router.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;
        const reason = req.body.reason || 'Job cancelled by user';
        
        await jobManager.cancelJob(jobId, reason);
        
        res.json({
            message: `Job ${jobId} has been cancelled`,
            reason,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({ 
            error: error.message 
        });
    }
});

// Get recent scrape jobs
router.get('/jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const jobs = await database.getRecentScrapeJobs(limit);
        
        // Parse logs JSON for each job
        const jobsWithParsedLogs = jobs.map(job => ({
            ...job,
            logs: job.logs ? JSON.parse(job.logs) : []
        }));
        
        res.json(jobsWithParsedLogs);
    } catch (error) {
        console.error('Error fetching scrape jobs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get scraper status
router.get('/status', async (req, res) => {
    try {
        // Define all available scrapers
        const availableScrapers = [
            {
                source_website: 'property24',
                display_name: 'Property24',
                status: 'ready',
                last_run: null,
                properties_found: 0,
                properties_new: 0,
                properties_updated: 0
            },
            {
                source_website: 'privateproperty',
                display_name: 'Private Property', 
                status: 'ready',
                last_run: null,
                properties_found: 0,
                properties_new: 0,
                properties_updated: 0
            }
        ];

        // Get latest job data for each scraper
        const jobs = await database.query(`
            SELECT 
                CASE 
                    WHEN source_website LIKE '%.com' OR source_website LIKE '%.co.za' 
                    THEN REPLACE(REPLACE(source_website, '.com', ''), '.co.za', '')
                    ELSE source_website
                END as source_website,
                status,
                MAX(started_at) as last_run,
                properties_found,
                properties_new,
                properties_updated
            FROM scrape_jobs 
            GROUP BY 
                CASE 
                    WHEN source_website LIKE '%.com' OR source_website LIKE '%.co.za' 
                    THEN REPLACE(REPLACE(source_website, '.com', ''), '.co.za', '')
                    ELSE source_website
                END
            ORDER BY last_run DESC
        `);
        
        // Merge available scrapers with job data
        const scrapersWithStatus = availableScrapers.map(scraper => {
            const jobData = jobs.find(job => job.source_website === scraper.source_website);
            return {
                ...scraper,
                ...jobData, // Overwrite with actual job data if exists
                status: jobData ? jobData.status : 'ready' // Show 'ready' if no previous jobs
            };
        });
        
        res.json(scrapersWithStatus);
    } catch (error) {
        console.error('Error fetching scraper status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

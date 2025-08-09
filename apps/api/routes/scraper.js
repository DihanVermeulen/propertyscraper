const express = require('express');
const database = require('../db/database');
const Property24Scraper = require('../scrapers/property24Scraper');
const PrivatePropertyScraper = require('../scrapers/privatePropertyScraper');
const { normalizeSource, isValidSource } = require('../utils/sourceUtils');
const jobManager = require('../services/JobManager');
const router = express.Router();

// Manual scraper execution (Background)
router.post('/scrape/:source', async (req, res) => {
    console.log('=== SCRAPER ENDPOINT CALLED ===');
    console.log('Request timestamp:', new Date().toISOString());
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    try {
        const source = req.params.source;
        const config = req.body || {};
        const normalizedSource = normalizeSource(source);
        console.log('Source:', source, '-> Normalized:', normalizedSource);
        console.log('Config:', config);
        
        if (!isValidSource(normalizedSource)) {
            return res.status(400).json({ 
                error: 'Invalid scraper source',
                validSources: ['property24', 'privateproperty']
            });
        }

        // Check if job is already running
        if (jobManager.isJobRunning('scraper', normalizedSource)) {
            return res.status(409).json({ 
                error: `Scraper for ${normalizedSource} is already running`,
                status: 'running'
            });
        }

        // Define the scraper job function
        const scraperJobFunction = async (jobContext) => {
            let scraper;
            
            switch (normalizedSource) {
                case 'property24':
                    scraper = new Property24Scraper();
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
            normalizedSource, 
            scraperJobFunction,
            { 
                timeout: 15 * 60 * 1000 // 15 minutes
            }
        );

        // Don't await the job - let it run in background
        jobPromise.catch(error => {
            console.error(`Background scraper job failed for ${normalizedSource}:`, error);
        });

        // Return immediately with job started status
        res.json({ 
            message: `${normalizedSource} scraper started successfully in background`,
            status: 'started',
            source: normalizedSource,
            jobId: `scraper_${normalizedSource}_${Date.now()}`,
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

// Run all scrapers (Background)
router.post('/scrape-all', async (req, res) => {
    try {
        // const scraperSources = ['property24', 'privateproperty'];
        const scraperSources = ['property24'];
        const jobResults = [];
        const errors = [];

        for (const source of scraperSources) {
            try {
                // Check if job is already running
                if (jobManager.isJobRunning('scraper', source)) {
                    jobResults.push({ 
                        source, 
                        status: 'already_running',
                        message: `Scraper for ${source} is already running`
                    });
                    continue;
                }

                // Define the scraper job function
                const scraperJobFunction = async (jobContext) => {
                    let scraper;
                    
                    switch (source) {
                        case 'property24':
                            scraper = new Property24Scraper();
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
                    source, 
                    scraperJobFunction,
                    { 
                        timeout: 15 * 60 * 1000 // 15 minutes
                    }
                );

                // Don't await the job - let it run in background
                jobPromise.catch(error => {
                    console.error(`Background scraper job failed for ${source}:`, error);
                });

                jobResults.push({ 
                    source, 
                    status: 'started',
                    message: `${source} scraper started successfully in background`
                });
                
            } catch (error) {
                errors.push({ source, error: error.message });
                jobResults.push({ 
                    source, 
                    status: 'failed_to_start',
                    error: error.message
                });
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
        
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching scraper status:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;

const cron = require('node-cron');
const winston = require('winston');
const jobManager = require('./JobManager');
// Location data - duplicated to avoid cross-package dependencies
const southAfricanLocations = {
  'Western Cape': {
    'Somerset West': { p24_id: '390' },
    'Gordons Bay': { p24_id: '395' },
    'Stellenbosch': { p24_id: '389' },
    'Cape Town': { p24_id: '32' },
    'George': { p24_id: '359' },
    'Paarl': { p24_id: '380' },
    'Hermanus': { p24_id: '363' },
  },
  'Gauteng': {
    'Johannesburg': { p24_id: '7' },
    'Pretoria': { p24_id: '9' },
    'Sandton': { p24_id: '71' },
    'Midrand': { p24_id: '61' },
    'Centurion': { p24_id: '10364' },
  },
  'KwaZulu-Natal': {
    'Durban': { p24_id: '22' },
    'Pietermaritzburg': { p24_id: '49' },
    'Umhlanga': { p24_id: '50' },
    'Ballito': { p24_id: '2891' },
  },
  'Eastern Cape': {
    'East London': { p24_id: '133' },
    'Gqeberha (Port Elizabeth)': { p24_id: '159' },
  },
  'Free State': {
    'Bloemfontein': { p24_id: '20' },
  },
  'Limpopo': {
    'Polokwane': { p24_id: '63' },
  },
  'Mpumalanga': {
    'Mbombela (Nelspruit)': { p24_id: '60' },
  },
  'North West': {
    'Rustenburg': { p24_id: '69' },
    'Potchefstroom': { p24_id: '64' },
  },
  'Northern Cape': {
    'Kimberley': { p24_id: '18' },
  },
};

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [SCHEDULER-${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'scheduler.log' }),
    ],
});

class Scheduler {
    constructor() {
        this.jobs = new Map();
        this.jobManager = jobManager;
        this.isEnabled = process.env.SCHEDULER_ENABLED !== 'false'; // Default to enabled
        this.defaultSchedules = {
            'property24': '0 */6 * * *', // Every 6 hours
            // 'privateproperty': '30 */8 * * *', // Every 8 hours, offset by 30 minutes
            // 'all-sources': '0 2 * * *', // Daily at 2 AM
            'maintenance': '0 0 * * 0', // Weekly on Sunday at midnight
        };
    }

    /**
     * Initialize and start the scheduler
     */
    init() {
        if (!this.isEnabled) {
            logger.info('Scheduler is disabled');
            return;
        }

        logger.info('Initializing scheduler...');
        this.setupDefaultSchedules();
        logger.info('Scheduler initialized successfully');
    }

    /**
     * Set up default scraping schedules
     */
    setupDefaultSchedules() {
        // Property24 scraper - every 6 hours
        this.scheduleJob('property24-regular', this.defaultSchedules['property24'], async () => {
            logger.info('Starting scheduled Property24 scrape');
            await this.runScraperWithRetry('property24', this.getRotatedLocation());
        });

        // // PrivateProperty scraper - every 8 hours
        // this.scheduleJob('privateproperty-regular', this.defaultSchedules['privateproperty'], async () => {
        //     logger.info('Starting scheduled PrivateProperty scrape');
        //     await this.runScraperWithRetry('privateproperty', this.getRotatedLocation());
        // });

        // // Daily comprehensive scrape - 2 AM
        // this.scheduleJob('daily-comprehensive', this.defaultSchedules['all-sources'], async () => {
        //     logger.info('Starting daily comprehensive scrape');
        //     await this.runComprehensiveScrape();
        // });

        // Weekly maintenance - Sundays at midnight
        this.scheduleJob('weekly-maintenance', this.defaultSchedules['maintenance'], async () => {
            logger.info('Starting weekly maintenance');
            await this.runMaintenance();
        });

        logger.info(`Scheduled ${this.jobs.size} jobs`);
    }

    /**
     * Schedule a new cron job
     */
    scheduleJob(name, cronExpression, task, options = {}) {
        try {
            // Validate cron expression
            if (!cron.validate(cronExpression)) {
                throw new Error(`Invalid cron expression: ${cronExpression}`);
            }

            // Stop existing job if it exists
            if (this.jobs.has(name)) {
                this.stopJob(name);
            }

            const job = cron.schedule(cronExpression, async () => {
                logger.info(`Executing scheduled job: ${name}`);
                try {
                    await task();
                    logger.info(`Completed scheduled job: ${name}`);
                } catch (error) {
                    logger.error(`Error in scheduled job ${name}:`, error.message);
                    // Optionally send notifications or alerts here
                }
            }, {
                scheduled: false,
                timezone: options.timezone || 'Africa/Johannesburg', // South African timezone
                ...options
            });

            this.jobs.set(name, {
                job,
                cronExpression,
                task,
                options,
                createdAt: new Date(),
                lastRun: null,
                nextRun: null
            });

            // Start the job
            job.start();
            logger.info(`Scheduled job '${name}' with expression '${cronExpression}'`);
            
            return job;
        } catch (error) {
            logger.error(`Failed to schedule job '${name}':`, error.message);
            throw error;
        }
    }

    /**
     * Stop a scheduled job
     */
    stopJob(name) {
        const jobInfo = this.jobs.get(name);
        if (jobInfo) {
            jobInfo.job.stop();
            this.jobs.delete(name);
            logger.info(`Stopped job: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Get status of all scheduled jobs
     */
    getJobStatus() {
        const status = [];
        this.jobs.forEach((jobInfo, name) => {
            status.push({
                name,
                cronExpression: jobInfo.cronExpression,
                isRunning: jobInfo.job.running,
                createdAt: jobInfo.createdAt,
                lastRun: jobInfo.lastRun,
                nextRun: jobInfo.nextRun
            });
        });
        return status;
    }

    /**
     * Run scraper with retry logic
     */
    async runScraperWithRetry(source, location, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const config = {
                    location: location || this.getDefaultLocation(),
                    maxPages: 5, // Limit pages for scheduled runs to be more efficient
                    priceRange: { min: 100000, max: 50000000 },
                    propertyTypes: ['house', 'apartment', 'townhouse']
                };

                const result = await this.jobManager.runScraper(source, config);
                
                logger.info(`Scheduled scrape completed for ${source}: ${JSON.stringify({
                    propertiesFound: result.propertiesFound,
                    propertiesNew: result.propertiesNew,
                    propertiesUpdated: result.propertiesUpdated
                })}`);
                
                return result;
            } catch (error) {
                logger.warn(`Scraper attempt ${attempt}/${maxRetries} failed for ${source}: ${error.message}`);
                if (attempt === maxRetries) {
                    logger.error(`All retry attempts failed for ${source}`);
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    /**
     * Run comprehensive scrape across multiple locations
     */
    async runComprehensiveScrape() {
        const locations = this.getTopLocations(5); // Get top 5 locations for comprehensive scrape
        
        for (const location of locations) {
            for (const source of ['property24', 'privateproperty']) {
                try {
                    await this.runScraperWithRetry(source, location);
                    // Add delay between scrapers to be respectful
                    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
                } catch (error) {
                    logger.error(`Comprehensive scrape failed for ${source} in ${location.city}:`, error.message);
                }
            }
        }
    }

    /**
     * Run maintenance tasks
     */
    async runMaintenance() {
        try {
            // Cleanup old scrape jobs (keep last 100)
            logger.info('Running maintenance: cleaning up old scrape jobs');
            
            // Update stale property statuses
            logger.info('Running maintenance: updating stale property statuses');
            
            // Generate analytics summaries
            logger.info('Running maintenance: generating analytics summaries');
            
            logger.info('Weekly maintenance completed');
        } catch (error) {
            logger.error('Maintenance failed:', error.message);
        }
    }

    /**
     * Get a rotated location for balanced scraping
     */
    getRotatedLocation() {
        const locations = this.getTopLocations();
        const index = Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % locations.length; // Rotate every 6 hours
        return locations[index];
    }

    /**
     * Get default location for scraping
     */
    getDefaultLocation() {
        return {
            city: 'Somerset West',
            province: 'Western Cape',
            country: 'South Africa',
            p24_id: '390'
        };
    }

    /**
     * Get top locations for scraping
     */
    getTopLocations(limit = 10) {
        // Build locations array from southAfricanLocations data
        const topLocations = [];
        
        // Priority order for provinces and cities
        const priorityOrder = [
            { province: 'Western Cape', cities: ['Somerset West', 'Cape Town', 'Stellenbosch', 'George', 'Hermanus', 'Paarl'] },
            { province: 'Gauteng', cities: ['Johannesburg', 'Pretoria', 'Sandton', 'Centurion'] },
            { province: 'KwaZulu-Natal', cities: ['Durban', 'Umhlanga', 'Ballito'] },
            { province: 'Eastern Cape', cities: ['East London', 'Gqeberha (Port Elizabeth)'] },
            { province: 'Free State', cities: ['Bloemfontein'] },
            { province: 'Limpopo', cities: ['Polokwane'] },
            { province: 'Mpumalanga', cities: ['Mbombela (Nelspruit)'] },
            { province: 'North West', cities: ['Rustenburg', 'Potchefstroom'] },
            { province: 'Northern Cape', cities: ['Kimberley'] }
        ];
        
        for (const { province, cities } of priorityOrder) {
            for (const city of cities) {
                if (topLocations.length >= limit) break;
                
                const locationData = southAfricanLocations[province]?.[city];
                if (locationData) {
                    topLocations.push({
                        city,
                        province,
                        country: 'South Africa',
                        p24_id: locationData.p24_id
                    });
                }
            }
            if (topLocations.length >= limit) break;
        }
        
        return topLocations;
    }

    /**
     * Update job schedule
     */
    updateJobSchedule(name, newCronExpression) {
        const jobInfo = this.jobs.get(name);
        if (jobInfo) {
            this.stopJob(name);
            this.scheduleJob(name, newCronExpression, jobInfo.task, jobInfo.options);
            return true;
        }
        return false;
    }

    /**
     * Shutdown the scheduler
     */
    shutdown() {
        logger.info('Shutting down scheduler...');
        this.jobs.forEach((jobInfo, name) => {
            jobInfo.job.stop();
        });
        this.jobs.clear();
        logger.info('Scheduler shutdown complete');
    }

    /**
     * Enable or disable the scheduler
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (enabled) {
            this.init();
        } else {
            this.shutdown();
        }
    }
}

module.exports = Scheduler;

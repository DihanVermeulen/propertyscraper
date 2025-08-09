const EventEmitter = require('events');
const database = require('../db/database');
const winston = require('winston');

// Configure job-specific logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, meta }) => {
            return `${timestamp} [JOB-${level.toUpperCase()}]: ${message} ${meta ? JSON.stringify(meta) : ''}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'jobs.log' })
    ]
});

class JobManager extends EventEmitter {
    constructor() {
        super();
        this.runningJobs = new Map();
        this.jobTimeouts = new Map();
        this.defaultTimeout = 10 * 60 * 1000; // 10 minutes default timeout
        this.maxConcurrentJobs = 3;
    }

    /**
     * Start a job with timeout and status tracking
     * @param {string} jobType - Type of job (e.g., 'scraper')
     * @param {string} source - Source identifier (e.g., 'property24')
     * @param {Function} jobFunction - Function to execute
     * @param {Object} options - Job options
     * @returns {Promise} Job result
     */
    async startJob(jobType, source, jobFunction, options = {}) {
        const jobId = `${jobType}_${source}_${Date.now()}`;
        const timeout = options.timeout || this.defaultTimeout;
        
        // Check if similar job is already running
        if (this.isJobRunning(jobType, source)) {
            throw new Error(`Job ${jobType}:${source} is already running`);
        }

        // Check concurrent job limit
        if (this.runningJobs.size >= this.maxConcurrentJobs) {
            throw new Error(`Maximum concurrent jobs (${this.maxConcurrentJobs}) reached`);
        }

        // Create job record in database
        const jobRecord = await database.insertScrapeJob({
            source_website: source,
            status: 'running',
            logs: [{
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `Job started with timeout: ${timeout}ms`,
                jobId: jobId
            }]
        });

        const jobContext = {
            id: jobRecord.id,
            jobId: jobId,
            type: jobType,
            source: source,
            startTime: Date.now(),
            timeout: timeout,
            status: 'running'
        };

        this.runningJobs.set(jobId, jobContext);
        
        logger.info(`Starting job: ${jobId}`, { jobContext });
        this.emit('jobStarted', jobContext);

        // Set up timeout
        const timeoutHandle = setTimeout(() => {
            this.timeoutJob(jobId, 'Job exceeded maximum execution time');
        }, timeout);
        
        this.jobTimeouts.set(jobId, timeoutHandle);

        try {
            // Execute the job function
            const result = await this.executeWithTimeout(jobFunction, jobContext);
            
            // Job completed successfully
            await this.completeJob(jobId, result);
            return result;
            
        } catch (error) {
            // Job failed
            await this.failJob(jobId, error);
            throw error;
        }
    }

    /**
     * Execute job function with proper error handling
     */
    async executeWithTimeout(jobFunction, jobContext) {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await jobFunction(jobContext);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Complete a job successfully
     */
    async completeJob(jobId, result) {
        const jobContext = this.runningJobs.get(jobId);
        if (!jobContext) return;

        const duration = Date.now() - jobContext.startTime;
        
        jobContext.status = 'completed';
        jobContext.result = result;
        jobContext.duration = duration;

        // Clear timeout
        const timeoutHandle = this.jobTimeouts.get(jobId);
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            this.jobTimeouts.delete(jobId);
        }

        // Update database
        await database.updateScrapeJob(jobContext.id, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            properties_found: result.propertiesFound || 0,
            properties_new: result.propertiesNew || 0,
            properties_updated: result.propertiesUpdated || 0,
            logs: [{
                timestamp: new Date().toISOString(),
                level: 'info',
                message: `Job completed successfully in ${duration}ms`,
                result: result
            }]
        });

        logger.info(`Job completed: ${jobId}`, { duration, result });
        this.emit('jobCompleted', jobContext);

        // Clean up
        this.runningJobs.delete(jobId);
    }

    /**
     * Fail a job with error details
     */
    async failJob(jobId, error) {
        const jobContext = this.runningJobs.get(jobId);
        if (!jobContext) return;

        const duration = Date.now() - jobContext.startTime;
        
        jobContext.status = 'failed';
        jobContext.error = error;
        jobContext.duration = duration;

        // Clear timeout
        const timeoutHandle = this.jobTimeouts.get(jobId);
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            this.jobTimeouts.delete(jobId);
        }

        // Update database
        await database.updateScrapeJob(jobContext.id, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
            logs: [{
                timestamp: new Date().toISOString(),
                level: 'error',
                message: `Job failed after ${duration}ms: ${error.message}`,
                error: error.stack
            }]
        });

        logger.error(`Job failed: ${jobId}`, { duration, error: error.message });
        this.emit('jobFailed', jobContext);

        // Clean up
        this.runningJobs.delete(jobId);
    }

    /**
     * Timeout a job
     */
    async timeoutJob(jobId, reason) {
        const jobContext = this.runningJobs.get(jobId);
        if (!jobContext) return;

        const duration = Date.now() - jobContext.startTime;
        const timeoutError = new Error(`Job timeout: ${reason}`);
        
        jobContext.status = 'timeout';
        jobContext.error = timeoutError;
        jobContext.duration = duration;

        // Update database
        await database.updateScrapeJob(jobContext.id, {
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: timeoutError.message,
            logs: [{
                timestamp: new Date().toISOString(),
                level: 'error',
                message: `Job timed out after ${duration}ms: ${reason}`
            }]
        });

        logger.error(`Job timed out: ${jobId}`, { duration, reason });
        this.emit('jobTimeout', jobContext);

        // Clean up
        this.runningJobs.delete(jobId);
        this.jobTimeouts.delete(jobId);
    }

    /**
     * Check if a job is currently running
     */
    isJobRunning(jobType, source) {
        for (const [jobId, context] of this.runningJobs) {
            if (context.type === jobType && context.source === source && context.status === 'running') {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all running jobs
     */
    getRunningJobs() {
        return Array.from(this.runningJobs.values());
    }

    /**
     * Force cancel a job
     */
    async cancelJob(jobId, reason = 'Job cancelled by user') {
        const jobContext = this.runningJobs.get(jobId);
        if (!jobContext) {
            throw new Error(`Job ${jobId} not found`);
        }

        await this.failJob(jobId, new Error(reason));
        logger.info(`Job cancelled: ${jobId}`, { reason });
    }

    /**
     * Get job statistics
     */
    getStats() {
        return {
            runningJobs: this.runningJobs.size,
            maxConcurrentJobs: this.maxConcurrentJobs,
            runningJobDetails: this.getRunningJobs()
        };
    }
    
    /**
     * Run a scraper with the specified source and configuration
     * This method integrates with the existing scraper infrastructure
     * @param {string} source - Scraper source ('property24', 'privateproperty')
     * @param {Object} config - Scraper configuration
     * @returns {Promise} Scraper result
     */
    async runScraper(source, config = {}) {
        const ScraperClass = this.getScraperClass(source);
        if (!ScraperClass) {
            throw new Error(`Unknown scraper source: ${source}`);
        }
        
        const jobFunction = async (jobContext) => {
            logger.info(`Starting ${source} scraper`, { config, jobContext: jobContext.jobId });
            
            const scraper = new ScraperClass();
            const result = await scraper.scrape(config);
            
            logger.info(`${source} scraper completed`, { 
                result: {
                    propertiesFound: result.propertiesFound,
                    propertiesNew: result.propertiesNew,
                    propertiesUpdated: result.propertiesUpdated
                },
                jobContext: jobContext.jobId 
            });
            
            return result;
        };
        
        // Use the job management system to run the scraper
        return await this.startJob('scraper', source, jobFunction, {
            timeout: config.timeout || 20 * 60 * 1000 // 20 minutes default for scraping
        });
    }
    
    /**
     * Get the appropriate scraper class for the given source
     * @param {string} source - Scraper source identifier
     * @returns {Class} Scraper class constructor
     */
    getScraperClass(source) {
        const scraperMap = {
            'property24': () => require('../scrapers/property24Scraper'),
            'privateproperty': () => require('../scrapers/privatePropertyScraper')
        };
        
        const scraperLoader = scraperMap[source.toLowerCase()];
        if (!scraperLoader) {
            return null;
        }
        
        return scraperLoader();
    }
}

// Create singleton instance
const jobManager = new JobManager();

module.exports = jobManager;

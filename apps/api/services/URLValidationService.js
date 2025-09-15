const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'url-validation.log' })
  ]
});

class URLValidationService {
  constructor() {
    this.validUrls = new Map(); // Cache valid URLs
    this.invalidUrls = new Set(); // Cache invalid URLs
    this.pendingValidations = new Map(); // Track ongoing validations
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.batchSize = 10; // Validate URLs in batches
  }

  /**
   * Validate a single URL without full page load
   * @param {string} url - URL to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateUrl(url) {
    try {
      // Check cache first
      if (this.invalidUrls.has(url)) {
        return { 
          isValid: false, 
          reason: 'Previously marked as invalid',
          fromCache: true 
        };
      }

      const cachedResult = this.validUrls.get(url);
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.cacheExpiry) {
        return { 
          isValid: true, 
          reason: 'Valid from cache',
          fromCache: true,
          lastValidated: new Date(cachedResult.timestamp).toISOString()
        };
      }

      // Check if validation is already in progress
      if (this.pendingValidations.has(url)) {
        return await this.pendingValidations.get(url);
      }

      // Start validation
      const validationPromise = this.performValidation(url);
      this.pendingValidations.set(url, validationPromise);

      const result = await validationPromise;
      this.pendingValidations.delete(url);

      return result;

    } catch (error) {
      this.pendingValidations.delete(url);
      logger.error(`Error validating URL ${url}: ${error.message}`);
      return {
        isValid: false,
        reason: `Validation error: ${error.message}`,
        fromCache: false
      };
    }
  }

  /**
   * Perform the actual URL validation
   * @param {string} url - URL to validate
   * @returns {Promise<Object>} Validation result
   */
  async performValidation(url) {
    try {
      // Quick basic validation
      if (!url || !url.includes('property24.com')) {
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: 'Invalid or non-Property24 URL',
          fromCache: false
        };
      }

      // Check for obviously broken patterns
      const brokenPatterns = [
        /\/undefined/,
        /\/null/,
        /property24\.com\/$/, // Just domain
        /[^\w\-\/\.\?=&%]+/, // Invalid characters
      ];

      for (const pattern of brokenPatterns) {
        if (pattern.test(url)) {
          this.invalidUrls.add(url);
          return {
            isValid: false,
            reason: 'URL matches broken pattern',
            fromCache: false
          };
        }
      }

      // Perform lightweight HTTP HEAD request
      const response = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 3,
        validateStatus: (status) => status < 500, // Accept redirects and client errors
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      });

      // Check response status
      if (response.status === 200) {
        // URL is accessible
        this.validUrls.set(url, { timestamp: Date.now() });
        return {
          isValid: true,
          reason: 'URL accessible',
          statusCode: response.status,
          fromCache: false
        };
      } else if (response.status === 404) {
        // Property not found - mark as invalid
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: 'Property not found (404)',
          statusCode: response.status,
          fromCache: false
        };
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - likely sold or removed
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: `Client error: ${response.status}`,
          statusCode: response.status,
          fromCache: false
        };
      } else {
        // Other status codes - consider valid for now
        this.validUrls.set(url, { timestamp: Date.now() });
        return {
          isValid: true,
          reason: `Accessible with status: ${response.status}`,
          statusCode: response.status,
          fromCache: false
        };
      }

    } catch (error) {
      // Handle different types of errors
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: 'Network error - host not found',
          error: error.code,
          fromCache: false
        };
      } else if (error.response && error.response.status === 404) {
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: 'Property not found (404)',
          statusCode: 404,
          fromCache: false
        };
      } else if (error.response && error.response.status >= 400 && error.response.status < 500) {
        this.invalidUrls.add(url);
        return {
          isValid: false,
          reason: `Client error: ${error.response.status}`,
          statusCode: error.response.status,
          fromCache: false
        };
      } else if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
        // Timeout might be temporary - don't cache as invalid
        return {
          isValid: false,
          reason: 'Request timeout',
          error: error.code,
          fromCache: false
        };
      } else {
        // Other errors - might be temporary
        logger.warn(`URL validation error for ${url}: ${error.message}`);
        return {
          isValid: false,
          reason: `Network error: ${error.message}`,
          fromCache: false
        };
      }
    }
  }

  /**
   * Validate multiple URLs in batches
   * @param {string[]} urls - Array of URLs to validate
   * @returns {Promise<Object>} Batch validation results
   */
  async validateUrlsBatch(urls) {
    const results = {
      valid: [],
      invalid: [],
      errors: [],
      summary: {
        total: urls.length,
        validCount: 0,
        invalidCount: 0,
        errorCount: 0,
        fromCache: 0
      }
    };

    // Process URLs in batches to avoid overwhelming the server
    for (let i = 0; i < urls.length; i += this.batchSize) {
      const batch = urls.slice(i, i + this.batchSize);
      
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.validateUrl(url);
          return { url, result };
        } catch (error) {
          return { 
            url, 
            result: { 
              isValid: false, 
              reason: `Batch validation error: ${error.message}`,
              fromCache: false
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Process batch results
      for (const { url, result } of batchResults) {
        if (result.isValid) {
          results.valid.push({ url, ...result });
          results.summary.validCount++;
        } else {
          results.invalid.push({ url, ...result });
          results.summary.invalidCount++;
        }

        if (result.fromCache) {
          results.summary.fromCache++;
        }
      }

      // Small delay between batches to be respectful
      if (i + this.batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Batch validation completed: ${results.summary.validCount}/${results.summary.total} URLs valid`);
    return results;
  }

  /**
   * Pre-validate URLs before expense scraping
   * @param {Object[]} properties - Array of property objects with source_url
   * @returns {Promise<Object[]>} Filtered list of properties with valid URLs
   */
  async preValidatePropertyUrls(properties) {
    logger.info(`Pre-validating ${properties.length} property URLs...`);

    const urls = properties.map(prop => prop.source_url).filter(url => url);
    const validationResults = await this.validateUrlsBatch(urls);

    // Create a map of valid URLs for quick lookup
    const validUrlsSet = new Set(validationResults.valid.map(result => result.url));

    // Filter properties to only include those with valid URLs
    const validProperties = properties.filter(property => {
      if (!property.source_url) {
        logger.warn(`Property ${property.external_id} has no source URL`);
        return false;
      }
      return validUrlsSet.has(property.source_url);
    });

    logger.info(`Pre-validation complete: ${validProperties.length}/${properties.length} properties have valid URLs`);
    
    // Log some statistics
    const invalidReasons = {};
    validationResults.invalid.forEach(result => {
      const reason = result.reason || 'Unknown';
      invalidReasons[reason] = (invalidReasons[reason] || 0) + 1;
    });

    if (Object.keys(invalidReasons).length > 0) {
      logger.info('Invalid URL reasons:', invalidReasons);
    }

    return {
      validProperties,
      validationResults,
      statistics: {
        total: properties.length,
        valid: validProperties.length,
        invalid: properties.length - validProperties.length,
        invalidReasons
      }
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    const validCount = this.validUrls.size;
    const invalidCount = this.invalidUrls.size;
    
    this.validUrls.clear();
    this.invalidUrls.clear();
    
    logger.info(`Cleared validation caches: ${validCount} valid URLs, ${invalidCount} invalid URLs`);
    
    return { validCount, invalidCount };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      validUrlsCount: this.validUrls.size,
      invalidUrlsCount: this.invalidUrls.size,
      cacheHitRatio: this.validUrls.size > 0 ? 
        ((this.validUrls.size / (this.validUrls.size + this.invalidUrls.size)) * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Remove expired entries from valid URLs cache
   */
  cleanExpiredEntries() {
    const now = Date.now();
    let removedCount = 0;

    for (const [url, data] of this.validUrls.entries()) {
      if ((now - data.timestamp) > this.cacheExpiry) {
        this.validUrls.delete(url);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned ${removedCount} expired entries from valid URLs cache`);
    }

    return removedCount;
  }
}

module.exports = URLValidationService;

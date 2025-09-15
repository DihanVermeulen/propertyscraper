const { chromium } = require("playwright");
const cheerio = require("cheerio");
const database = require("../db/database");
const winston = require("winston");
const ProxyRotationService = require("./ProxyRotationService");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "smart-expenses.log" }),
  ],
});

class SmartPropertyExpensesScraper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.blockedUrls = new Set(); // Cache URLs that are blocked/broken
    this.validUrls = new Map(); // Cache valid URLs with timestamp
    this.requestCount = 0;
    this.successCount = 0;
    this.skippedCount = 0;
    this.lastRequestTime = 0;
    this.minDelayBetweenRequests = 10000; // 10 seconds minimum between property page visits
    this.sessionCounter = 0;
    this.maxRequestsPerSession = 20; // Rotate session every 20 requests
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
    this.proxyService = new ProxyRotationService();
    this.useProxies = true; // Set to false to disable proxy usage
    this.currentProxy = null;
  }

  async init() {
    // Initialize proxy service if we're using proxies
    if (this.useProxies) {
      logger.info("Initializing proxy rotation service...");
      await this.proxyService.initializeProxies();
      logger.info(`Loaded ${this.proxyService.proxies.length} proxies for rotation`);
    }
    
    await this.createNewSession();
    logger.info("SmartPropertyExpensesScraper initialized");
  }

  async createNewSession() {
    await this.closeCurrentSession();

    // Get a proxy from the rotation service if we're using proxies
    let proxyConfig = undefined;
    if (this.useProxies) {
      this.currentProxy = this.proxyService.getNextProxy();
      if (this.currentProxy) {
        proxyConfig = this.proxyService.getPlaywrightProxyConfig(this.currentProxy);
        logger.info(`Using proxy: ${this.currentProxy}`);
      } else {
        logger.warn("No working proxy available, using direct connection");
      }
    }

    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
        "--disable-web-security",
        "--disable-features=TranslateUI",
        "--no-first-run",
        "--disable-default-apps",
        "--disable-dev-shm-usage",
        "--disable-images", // Don't load images to save bandwidth
        "--disable-javascript", // Disable JS - we only need HTML
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      ],
    });

    this.context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'en-ZA',
      timezoneId: 'Africa/Johannesburg',
      proxy: proxyConfig, // Add proxy configuration if available
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache'
      }
    });

    this.sessionCounter = 0;
    logger.info("New browser session created");
  }

  async closeCurrentSession() {
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        logger.warn(`Error closing context: ${error.message}`);
      }
      this.context = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        logger.warn(`Error closing browser: ${error.message}`);
      }
      this.browser = null;
    }
  }

  async close() {
    await this.closeCurrentSession();
    logger.info("SmartPropertyExpensesScraper closed");
  }

  /**
   * Pre-validate URL to avoid visiting broken/sold property pages
   */
  async preValidateUrl(propertyUrl) {
    try {
      // Check if URL is in blocked cache
      if (this.blockedUrls.has(propertyUrl)) {
        return { 
          isValid: false, 
          reason: 'Previously marked as blocked/broken',
          fromCache: true 
        };
      }

      // Check if URL is in valid cache and not expired
      const cachedValidation = this.validUrls.get(propertyUrl);
      if (cachedValidation && (Date.now() - cachedValidation.timestamp) < this.cacheExpiry) {
        return { 
          isValid: true, 
          reason: 'Previously validated as working',
          fromCache: true,
          lastValidated: new Date(cachedValidation.timestamp).toISOString()
        };
      }

      // Basic URL validation
      if (!propertyUrl || !propertyUrl.includes('property24.com')) {
        this.blockedUrls.add(propertyUrl);
        return { isValid: false, reason: 'Invalid URL', fromCache: false };
      }

      // Check for obviously broken URL patterns
      const brokenPatterns = [
        /\/undefined/,
        /\/null/,
        /property24\.com\/$/, // Empty path after domain
        /[^\w\-\/\.\?=&%:#]+/ // Allow common URL characters including colons
      ];

      for (const pattern of brokenPatterns) {
        if (pattern.test(propertyUrl)) {
          this.blockedUrls.add(propertyUrl);
          return { isValid: false, reason: 'URL matches broken pattern', fromCache: false };
        }
      }

      // Quick HTTP HEAD check to see if URL exists (lightweight)
      try {
        const axios = require('axios');
        
        // Get a proxy configuration for the pre-validation request
        let axiosConfig = {
          timeout: 8000,
          maxRedirects: 2,
          validateStatus: (status) => status < 500,
          headers: {
            'User-Agent': this.getRandomUserAgent()
          }
        };
        
        // Use a proxy for the validation request if enabled
        if (this.useProxies) {
          const validationProxy = this.proxyService.getNextProxy();
          if (validationProxy) {
            axiosConfig.proxy = this.proxyService.parseProxy(validationProxy);
            logger.info(`Using proxy for pre-validation: ${validationProxy}`);
          }
        }
        
        const response = await axios.head(propertyUrl, axiosConfig);

        if (response.status === 200) {
          // URL is accessible - cache it
          this.validUrls.set(propertyUrl, { timestamp: Date.now() });
          return { isValid: true, reason: 'URL is accessible', fromCache: false };
        } else if (response.status === 404) {
          // Property not found - cache as blocked
          this.blockedUrls.add(propertyUrl);
          return { isValid: false, reason: 'Property not found (404)', fromCache: false };
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - likely sold or removed
          this.blockedUrls.add(propertyUrl);
          return { isValid: false, reason: `Client error: ${response.status}`, fromCache: false };
        } else {
          // Other status - might be temporary, don't cache as blocked
          return { isValid: true, reason: `Accessible with status: ${response.status}`, fromCache: false };
        }

      } catch (headError) {
        // If HEAD request fails, it might be temporary - don't cache as blocked
        logger.warn(`HEAD request failed for ${propertyUrl}: ${headError.message}`);
        return { isValid: false, reason: `Head request failed: ${headError.message}`, fromCache: false };
      }

    } catch (error) {
      logger.warn(`URL validation error: ${error.message}`);
      return { isValid: false, reason: `Validation error: ${error.message}`, fromCache: false };
    }
  }

  /**
   * Smart delay to avoid being flagged as a bot
   */
  async smartDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      const delayTime = this.minDelayBetweenRequests - timeSinceLastRequest;
      logger.info(`Applying delay of ${Math.round(delayTime/1000)} seconds to avoid detection`);
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }

    // Add random jitter (2-5 seconds)
    const jitter = 2000 + Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, jitter));

    this.lastRequestTime = Date.now();
  }

  /**
   * Update expense scraping status in database
   */
  async updatePropertyExpenseStatus(propertyId, status, failureReason = null) {
    try {
      const query = `
        UPDATE properties 
        SET expense_scraping_status = ?, 
            expense_scraping_attempted_at = CURRENT_TIMESTAMP,
            expense_scraping_failure_reason = ?,
            expense_scraping_retries = CASE 
                WHEN expense_scraping_status = 'failed_blocked' OR expense_scraping_status = 'failed_error' 
                THEN expense_scraping_retries + 1 ELSE expense_scraping_retries END
        WHERE id = ?
      `;
      
      await database.run(query, [status, failureReason, propertyId]);
      return true;
    } catch (error) {
      logger.error(`Error updating property expense status: ${error.message}`);
      return false;
    }
  }

  /**
   * Batch process properties for expense scraping
   */
  async scrapeExpensesBatch(properties) {
    if (!properties || properties.length === 0) {
      return { success: true, processed: 0, successful: 0, skipped: 0, failed: 0 };
    }

    logger.info(`Starting batch expense scraping for ${properties.length} properties`);

    if (!this.browser) {
      await this.init();
    }

    const results = {
      processed: 0,
      successful: 0,
      skipped: 0,
      failed: 0,
      details: []
    };

    for (const property of properties) {
      try {
        // Rotate session periodically to avoid detection
        if (this.sessionCounter >= this.maxRequestsPerSession) {
          logger.info("Rotating browser session to avoid detection");
          await this.createNewSession();
        }

        // Pre-validate URL
        const validation = await this.preValidateUrl(property.source_url);
        if (!validation.isValid) {
          results.processed++;
          results.skipped++;
          this.skippedCount++;

          results.details.push({
            propertyId: property.id,
            externalId: property.external_id,
            success: false,
            skipped: true,
            reason: validation.reason,
            fromCache: validation.fromCache
          });
          
          // Update property status in database
          await this.updatePropertyExpenseStatus(
            property.id, 
            'skipped', 
            `Pre-validation failed: ${validation.reason}`
          );

          logger.info(`⏭️  Skipped property ${property.external_id}: ${validation.reason}`);
          continue;
        }

        // Apply smart delay before making request
        await this.smartDelay();

        // Scrape expenses
        const result = await this.scrapePropertyExpenses(property.source_url, property.id);
        
        results.processed++;
        results.details.push({
          propertyId: property.id,
          externalId: property.external_id,
          url: property.source_url,
          ...result
        });

        if (result.success) {
          results.successful++;
          this.successCount++;
          // Update property expense status to success
          await this.updatePropertyExpenseStatus(property.id, 'success');
          logger.info(`✓ Property ${property.external_id}: Expenses scraped successfully`);
        } else {
          results.failed++;
          logger.warn(`✗ Property ${property.external_id}: ${result.error}`);
          
          // If this URL failed, mark it as problematic
          if (result.shouldBlock) {
            this.blockedUrls.add(property.source_url);
            // Mark the property as blocked in the database
            await this.updatePropertyExpenseStatus(
              property.id, 
              'failed_blocked', 
              result.error
            );
            
            // If using proxies and the current proxy was detected as blocked
            if (this.useProxies && this.currentProxy && result.error.toLowerCase().includes('block')) {
              logger.warn(`Proxy ${this.currentProxy} appears to be blocked. Marking as blocked.`);
              this.proxyService.markProxyAsBlocked(this.currentProxy, result.error);
            }
          } else {
            // Normal error, not a blocking issue
            await this.updatePropertyExpenseStatus(
              property.id, 
              'failed_error', 
              result.error
            );
          }
        }

        this.requestCount++;
        this.sessionCounter++;

        // Log progress every 10 properties
        if (results.processed % 10 === 0) {
          logger.info(`Progress: ${results.processed}/${properties.length} (✓${results.successful} ⏭️${results.skipped} ✗${results.failed})`);
        }

      } catch (error) {
        results.processed++;
        results.failed++;
        results.details.push({
          propertyId: property.id,
          externalId: property.external_id,
          success: false,
          error: `Processing error: ${error.message}`
        });

        logger.error(`Error processing property ${property.external_id}: ${error.message}`);
      }
    }

    const successRate = results.processed > 0 ? ((results.successful / results.processed) * 100).toFixed(1) : '0';
    logger.info(`Batch complete: ${results.successful}/${results.processed} successful (${successRate}%), ${results.skipped} skipped`);

    return {
      success: true,
      ...results,
      stats: this.getStats()
    };
  }

  /**
   * Scrape expenses from a single property page
   */
  async scrapePropertyExpenses(propertyUrl, propertyId) {
    if (!this.browser) {
      await this.init();
    }

    const page = await this.context.newPage();
    
    try {
      // Set page timeout
      page.setDefaultTimeout(15000);

      logger.info(`Scraping expenses for property ${propertyId} from: ${propertyUrl}`);

      // Navigate to property page
      await page.goto(propertyUrl, {
        waitUntil: "domcontentloaded",
        timeout: 12000
      });

      // Quick check if we've been blocked or page is invalid
      const isBlocked = await this.checkIfBlocked(page);
      if (isBlocked.blocked) {
        await page.close();
        
        // If blocked and using proxies, try to mark the current proxy as blocked
        if (this.useProxies && this.currentProxy && isBlocked.shouldBlock) {
          this.proxyService.markProxyAsBlocked(this.currentProxy, isBlocked.reason);
          logger.warn(`Proxy ${this.currentProxy} marked as blocked: ${isBlocked.reason}`);
        }
        
        return {
          success: false,
          error: isBlocked.reason,
          shouldBlock: isBlocked.shouldBlock
        };
      }

      // Give page a moment to load
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const expenses = this.extractExpensesFromHTML($);

      // Save to database
      const savedExpenses = await this.saveExpensesToDatabase(propertyId, expenses);

      await page.close();

      return {
        success: true,
        expenses: savedExpenses,
        url: propertyUrl
      };

    } catch (error) {
      await page.close();
      
      const errorMessage = error.message.toLowerCase();
      const shouldBlock = errorMessage.includes('timeout') || 
                         errorMessage.includes('net::') || 
                         errorMessage.includes('navigation');

      return {
        success: false,
        error: error.message,
        shouldBlock: shouldBlock
      };
    }
  }

  /**
   * Check if page indicates blocking or invalid property
   */
  async checkIfBlocked(page) {
    try {
      const url = page.url().toLowerCase();
      const title = await page.title();
      const titleLower = title.toLowerCase();

      // Check for blocking indicators
      const blockingIndicators = ['blocked', 'captcha', 'cloudflare', 'access denied', 'too many requests'];
      
      for (const indicator of blockingIndicators) {
        if (url.includes(indicator) || titleLower.includes(indicator)) {
          return {
            blocked: true,
            reason: `Blocked: ${indicator} detected`,
            shouldBlock: true
          };
        }
      }

      // Check if property overview section exists
      const hasPropertyOverview = await page.$('.p24_propertyOverview, .p24_accordion, .p24_propertyOverviewRow');
      if (!hasPropertyOverview) {
        return {
          blocked: true,
          reason: 'Property overview missing - likely sold or removed',
          shouldBlock: true
        };
      }

      return { blocked: false };

    } catch (error) {
      return {
        blocked: true,
        reason: `Page check error: ${error.message}`,
        shouldBlock: false
      };
    }
  }

  /**
   * Extract expenses data from HTML
   */
  extractExpensesFromHTML($) {
    const expenses = {
      municipal_rates: 0,
      body_corporate_levies: 0,
      insurance_estimate: 0,
      maintenance_reserve: 0,
      municipal_taxes: 0,
      property_tax: 0,
      transfer_costs: 0,
      bond_costs: 0,
      data_source: "scraped",
    };

    try {
      const propertyOverview = $(".p24_listingCard.p24_propertyOverview, .p24_accordion");

      if (propertyOverview.length === 0) {
        logger.warn("Property overview section not found");
        return expenses;
      }

      const overviewRows = propertyOverview.find(".p24_propertyOverviewRow, .row.p24_propertyOverviewRow");

      overviewRows.each((index, element) => {
        const keyElement = $(element).find(".p24_propertyOverviewKey");
        const valueElement = $(element).find(".p24_info");

        if (keyElement.length && valueElement.length) {
          const key = keyElement.text().trim().toLowerCase();
          const value = valueElement.text().trim();

          const numericValue = this.extractCurrency(value);

          switch (key) {
            case "levies":
            case "body corporate levies":
            case "body corporate":
              expenses.body_corporate_levies = numericValue;
              break;
            case "rates and taxes":
            case "municipal rates":
            case "rates":
            case "municipal taxes":
              expenses.municipal_rates = numericValue;
              break;
            case "municipal rates and taxes":
              expenses.municipal_rates = Math.floor(numericValue / 2);
              expenses.municipal_taxes = Math.ceil(numericValue / 2);
              break;
          }
        }
      });

    } catch (error) {
      logger.error(`Error extracting expenses from HTML: ${error.message}`);
    }

    return expenses;
  }

  extractCurrency(text) {
    if (!text || typeof text !== "string") return 0;
    const cleanText = text.replace(/[R$,\s]/g, "");
    const match = cleanText.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  async saveExpensesToDatabase(propertyId, expenses) {
    try {
      const expensesData = {
        property_id: propertyId,
        property_table: "properties",
        ...expenses,
      };

      const result = await database.insertPropertyExpenses(expensesData);

      return {
        id: result.id,
        ...expensesData,
        scraped_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error saving expenses to database: ${error.message}`);
      throw error;
    }
  }

  getRandomUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  getStats() {
    const totalAttempts = this.requestCount + this.skippedCount;
    const stats = {
      totalAttempts,
      requestCount: this.requestCount,
      successCount: this.successCount,
      skippedCount: this.skippedCount,
      blockedUrlsCount: this.blockedUrls.size,
      validUrlsCount: this.validUrls.size,
      successRate: this.requestCount > 0 ? ((this.successCount / this.requestCount) * 100).toFixed(1) + '%' : '0%',
      skipRate: totalAttempts > 0 ? ((this.skippedCount / totalAttempts) * 100).toFixed(1) + '%' : '0%'
    };
    
    // Add proxy stats if we're using proxies
    if (this.useProxies) {
      stats.proxyStats = this.proxyService.getStats();
    }
    
    return stats;
  }

  // Clean up expired valid URLs to prevent memory growth
  cleanExpiredValidUrls() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [url, data] of this.validUrls.entries()) {
      if ((now - data.timestamp) > this.cacheExpiry) {
        this.validUrls.delete(url);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} expired URL validations from cache`);
    }
    
    return cleaned;
  }

  // Reset blocked URLs cache (useful for testing or recovery)
  resetBlockedUrls() {
    const count = this.blockedUrls.size;
    this.blockedUrls.clear();
    logger.info(`Reset ${count} blocked URLs from cache`);
    return count;
  }
}

module.exports = SmartPropertyExpensesScraper;

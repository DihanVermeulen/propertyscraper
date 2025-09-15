const { chromium } = require("playwright");
const cheerio = require("cheerio");
const database = require("../db/database");
const winston = require("winston");
const ProxyRotationService = require("./ProxyRotationService");
const URLValidationService = require("./URLValidationService");

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
    new winston.transports.File({ filename: "anti-block-expenses.log" }),
  ],
});

class AntiBlockPropertyExpensesScraper {
  constructor() {
    this.browser = null;
    this.context = null;
    this.proxyService = new ProxyRotationService();
    this.urlValidator = new URLValidationService();
    this.currentProxy = null;
    this.requestCount = 0;
    this.successCount = 0;
    this.blockCount = 0;
    this.maxRequestsPerSession = 50; // Change session after X requests
    this.sessionRequestCount = 0;
    
    // Rate limiting
    this.minDelayBetweenRequests = 8000; // 8 seconds minimum
    this.maxDelayBetweenRequests = 15000; // 15 seconds maximum
    this.lastRequestTime = 0;
    
    // Session management
    this.sessionRotationInterval = 10; // Change session every N requests
    this.maxRetriesPerUrl = 3;
    
    // Anti-detection patterns
    this.humanBehaviorPatterns = [
      { scrollDelay: 1000, readingTime: 3000 },
      { scrollDelay: 1500, readingTime: 2500 },
      { scrollDelay: 800, readingTime: 4000 }
    ];
  }

  async init() {
    try {
      // Initialize proxy service
      await this.proxyService.initializeProxies();
      
      // Initialize browser with anti-detection
      await this.createNewSession();
      
      logger.info("AntiBlockPropertyExpensesScraper initialized successfully");
      
    } catch (error) {
      logger.error(`Error initializing scraper: ${error.message}`);
      throw error;
    }
  }

  async createNewSession() {
    try {
      // Close existing session
      await this.closeSession();
      
      // Get new proxy
      this.currentProxy = this.proxyService.getNextProxy();
      
      // Launch browser with anti-detection settings
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
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images", // Save bandwidth
          "--disable-javascript", // We don't need JS for expense extraction
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ],
        proxy: this.proxyService.getPlaywrightProxyConfig(this.currentProxy)
      });

      // Create context with realistic settings
      this.context = await this.browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: this.getRandomViewport(),
        locale: 'en-ZA',
        timezoneId: 'Africa/Johannesburg',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,af;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        // Block unnecessary resources to save bandwidth and time
        resourceFilter: (resource) => {
          const type = resource.resourceType();
          return !['image', 'media', 'font', 'stylesheet'].includes(type);
        }
      });

      this.sessionRequestCount = 0;
      logger.info(`New session created with proxy: ${this.currentProxy || 'direct connection'}`);
      
    } catch (error) {
      logger.error(`Error creating new session: ${error.message}`);
      throw error;
    }
  }

  async closeSession() {
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
    await this.closeSession();
    logger.info("AntiBlockPropertyExpensesScraper closed");
  }

  /**
   * Smart delay with human-like patterns
   */
  async smartDelay() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Ensure minimum delay
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      const remainingDelay = this.minDelayBetweenRequests - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
    
    // Add random delay to simulate human behavior
    const randomDelay = Math.random() * (this.maxDelayBetweenRequests - this.minDelayBetweenRequests);
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Simulate human-like behavior on the page
   */
  async simulateHumanBehavior(page) {
    try {
      const pattern = this.humanBehaviorPatterns[Math.floor(Math.random() * this.humanBehaviorPatterns.length)];
      
      // Simulate scrolling
      await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 500);
      });
      
      await new Promise(resolve => setTimeout(resolve, pattern.scrollDelay));
      
      // Simulate reading time
      await new Promise(resolve => setTimeout(resolve, pattern.readingTime));
      
      // Random mouse movement (optional)
      await page.mouse.move(Math.random() * 200 + 100, Math.random() * 200 + 100);
      
    } catch (error) {
      logger.warn(`Error simulating human behavior: ${error.message}`);
    }
  }

  /**
   * Batch scrape property expenses with anti-blocking techniques
   */
  async scrapeExpensesBatch(properties) {
    logger.info(`Starting batch expense scraping for ${properties.length} properties`);
    
    // Pre-validate URLs to avoid broken links
    const validationResult = await this.urlValidator.preValidatePropertyUrls(properties);
    const validProperties = validationResult.validProperties;
    
    logger.info(`Pre-validation complete: ${validProperties.length}/${properties.length} properties have valid URLs`);
    
    if (validProperties.length === 0) {
      return {
        success: true,
        processed: 0,
        successful: 0,
        failed: 0,
        blocked: 0,
        results: []
      };
    }

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      blocked: 0,
      results: []
    };

    // Process properties one by one with delays
    for (const property of validProperties) {
      try {
        // Check if we need to rotate session
        if (this.sessionRequestCount >= this.sessionRotationInterval) {
          logger.info("Rotating session to avoid detection");
          await this.createNewSession();
        }

        // Apply smart delay
        await this.smartDelay();

        // Scrape expenses for this property
        const result = await this.scrapePropertyExpenses(property.source_url, property.id);
        
        results.processed++;
        results.results.push({
          propertyId: property.id,
          externalId: property.external_id,
          url: property.source_url,
          ...result
        });

        if (result.success) {
          results.successful++;
          this.successCount++;
          logger.info(`✓ Successfully scraped expenses for property ${property.external_id}`);
        } else {
          results.failed++;
          if (result.blocked) {
            results.blocked++;
            this.blockCount++;
            
            // If we're getting blocked frequently, take a longer break
            if (this.blockCount > 3) {
              logger.warn("Multiple blocks detected, taking extended break");
              await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute break
              this.blockCount = 0; // Reset counter
            }
          }
          logger.warn(`✗ Failed to scrape expenses for property ${property.external_id}: ${result.error}`);
        }

        this.requestCount++;
        this.sessionRequestCount++;

        // Log progress
        if (results.processed % 10 === 0) {
          logger.info(`Progress: ${results.processed}/${validProperties.length} properties processed (${results.successful} successful, ${results.failed} failed)`);
        }

      } catch (error) {
        results.processed++;
        results.failed++;
        results.results.push({
          propertyId: property.id,
          externalId: property.external_id,
          url: property.source_url,
          success: false,
          error: error.message
        });
        
        logger.error(`Error processing property ${property.external_id}: ${error.message}`);
      }
    }

    // Final statistics
    logger.info(`Batch scraping complete: ${results.successful}/${results.processed} successful`);
    logger.info(`Proxy stats:`, this.proxyService.getStats());
    logger.info(`URL validation stats:`, this.urlValidator.getCacheStats());

    return {
      success: true,
      ...results,
      statistics: {
        validationStats: validationResult.statistics,
        proxyStats: this.proxyService.getStats(),
        urlCacheStats: this.urlValidator.getCacheStats()
      }
    };
  }

  /**
   * Enhanced scrape method with all anti-blocking techniques
   */
  async scrapePropertyExpenses(propertyUrl, propertyId) {
    if (!this.browser) {
      await this.init();
    }

    let retryCount = 0;
    let lastError = null;

    while (retryCount <= this.maxRetriesPerUrl) {
      try {
        const page = await this.context.newPage();
        
        // Set timeouts
        page.setDefaultTimeout(20000);
        
        // Add extra headers for this specific request
        await page.setExtraHTTPHeaders({
          'Referer': 'https://www.property24.com/',
        });

        logger.info(`Scraping expenses for property ${propertyId} from: ${propertyUrl} (attempt ${retryCount + 1})`);

        try {
          // Navigate to the property page
          await page.goto(propertyUrl, {
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });

          // Check if we've been blocked
          const isBlocked = await this.checkIfBlocked(page);
          if (isBlocked) {
            await page.close();
            
            // Mark proxy as blocked if we have one
            if (this.currentProxy) {
              this.proxyService.markProxyAsBlocked(this.currentProxy, 'Access blocked');
            }
            
            return {
              success: false,
              error: 'Access blocked or property not found',
              blocked: true,
              shouldRetry: retryCount < this.maxRetriesPerUrl
            };
          }

          // Simulate human behavior
          await this.simulateHumanBehavior(page);

          // Extract the content
          const html = await page.content();
          const $ = cheerio.load(html);

          const expenses = this.extractExpensesFromHTML($);

          logger.info(`Successfully extracted expenses for property ${propertyId}`);

          // Save to database
          const savedExpenses = await this.saveExpensesToDatabase(propertyId, expenses);

          await page.close();

          return {
            success: true,
            expenses: savedExpenses,
            url: propertyUrl,
            blocked: false
          };

        } catch (navigationError) {
          await page.close();
          
          const errorMessage = navigationError.message.toLowerCase();
          const isLikelyBlocked = ['timeout', 'net::', 'blocked', 'denied'].some(indicator => 
            errorMessage.includes(indicator)
          );

          if (isLikelyBlocked) {
            logger.warn(`Navigation blocked for ${propertyUrl}: ${navigationError.message}`);
            
            // Mark proxy as blocked
            if (this.currentProxy) {
              this.proxyService.markProxyAsBlocked(this.currentProxy, 'Navigation blocked');
            }
            
            return {
              success: false,
              error: `Navigation blocked: ${navigationError.message}`,
              blocked: true,
              shouldRetry: retryCount < this.maxRetriesPerUrl
            };
          }

          lastError = navigationError;
        }

      } catch (error) {
        lastError = error;
        logger.warn(`Scraping attempt ${retryCount + 1} failed for ${propertyUrl}: ${error.message}`);
      }

      retryCount++;

      // If we have more retries, wait before trying again
      if (retryCount <= this.maxRetriesPerUrl) {
        const backoffDelay = Math.min(5000 * Math.pow(2, retryCount), 30000);
        logger.info(`Waiting ${backoffDelay}ms before retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Create new session for retry
        if (retryCount > 1) {
          await this.createNewSession();
        }
      }
    }

    // All retries exhausted
    logger.error(`All ${this.maxRetriesPerUrl + 1} attempts failed for ${propertyUrl}. Last error: ${lastError?.message}`);
    
    return {
      success: false,
      error: `All retries failed. Last error: ${lastError?.message}`,
      blocked: false,
      shouldRetry: false
    };
  }

  /**
   * Check if the response indicates we've been blocked
   */
  async checkIfBlocked(page) {
    try {
      const url = page.url().toLowerCase();
      const title = await page.title();
      const titleLower = title.toLowerCase();

      // Check URL and title for blocking indicators
      const blockingIndicators = [
        'blocked', 'captcha', 'cloudflare', 'access denied', 
        'too many requests', '429', '403', 'security check', 
        'unusual traffic', 'robot', 'bot'
      ];

      for (const indicator of blockingIndicators) {
        if (url.includes(indicator) || titleLower.includes(indicator)) {
          logger.warn(`Blocking detected: ${indicator} found in ${url.includes(indicator) ? 'URL' : 'title'}`);
          return true;
        }
      }

      // Check for Property24-specific error pages
      const hasPropertyOverview = await page.$('.p24_propertyOverview, .p24_accordion, .p24_propertyOverviewRow');
      if (!hasPropertyOverview) {
        logger.warn('Property overview section missing - property may be sold/removed or access blocked');
        return true;
      }

      return false;

    } catch (error) {
      logger.warn(`Error checking if blocked: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract expenses data from HTML (same as original)
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

  getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 }
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  getStats() {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      blockedRequests: this.blockCount,
      successRate: this.requestCount > 0 ? ((this.successCount / this.requestCount) * 100).toFixed(1) + '%' : '0%',
      blockRate: this.requestCount > 0 ? ((this.blockCount / this.requestCount) * 100).toFixed(1) + '%' : '0%',
      currentProxy: this.currentProxy,
      sessionRequestCount: this.sessionRequestCount,
      proxyStats: this.proxyService.getStats(),
      urlCacheStats: this.urlValidator.getCacheStats()
    };
  }
}

module.exports = AntiBlockPropertyExpensesScraper;

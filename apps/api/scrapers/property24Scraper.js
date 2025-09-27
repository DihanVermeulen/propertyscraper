const { chromium } = require("playwright");
const cheerio = require("cheerio");
const database = require("../db/database");
const winston = require("winston");
const DelistingDetectionService = require("../services/DelistingDetectionService");
const PropertyExpensesScraper = require("../services/PropertyExpensesScraper");
const Property24Extractor = require("./templates/property24Extractor");

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
    new winston.transports.File({ filename: "scraper.log" }),
  ],
});

class Property24Scraper {
  constructor(listingType = 'sale') {
    this.baseUrl = "https://www.property24.com";
    this.listingType = listingType;
    this.searchUrl = `https://www.property24.com/${this.listingType === 'rent' ? 'to-rent' : 'for-sale'}`;
    this.source = "property24";
    this.defaultLocation = {
      city: "Somerset West",
      province: "Western Cape",
      country: "South Africa",
    };
    this.possibleUrls = []; // Store alternative URLs for fallback
    this.expensesScraper = null; // Will be initialized when needed
    this.extractor = new Property24Extractor(this.baseUrl); // Template-based extractor for property cards
  }

  /**
   * Build location-specific search URL for Property24
   * Enhanced to handle multiple URL patterns with fallback logic
   * @param {Object} location - Location object with city, province, country, and optional p24_id
   * @param {string} location.city - City name (e.g., "Somerset West", "Cape Town")
   * @param {string} location.province - Province name (e.g., "Western Cape", "Gauteng")
   * @param {string} [location.p24_id] - Optional Property24 location ID for precise targeting
   * @returns {string} Primary location-specific search URL
   */
    buildLocationUrl(location) {
        const citySlug = this.sanitizeSlug(location.city);
        const provinceSlug = this.sanitizeSlug(location.province);
        
        logger.info(`Building URL for: ${location.city}, ${location.province}`);
        logger.info(`Slugs: city=${citySlug}, province=${provinceSlug}`);
        
        // Known special cases with verified URL patterns
        const specialCases = this.getSpecialCaseUrls(citySlug, provinceSlug, location.p24_id);
        if (specialCases.length > 0) {
            this.possibleUrls = specialCases;
            logger.info(`Using special case URLs: ${specialCases[0]}`);
            return specialCases[0];
        }
        
        // Generate multiple URL patterns to try
        this.possibleUrls = this.generateUrlPatterns(citySlug, provinceSlug, location.p24_id);
        
        const primaryUrl = this.possibleUrls[0];
        logger.info(`Built primary URL: ${primaryUrl}`);
        logger.info(`Alternative URLs available: ${this.possibleUrls.length - 1}`);
        
        return primaryUrl;
    }
    
    /**
     * Sanitize location strings for URL slugs
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized slug
     */
    sanitizeSlug(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }
    
    /**
     * Get special case URLs for known locations with verified patterns
     * @param {string} citySlug - Sanitized city slug
     * @param {string} provinceSlug - Sanitized province slug
     * @param {string} [p24_id] - Optional Property24 ID
     * @returns {string[]} Array of URLs to try, or empty if no special case
     */
    getSpecialCaseUrls(citySlug, provinceSlug, p24_id) {
        const urlSegment = this.listingType === 'rent' ? 'to-rent' : 'for-sale';
        const specialCases = {
            // Somerset West - verified working patterns
            'somerset-west_western-cape': [
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/390`,
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}/390`,
            ],
            // Cape Town - multiple area patterns
            'cape-town_western-cape': [
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/32`,
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}/32`,
            ],
            // Johannesburg - major metro patterns
            'johannesburg_gauteng': [
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/7`,
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}/7`,
            ],
            // Pretoria patterns
            'pretoria_gauteng': [
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/9`,
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}/9`,
            ],
            // Durban patterns
            'durban_kwazulu-natal': [
                `${this.baseUrl}/${urlSegment}/${citySlug}/kwazulu-natal/22`,
                `${this.baseUrl}/${urlSegment}/${citySlug}/kwazulu-natal`,
                `${this.baseUrl}/${urlSegment}/kwazulu-natal/${citySlug}/22`,
            ],
            // Add more known working patterns as discovered
        };
        
        const key = `${citySlug}_${provinceSlug}`;
        const urls = specialCases[key] || [];
        
        // If we have a specific P24 ID, prioritize that in the URL patterns
        if (p24_id && urls.length > 0) {
            const withId = `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/${p24_id}`;
            return [withId, ...urls];
        }
        
        return urls;
    }
    
    /**
     * Generate multiple URL patterns to try for any location
     * @param {string} citySlug - Sanitized city slug
     * @param {string} provinceSlug - Sanitized province slug
     * @param {string} [p24_id] - Optional Property24 ID
     * @returns {string[]} Array of URLs to try in priority order
     */
    generateUrlPatterns(citySlug, provinceSlug, p24_id) {
        const urlSegment = this.listingType === 'rent' ? 'to-rent' : 'for-sale';
        const citySearch = citySlug.replace(/-/g, '+');
        const provinceSearch = provinceSlug.replace(/-/g, '+');
        
        const patterns = [];
        
        // Priority 1: With Property24 ID (if available)
        if (p24_id) {
            patterns.push(
                `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}/${p24_id}`,
                `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}/${p24_id}`
            );
        }
        
        // Priority 2: Standard slug-based URLs
        patterns.push(
            `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`, // Standard: city/province
            `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}` // Reversed: province/city
        );
        
        // Priority 3: Search-based URLs
        patterns.push(
            `${this.baseUrl}/${urlSegment}?search=${citySearch}&province=${provinceSearch}`,
            `${this.baseUrl}/${urlSegment}?search=${citySearch}+${provinceSearch}`,
            `${this.baseUrl}/${urlSegment}?search=${citySearch}`
        );
        
        // Priority 4: Province-only and general fallbacks
        patterns.push(
            `${this.baseUrl}/${urlSegment}/${provinceSlug}`,
            `${this.baseUrl}/${urlSegment}`
        );
        
        return patterns;
    }

  /**
   * Try multiple URL patterns if the first one doesn't work
   */
  async tryAlternativeUrls(page, location) {
    const urlSegment = this.listingType === 'rent' ? 'to-rent' : 'for-sale';
    const provinceSlug = location.province.toLowerCase().replace(/\s+/g, "-");
    const citySlug = location.city.toLowerCase().replace(/\s+/g, "-");
    const citySearch = location.city.toLowerCase().replace(/\s+/g, "+");
    const provinceSearch = location.province.toLowerCase().replace(/\s+/g, "+");

    // Generate alternative URLs for any location
    const alternativeUrls = [
      `${this.baseUrl}/${urlSegment}/${citySlug}/${provinceSlug}`, // Correct order: city/province
      `${this.baseUrl}/${urlSegment}/${provinceSlug}/${citySlug}`, // Reversed order (fallback)
      `${this.baseUrl}/${urlSegment}?search=${citySearch}&province=${provinceSearch}`, // Search-based
      `${this.baseUrl}/${urlSegment}/${provinceSlug}`, // Province only
      `${this.baseUrl}/${urlSegment}?search=${citySearch}`, // City search only
      `${this.baseUrl}/${urlSegment}`, // General fallback
    ];

    for (const alternativeUrl of alternativeUrls) {
      try {
        console.log(`Trying alternative URL: ${alternativeUrl}`);

        await page.goto(alternativeUrl, { waitUntil: "networkidle" });

        // Check if we found listings with more comprehensive selectors
        const listingSelectors = [
          ".p24_tileContainer.js_resultTile",
          ".p24_results .p24_tileContainer.js_resultTile",
          ".p24_tileContainer",
          ".js_resultTile",
          ".p24_results .p24_tileContainer",
          "[data-listing-number]",
        ];

        for (const selector of listingSelectors) {
          const hasListings = await page.$(selector);
          if (hasListings) {
            console.log(
              `Found listings with URL: ${alternativeUrl} using selector: ${selector}`
            );
            return true;
          }
        }
      } catch (error) {
        console.log(
          `Alternative URL ${alternativeUrl} failed: ${error.message}`
        );
      }
    }

    return false;
  }

  async scrape(options = {}) {
    // Helper function for random delay
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const location = options.location || this.defaultLocation;
    const locationString = `${location.city}, ${location.province}, ${location.country}`;
    const maxPages = options.maxPages || 100; // High limit, will use dynamic detection
    const forceFullScan = options.forceFullScan || false; // Force scan all detected pages

    // Job record is managed by JobManager, not by scraper directly
    // const job = await database.insertScrapeJob({...}); // REMOVED - JobManager handles this

    let browser;
    let propertiesFound = 0;
    let propertiesNew = 0;
    let propertiesUpdated = 0;
    const foundExternalIds = []; // Track all properties found for delisting detection
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Starting Property24 scraper for ${this.listingType} listings in ${locationString} (max ${maxPages} pages)`,
      },
    ];

    try {
      logger.info(`Starting Property24 scraper for ${this.listingType} listings in ${locationString}`);
      logs.push(`Starting Property24 scraper for ${this.listingType} listings in ${locationString}`);

      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
      });

      const page = await context.newPage();

      // Set longer timeout for slow pages
      page.setDefaultTimeout(30000);

      // Start pagination loop
      let currentPage = 1;
      let hasMorePages = true;
      let expectedProperties = 0; // Declare expectedProperties at function scope

      while (hasMorePages && currentPage <= maxPages) {
        logger.info(`=== SCRAPING PAGE ${currentPage} ===`);
        logs.push(`Scraping page ${currentPage}`);

        // Build URL for current page
        const baseUrl = this.buildLocationUrl(location);
        logger.info(`Base URL: ${baseUrl}`);
        const pageUrl =
          currentPage === 1 ? baseUrl : `${baseUrl}/p${currentPage}`;

        logger.info(`Navigating to page ${currentPage}: ${pageUrl}`);
        logs.push(`Navigating to page ${currentPage}: ${pageUrl}`);

        // Random delay between 3-7 seconds to be respectful
        await delay(3000 + Math.floor(Math.random() * 4000));

        // Navigate to page with URL fallback logic
        let navigationSuccess = false;
        
        try {
          await page.goto(pageUrl, { waitUntil: "networkidle" });
          
          // Check if listings are present
          await page.waitForSelector(".p24_results", { timeout: 10000 });
          
          // Verify we have actual property listings
          const hasListings = await page.$(".p24_tileContainer.js_resultTile");
          if (hasListings) {
            navigationSuccess = true;
            logger.info(`Successfully loaded page ${currentPage}`);
          }
        } catch (error) {
          logger.warn(`Primary URL failed for page ${currentPage}: ${error.message}`);
        }
        
        // If primary URL failed and we have alternatives, try them
        if (!navigationSuccess && this.possibleUrls && currentPage === 1) {
          logger.info(`Trying alternative URLs for ${location.city}, ${location.province}`);
          
          for (let i = 1; i < this.possibleUrls.length; i++) {
            const altUrl = this.possibleUrls[i];
            try {
              logger.info(`Trying alternative URL ${i}: ${altUrl}`);
              await page.goto(altUrl, { waitUntil: "networkidle" });
              
              // Check for listings
              await page.waitForSelector(".p24_results", { timeout: 5000 });
              const hasListings = await page.$(".p24_tileContainer.js_resultTile");
              
              if (hasListings) {
                logger.info(`Alternative URL ${i} successful: ${altUrl}`);
                // Update the base URL for subsequent pages
                const updatedBaseUrl = altUrl;
                navigationSuccess = true;
                break;
              }
            } catch (altError) {
              logger.warn(`Alternative URL ${i} failed: ${altError.message}`);
            }
          }
        }
        
        // If all URLs failed, break pagination
        if (!navigationSuccess) {
          logger.warn(
            `No results found on page ${currentPage} with any URL pattern, stopping pagination`
          );
          logs.push(`No results found on page ${currentPage}, stopping pagination`);
          break;
        }

        logger.info(`Successfully navigated to page ${currentPage}`);
        logs.push(`Successfully navigated to page ${currentPage}`);

        const content = await page.content();
        const $ = cheerio.load(content);

        // Detect last page number on first page only
        let lastPageNumber = maxPages;
        if (currentPage === 1) {
          try {
            lastPageNumber = this.extractLastPageNumber($);
            expectedProperties = this.estimateExpectedProperties($, lastPageNumber);
            
            logger.info(`Detected last page: ${lastPageNumber}`);
            logger.info(`Expected to find approximately ${expectedProperties} properties in total`);
            
            // If we detected a very high number, cap it for safety
            if (lastPageNumber > 500) {
              logger.warn(`Detected unusually high page count (${lastPageNumber}), capping at 500 for safety`);
              lastPageNumber = 500;
            }
          } catch (err) {
            logger.warn(`Could not detect last page number: ${err.message}`);
            // Fall back to a high number to ensure we get all pages
            lastPageNumber = 100;
          }
        }

        // Extract property listings - Updated selectors to handle dynamic classes
        const listingSelectors = [
          ".p24_tileContainer.js_resultTile", // Primary: Individual property tiles (dynamic third class)
          ".p24_results .p24_tileContainer.js_resultTile", // Primary with parent container
          ".p24_tileContainer", // Backup: All tile containers
          ".js_resultTile", // Alternative: Just the result tile class
          ".p24_results .p24_tileContainer", // Backup: All tile containers in results
          ".js_listingResultsContainer .p24_tileContainer", // Alternative: Within results container
          ".p24_highlightTile.p24_topTile", // Premium/highlighted listings
          ".listing-results .listing-result-item", // Generic fallback
          ".search-results .property-listing", // Generic fallback
          ".property-listing", // Generic fallback
          ".property-tile", // Generic fallback
          ".property-card", // Generic fallback
          "[data-listing-number]", // Attribute-based fallback
        ];

        // Debug: Check what elements are available
        logger.info("=== DEBUGGING SELECTORS ===");
        logger.info(
          `Total elements with p24_tileContainer class: ${$(".p24_tileContainer").length}`
        );
        logger.info(
          `Total elements with js_resultTile class: ${$(".js_resultTile").length}`
        );
        logger.info(
          `Total elements with both classes: ${$(".p24_tileContainer.js_resultTile").length}`
        );

        // Sample the first few elements to see their classes
        $(".p24_tileContainer").each((i, el) => {
          if (i < 5) {
            // Only log first 5
            const classes = $(el).attr("class");
            logger.info(`Element ${i} classes: ${classes}`);
          }
        });

        let listings = $();
        for (const selector of listingSelectors) {
          const found = $(selector);
          logger.info(`Selector '${selector}' found: ${found.length} elements`);
          if (found.length > 0) {
            listings = found;
            logger.info(
              `Using selector: ${selector} with ${found.length} listings`
            );
            break;
          }
        }

        if (listings.length === 0) {
          logger.warn("No listings found with any selector");
          logger.info("No listings found with any selector");
        }

        // Collect properties for batch processing
        const newProperties = [];
        const updateProperties = [];
        const validatedProperties = [];
        
        // Process each listing (extract data only)
        for (let i = 0; i < listings.length; i++) {
          try {
            const listing = listings.eq(i);
            propertiesFound++;

            // Use the template-based extractor to extract property data
            const property = this.extractor.extractPropertyData($, listing, location, this.listingType);

            // Filter properties to only include Somerset West area
            const isInTargetLocation = this.isInTargetLocation(
              property,
              location
            );

            logger.info(
              `Property validation: ID=${!!property.external_id}, Title=${!!property.title}, Location=${isInTargetLocation}`
            );
            logger.info(
              `Property details: ID=${property.external_id}, Title="${property.title}", Suburb="${property.location_suburb}", City="${property.location_city}"`
            );

            if (property.external_id && property.title && isInTargetLocation) {
              // Track this property's external_id for delisting detection
              foundExternalIds.push(property.external_id);
              validatedProperties.push(property);
            } else {
              logger.warn(
                `Skipping property due to missing data: ID=${property.external_id}, Title=${property.title}`
              );
            }
          } catch (error) {
            logger.error(`Error processing listing ${i}:`, error.message);
            logs.push(`Error processing listing ${i}: ${error.message}`);
          }
        }
        
        logger.info(`Validated ${validatedProperties.length} properties, preparing for batch operations...`);
        
        // Check which properties exist and separate new vs updates
        for (const property of validatedProperties) {
          try {
            if (this.listingType === 'rent') {
              const existing = await database.get(
                'SELECT id FROM rental_properties WHERE external_id = ? AND source_website = ?',
                [property.external_id, this.source]
              );
              if (existing) {
                property._existing_id = existing.id; // Store for reference
                updateProperties.push(property);
              } else {
                newProperties.push(property);
              }
            } else {
              const existing = await database.get(
                "SELECT id FROM properties WHERE external_id = ? AND source_website = ?",
                [property.external_id, this.source]
              );
              if (existing) {
                property._existing_id = existing.id; // Store for reference
                updateProperties.push(property);
              } else {
                newProperties.push(property);
              }
            }
          } catch (error) {
            logger.error(`Error checking existing property ${property.external_id}:`, error.message);
          }
        }
        
        logger.info(`Batch operations: ${newProperties.length} new, ${updateProperties.length} updates`);
        
        // Perform batch insert for new properties
        if (newProperties.length > 0) {
          try {
            if (this.listingType === 'rent') {
              const insertResult = await database.batchInsertRentalProperties(newProperties);
              propertiesNew += insertResult.inserted;
              if (insertResult.errors.length > 0) {
                logger.warn(`Batch rental insert had ${insertResult.errors.length} errors`);
                insertResult.errors.forEach(error => {
                  logger.error(`Insert error for property ${error.property?.external_id}: ${error.error}`);
                });
              }
              logger.info(`Batch inserted ${insertResult.inserted} new rental properties`);
            } else {
              const insertResult = await database.batchInsertProperties(newProperties);
              propertiesNew += insertResult.inserted;
              if (insertResult.errors.length > 0) {
                logger.warn(`Batch sale insert had ${insertResult.errors.length} errors`);
                insertResult.errors.forEach(error => {
                  logger.error(`Insert error for property ${error.property?.external_id}: ${error.error}`);
                });
              }
              logger.info(`Batch inserted ${insertResult.inserted} new sale properties`);
              
              // For new sale properties, scrape expenses (this could be optimized further in the future)
              for (const property of newProperties) {
                if (property.source_url && insertResult.inserted > 0) {
                  // Note: We can't easily match which property got which ID in batch insert
                  // This is a limitation we can address later by returning IDs from batch insert
                  logger.info(`Skipping expense scraping for batch-inserted property: ${property.external_id}`);
                  // await this.scrapePropertyExpenses(property.id, property.source_url);
                }
              }
            }
          } catch (error) {
            logger.error(`Batch insert failed, falling back to individual inserts: ${error.message}`);
            // Fallback to individual inserts
            for (const property of newProperties) {
              try {
                if (this.listingType === 'rent') {
                  await database.insertRentalProperty(property);
                  propertiesNew++;
                  logger.info(`Individual insert: rental ${property.title} - R${property.rental_price}/month`);
                } else {
                  const insertResult = await database.insertProperty(property);
                  propertiesNew++;
                  property.id = insertResult.id;
                  if (property.source_url) {
                    // await this.scrapePropertyExpenses(property.id, property.source_url);
                  }
                  logger.info(`Individual insert: sale ${property.title} - R${property.price}`);
                }
              } catch (individualError) {
                logger.error(`Individual insert failed for ${property.external_id}: ${individualError.message}`);
              }
            }
          }
        }
        
        // Perform batch update for existing properties
        if (updateProperties.length > 0) {
          try {
            if (this.listingType === 'rent') {
              const updateResult = await database.batchUpdateRentalProperties(updateProperties);
              propertiesUpdated += updateResult.updated;
              if (updateResult.errors.length > 0) {
                logger.warn(`Batch rental update had ${updateResult.errors.length} errors`);
                updateResult.errors.forEach(error => {
                  logger.error(`Update error for property ${error.property?.external_id}: ${error.error}`);
                });
              }
              logger.info(`Batch updated ${updateResult.updated} existing rental properties`);
            } else {
              const updateResult = await database.batchUpdateProperties(updateProperties);
              propertiesUpdated += updateResult.updated;
              if (updateResult.errors.length > 0) {
                logger.warn(`Batch sale update had ${updateResult.errors.length} errors`);
                updateResult.errors.forEach(error => {
                  logger.error(`Update error for property ${error.property?.external_id}: ${error.error}`);
                });
              }
              logger.info(`Batch updated ${updateResult.updated} existing sale properties`);
            }
          } catch (error) {
            logger.error(`Batch update failed, falling back to individual updates: ${error.message}`);
            // Fallback to individual updates
            for (const property of updateProperties) {
              try {
                if (this.listingType === 'rent') {
                  await database.run(`
                    UPDATE rental_properties SET 
                      title = ?, description = ?, rental_price = ?, rental_period = ?,
                      deposit = ?, lease_terms = ?, available_date = ?, furnished_status = ?,
                      utilities_included = ?, pet_policy = ?, property_type = ?, 
                      bedrooms = ?, bathrooms = ?, parking_spaces = ?, floor_area = ?,
                      location_city = ?, location_suburb = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`,
                    [
                      property.title, property.description, property.rental_price,
                      property.rental_period, property.deposit, property.lease_terms,
                      property.available_date, property.furnished_status,
                      JSON.stringify(property.utilities_included || []), property.pet_policy,
                      property.property_type, property.bedrooms, property.bathrooms,
                      property.parking_spaces, property.floor_area, property.location_city,
                      property.location_suburb, property._existing_id
                    ]
                  );
                  propertiesUpdated++;
                  logger.info(`Individual update: rental ${property.title} - R${property.rental_price}/month`);
                } else {
                  await database.run(`
                    UPDATE properties SET 
                        title = ?, description = ?, price = ?, 
                        property_type = ?, bedrooms = ?, bathrooms = ?,
                        parking_spaces = ?, location_city = ?, location_suburb = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`,
                    [
                      property.title, property.description, property.price,
                      property.property_type, property.bedrooms, property.bathrooms,
                      property.parking_spaces, property.location_city, property.location_suburb,
                      property._existing_id
                    ]
                  );
                  propertiesUpdated++;
                  logger.info(`Individual update: sale ${property.title} - R${property.price}`);
                }
              } catch (individualError) {
                logger.error(`Individual update failed for ${property.external_id}: ${individualError.message}`);
              }
            }
          }
        }

        // Enhanced next page detection with multiple strategies
        let hasNextPage = this.detectNextPage($, currentPage, lastPageNumber);
        
        // Also check if listings exist on current page
        if (hasNextPage && listings.length === 0) {
          hasNextPage = false;
          logger.info(
            "Next page link found but no listings on current page, assuming no more content"
          );
        }
        
        // Force full scan logic: continue even if next page detection fails, as long as we haven't reached detected limit
        if (forceFullScan && currentPage < lastPageNumber && !hasNextPage) {
          hasNextPage = true;
          logger.info(`Force full scan enabled: continuing to page ${currentPage + 1} despite no next page link`);
        }

        if (hasNextPage && currentPage < lastPageNumber) {
          currentPage++;
          logger.info(
            `Next page found, continuing to page ${currentPage} of ${lastPageNumber}...`
          );
        } else {
          hasMorePages = false;
          const reason = currentPage >= lastPageNumber
            ? "reached detected last page"
            : listings.length === 0
            ? "no listings found on current page"
            : "no next page link found";
          logger.info(
            `Pagination ended: ${reason}. Scraped ${currentPage} of ${lastPageNumber} pages.`
          );
        }
      }

      // Job status is managed by JobManager, not by scraper directly
      // await database.updateScrapeJob(...); // REMOVED - JobManager handles this

      logger.info(
        `Property24 scraping completed. Scraped ${currentPage} pages. Found: ${propertiesFound}, New: ${propertiesNew}, Updated: ${propertiesUpdated}`
      );
      
      // Verify total property count and adjust delisting confidence
      const totalListingsFound = foundExternalIds.length;
      const completenessRatio = expectedProperties > 0 ? totalListingsFound / expectedProperties : 1;
      let gracePeriodHours = 48; // Default grace period
      
      logger.info(`=== SCRAPING COMPLETENESS ANALYSIS ===`);
      logger.info(`Expected properties: ${expectedProperties}`);
      logger.info(`Found properties: ${totalListingsFound}`);
      logger.info(`Completeness ratio: ${(completenessRatio * 100).toFixed(1)}%`);
      
      // Adjust grace period based on scraping completeness
      if (completenessRatio < 0.8) {
        gracePeriodHours = 72; // Extended grace period for incomplete scrapes
        logger.warn(`Possible incomplete scrape (${(completenessRatio * 100).toFixed(1)}% found). Extending grace period to ${gracePeriodHours} hours.`);
      } else if (completenessRatio >= 0.95) {
        gracePeriodHours = 36; // Shorter grace period for complete scrapes
        logger.info(`High completeness scrape (${(completenessRatio * 100).toFixed(1)}% found). Using shorter grace period of ${gracePeriodHours} hours.`);
      } else {
        logger.info(`Normal completeness scrape (${(completenessRatio * 100).toFixed(1)}% found). Using standard grace period of ${gracePeriodHours} hours.`);
      }
      
      // Run delisting detection after successful scraping
      if (foundExternalIds.length > 0) {
        try {
          logger.info(`Running delisting detection for ${foundExternalIds.length} properties found...`);
          const delistingService = new DelistingDetectionService();
          const delistingResult = await delistingService.runScraperIntegratedDetection(
            this.source, // 'property24'
            this.listingType === 'rent' ? 'rental' : 'sale',
            foundExternalIds,
            {
              city: location.city,
              province: location.province,
              completenessRatio: completenessRatio // Pass completeness info for enhanced decision making
            },
            gracePeriodHours // Dynamic grace period based on scraping completeness
          );
          
          logger.info(`Delisting detection completed: ${delistingResult.propertiesDelisted} properties delisted, ${delistingResult.propertiesRelisted} relisted`);
        } catch (delistingError) {
          logger.warn(`Delisting detection failed: ${delistingError.message}`);
          // Don't fail the entire scrape if delisting detection fails
        }
      } else {
        logger.warn('No properties found during scraping - this may indicate a scraping issue!');
        logger.info('Skipping delisting detection due to no properties found');
      }
      
    } catch (error) {
      logger.error("Property24 scraper failed:", JSON.stringify(error.message));
      logger.info(`Scraper failed: ${JSON.stringify(error.message)}`);

      // Job status is managed by JobManager, not by scraper directly
      // await database.updateScrapeJob(...); // REMOVED - JobManager handles this

      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
      
      // Clean up expenses scraper if it was initialized
      if (this.expensesScraper) {
        try {
          await this.expensesScraper.close();
        } catch (error) {
          logger.warn(`Error closing expenses scraper: ${error.message}`);
        }
        this.expensesScraper = null;
      }
    }

    return {
      propertiesFound,
      propertiesNew,
      propertiesUpdated,
    };
  }

  /**
   * Check if property is in target location
   * @param {Object} property - Property data
   * @param {Object} targetLocation - Target location object
   * @returns {boolean} True if property is in target location
   */
  isInTargetLocation(property, targetLocation) {
    if (!property.location_city && !property.location_suburb) {
      return false;
    }

    const cityMatch =
      property.location_city &&
      property.location_city
        .toLowerCase()
        .includes(targetLocation.city.toLowerCase());
    const suburbMatch =
      property.location_suburb &&
      property.location_suburb
        .toLowerCase()
        .includes(targetLocation.city.toLowerCase());
    const provinceMatch =
      !property.location_province ||
      property.location_province
        .toLowerCase()
        .includes(targetLocation.province.toLowerCase());

    return (cityMatch || suburbMatch) && provinceMatch;
  }

  // Old extractSalePropertyData method removed - now using template-based extractor

  // Old extractRentalPropertyData method removed - now using template-based extractor

  /**
   * Detect if there's a next page using multiple strategies
   * @param {Object} $ - Cheerio instance
   * @param {number} currentPage - Current page number
   * @param {number} lastPageNumber - Detected last page number
   * @returns {boolean} True if next page exists
   */
  detectNextPage($, currentPage, lastPageNumber) {
    try {
      // Strategy 1: Look for "Next" buttons with multiple selectors
      const nextPageSelectors = [
        '.p24_pager a:contains("Next")',               // New structure
        '.p24_paginator a[title="Next"]',             // Original structure
        '.pagination a[title="Next"]',                 // Generic
        '.p24_pager .pull-right:not(.text-muted)',     // Right-side navigation (from your HTML)
        'a:contains("Next"):not(.text-muted)',        // Any Next link that's not disabled
        '.paginator a:contains("Next")',               // Alternative
        '.pagination .next-page',                      // Generic next page class
      ];
      
      for (const selector of nextPageSelectors) {
        const nextButton = $(selector);
        if (nextButton.length > 0) {
          // Check if the button is disabled (common pattern)
          const isDisabled = nextButton.hasClass('disabled') || 
                           nextButton.hasClass('text-muted') ||
                           nextButton.attr('href') === 'javascript:;' ||
                           nextButton.closest('li').hasClass('disabled');
          
          if (!isDisabled) {
            logger.info(`Next page link found with selector: ${selector}`);
            return true;
          }
        }
      }
      
      // Strategy 2: Look for specific page number link (current + 1)
      const nextPageNum = currentPage + 1;
      const specificPageSelectors = [
        `a[data-pagenumber="${nextPageNum}"]`,        // Data attribute
        `a[href*="/p${nextPageNum}"]`,                // URL pattern
        `.pagination a:contains("${nextPageNum}")`,   // Text content
      ];
      
      for (const selector of specificPageSelectors) {
        if ($(selector).length > 0) {
          logger.info(`Found next page (${nextPageNum}) link with selector: ${selector}`);
          return true;
        }
      }
      
      // Strategy 3: Check if we're below the detected last page
      if (currentPage < lastPageNumber) {
        logger.info(`Current page ${currentPage} is below detected last page ${lastPageNumber}, assuming next page exists`);
        return true;
      }
      
      logger.info(`No next page detected for page ${currentPage}`);
      return false;
      
    } catch (error) {
      logger.warn(`Error in next page detection: ${error.message}`);
      // Conservative fallback - assume next page exists if we're not at detected limit
      return currentPage < lastPageNumber;
    }
  }

  /**
   * Extract the last page number from pagination HTML using multiple strategies
   * @param {Object} $ - Cheerio instance
   * @returns {number} Last page number
   */
  extractLastPageNumber($) {
    let highestPage = 1;
    
    try {
      // Strategy 1: Try multiple pagination selectors with data-pagenumber attributes
      const paginationSelectors = [
        '.p24_pager .pagination li a[data-pagenumber]',  // New structure from provided HTML
        '.p24_paginator a[data-pagenumber]',            // Alternative with data attribute
        '.pagination a[data-pagenumber]',               // Generic pagination with data attribute
        '.p24_pager a[href*="/p"]',                     // New structure URL-based
        '.p24_paginator a[href*="/p"]',                 // Current logic
        '.pagination a[href*="/p"]',                    // Alternative
        '.p24_results .pagination a',                   // Another alternative
        'ul.pagination li a',                           // Generic
      ];
      
      // Try each selector
      for (const selector of paginationSelectors) {
        const pageLinks = $(selector);
        if (pageLinks.length > 0) {
          logger.info(`Found pagination links using selector: ${selector} (${pageLinks.length} links)`);
          
          pageLinks.each((i, el) => {
            // Try getting page number from data attribute first
            const dataPageNumber = $(el).attr('data-pagenumber');
            if (dataPageNumber) {
              const pageNum = parseInt(dataPageNumber, 10);
              if (!isNaN(pageNum) && pageNum > highestPage) {
                highestPage = pageNum;
                logger.info(`Found page number from data-pagenumber: ${pageNum}`);
              }
            } 
            // Then try from URL
            else {
              const href = $(el).attr('href');
              if (href) {
                const match = href.match(/\/p(\d+)/);
                if (match && match[1]) {
                  const pageNum = parseInt(match[1], 10);
                  if (!isNaN(pageNum) && pageNum > highestPage) {
                    highestPage = pageNum;
                    logger.info(`Found page number from URL: ${pageNum}`);
                  }
                }
              }
            }
          });
          
          // If we found pages with this selector, stop checking others
          if (highestPage > 1) {
            logger.info(`Successfully detected ${highestPage} pages using selector: ${selector}`);
            break;
          }
        }
      }
      
      // Strategy 2: Look for "Last Page" or "Last" links specifically
      if (highestPage <= 1) {
        const lastPageSelectors = [
          'a[title*="Last"]',
          'a:contains("Last")',
          'a:contains("»")',
          '.pagination li:last-child a'
        ];
        
        for (const selector of lastPageSelectors) {
          const lastLink = $(selector);
          if (lastLink.length > 0) {
            const href = lastLink.attr('href');
            if (href) {
              const match = href.match(/\/p(\d+)/);
              if (match && match[1]) {
                highestPage = parseInt(match[1], 10);
                logger.info(`Found last page from "Last" link: ${highestPage}`);
                break;
              }
            }
          }
        }
      }
      
      // Strategy 3: Look for text indicators like "Showing 1-20 of 937 properties"
      if (highestPage <= 1) {
        const resultCountSelectors = [
          '.p24_resultCount',
          '.resultCount',
          '.results-count',
          '.p24_results .count',
          '.search-results-count'
        ];
        
        for (const selector of resultCountSelectors) {
          const resultsText = $(selector).text();
          if (resultsText) {
            // Look for patterns like "Showing X of Y properties" or "Y properties found"
            const patterns = [
              /of\s+(\d{1,3}(?:,\d{3})*)\s+properties/i,
              /(\d{1,3}(?:,\d{3})*)\s+properties\s+found/i,
              /total[:\s]*(\d{1,3}(?:,\d{3})*)/i
            ];
            
            for (const pattern of patterns) {
              const totalMatch = resultsText.match(pattern);
              if (totalMatch && totalMatch[1]) {
                const totalProps = parseInt(totalMatch[1].replace(/,/g, ''), 10);
                if (!isNaN(totalProps) && totalProps > 0) {
                  // Assume 20 properties per page (Property24's typical page size)
                  highestPage = Math.ceil(totalProps / 20);
                  logger.info(`Estimated ${highestPage} pages from total property count: ${totalProps}`);
                  break;
                }
              }
            }
            
            if (highestPage > 1) break;
          }
        }
      }
      
    } catch (error) {
      logger.warn(`Error in pagination detection: ${error.message}`);
      // If anything fails, return a conservative estimate
      highestPage = 100; // High default to ensure we don't miss properties
    }
    
    return Math.max(highestPage, 1); // Never return less than 1
  }

  /**
   * Estimate expected number of properties based on pagination and current page
   * @param {Object} $ - Cheerio instance
   * @param {number} totalPages - Total number of pages detected
   * @returns {number} Estimated total properties
   */
  estimateExpectedProperties($, totalPages) {
    try {
      // Try to get current page property count
      const currentPageProperties = $('.p24_tileContainer, .js_resultTile').length;
      
      // Try to get total from result count text
      const resultCountSelectors = ['.p24_resultCount', '.resultCount', '.results-count'];
      for (const selector of resultCountSelectors) {
        const resultsText = $(selector).text();
        const totalMatch = resultsText.match(/of\s+(\d{1,3}(?:,\d{3})*)\s+properties/i);
        if (totalMatch && totalMatch[1]) {
          const totalProps = parseInt(totalMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(totalProps) && totalProps > 0) {
            return totalProps;
          }
        }
      }
      
      // Fallback: estimate based on current page and total pages
      if (currentPageProperties > 0) {
        // Assume all pages except possibly the last have the same number of properties
        return Math.floor(currentPageProperties * totalPages * 0.95); // 95% to account for last page
      }
      
      // Final fallback: assume 20 per page (Property24's typical)
      return totalPages * 20;
      
    } catch (error) {
      logger.warn(`Error estimating expected properties: ${error.message}`);
      return totalPages * 20; // Safe fallback
    }
  }

  /**
   * Scrape property expenses for a given property (only called for new properties)
   * @param {number} propertyId - The property ID in the database
   * @param {string} propertyUrl - The URL of the property detail page
   */
  async scrapePropertyExpenses(propertyId, propertyUrl) {
    try {
      logger.info(`Scraping expenses for new property ${propertyId} from ${propertyUrl}`);
      
      // Initialize the expenses scraper if not already done
      if (!this.expensesScraper) {
        this.expensesScraper = new PropertyExpensesScraper();
      }
      
      // Scrape the expenses for the new property
      const scrapeResult = await this.expensesScraper.scrapePropertyExpenses(propertyUrl, propertyId);
      
      if (scrapeResult.success) {
        logger.info(`Successfully scraped expenses for new property ${propertyId}: Municipal rates: R${scrapeResult.expenses.municipal_rates}, Body corporate: R${scrapeResult.expenses.body_corporate_levies}`);
      } else {
        logger.warn(`Failed to scrape expenses for new property ${propertyId}: ${scrapeResult.error}`);
      }
    } catch (error) {
      logger.error(`Error scraping expenses for new property ${propertyId}: ${error.message}`);
      // Don't throw the error - expenses scraping failure shouldn't break property scraping
    }
  }

  /**
   * Get a random user-agent string
   * @returns {string} Random user-agent
   */
  getRandomUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.18 Safari/537.36",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
}

module.exports = Property24Scraper;

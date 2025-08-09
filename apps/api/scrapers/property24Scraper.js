const { chromium } = require("playwright");
const cheerio = require("cheerio");
const database = require("../db/database");
const winston = require("winston");

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
  constructor() {
    this.baseUrl = "https://www.property24.com";
    this.searchUrl = "https://www.property24.com/for-sale";
    this.source = "property24";
    this.defaultLocation = {
      city: "Somerset West",
      province: "Western Cape",
      country: "South Africa",
    };
    this.possibleUrls = []; // Store alternative URLs for fallback
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
        const specialCases = {
            // Somerset West - verified working patterns
            'somerset-west_western-cape': [
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/390`,
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}/390`,
            ],
            // Cape Town - multiple area patterns
            'cape-town_western-cape': [
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/32`,
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}/32`,
            ],
            // Johannesburg - major metro patterns
            'johannesburg_gauteng': [
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/7`,
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}/7`,
            ],
            // Pretoria patterns
            'pretoria_gauteng': [
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/9`,
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`,
                `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}/9`,
            ],
            // Durban patterns
            'durban_kwazulu-natal': [
                `${this.baseUrl}/for-sale/${citySlug}/kwazulu-natal/22`,
                `${this.baseUrl}/for-sale/${citySlug}/kwazulu-natal`,
                `${this.baseUrl}/for-sale/kwazulu-natal/${citySlug}/22`,
            ],
            // Add more known working patterns as discovered
        };
        
        const key = `${citySlug}_${provinceSlug}`;
        const urls = specialCases[key] || [];
        
        // If we have a specific P24 ID, prioritize that in the URL patterns
        if (p24_id && urls.length > 0) {
            const withId = `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/${p24_id}`;
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
        const citySearch = citySlug.replace(/-/g, '+');
        const provinceSearch = provinceSlug.replace(/-/g, '+');
        
        const patterns = [];
        
        // Priority 1: With Property24 ID (if available)
        if (p24_id) {
            patterns.push(
                `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}/${p24_id}`,
                `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}/${p24_id}`
            );
        }
        
        // Priority 2: Standard slug-based URLs
        patterns.push(
            `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`, // Standard: city/province
            `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}` // Reversed: province/city
        );
        
        // Priority 3: Search-based URLs
        patterns.push(
            `${this.baseUrl}/for-sale?search=${citySearch}&province=${provinceSearch}`,
            `${this.baseUrl}/for-sale?search=${citySearch}+${provinceSearch}`,
            `${this.baseUrl}/for-sale?search=${citySearch}`
        );
        
        // Priority 4: Province-only and general fallbacks
        patterns.push(
            `${this.baseUrl}/for-sale/${provinceSlug}`,
            `${this.baseUrl}/for-sale`
        );
        
        return patterns;
    }

  /**
   * Try multiple URL patterns if the first one doesn't work
   */
  async tryAlternativeUrls(page, location) {
    const provinceSlug = location.province.toLowerCase().replace(/\s+/g, "-");
    const citySlug = location.city.toLowerCase().replace(/\s+/g, "-");
    const citySearch = location.city.toLowerCase().replace(/\s+/g, "+");
    const provinceSearch = location.province.toLowerCase().replace(/\s+/g, "+");

    // Generate alternative URLs for any location
    const alternativeUrls = [
      `${this.baseUrl}/for-sale/${citySlug}/${provinceSlug}`, // Correct order: city/province
      `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}`, // Reversed order (fallback)
      `${this.baseUrl}/for-sale?search=${citySearch}&province=${provinceSearch}`, // Search-based
      `${this.baseUrl}/for-sale/${provinceSlug}`, // Province only
      `${this.baseUrl}/for-sale?search=${citySearch}`, // City search only
      `${this.baseUrl}/for-sale`, // General fallback
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

    // Job record is managed by JobManager, not by scraper directly
    // const job = await database.insertScrapeJob({...}); // REMOVED - JobManager handles this

    let browser;
    let propertiesFound = 0;
    let propertiesNew = 0;
    let propertiesUpdated = 0;
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Starting Property24 scraper for ${locationString} (max ${maxPages} pages)`,
      },
    ];

    try {
      logger.info(`Starting Property24 scraper for ${locationString}`);
      logs.push(`Starting Property24 scraper for ${locationString}`);

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
            const lastPageLink = $('.p24_paginator a[title="Last Page"]');
            if (lastPageLink.length > 0) {
              const lastPageUrl = lastPageLink.attr("href");
              const match = lastPageUrl.match(/\/p(\d+)/);
              if (match && match[1]) {
                lastPageNumber = parseInt(match[1], 10);
                logger.info(`Detected last page: ${lastPageNumber}`);
              }
            } else {
              // If no "Last Page" link, get the highest page number shown
              const pageLinks = $('.p24_paginator a[href*="/p"]');
              pageLinks.each((i, el) => {
                const pageUrl = $(el).attr("href");
                const match = pageUrl.match(/\/p(\d+)/);
                if (match && match[1]) {
                  lastPageNumber = Math.max(
                    lastPageNumber,
                    parseInt(match[1], 10)
                  );
                }
              });
              logger.info(`Detected last page from links: ${lastPageNumber}`);
            }
          } catch (err) {
            logger.warn(`Could not detect last page number: ${err.message}`);
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
        logger.info(`Listings found: ${listings}`);

        if (listings.length === 0) {
          logger.warn("No listings found with any selector");
          logger.info("No listings found with any selector");
        }

        // Process each listing
        for (let i = 0; i < listings.length; i++) {
          try {
            const listing = listings.eq(i);
            propertiesFound++;

            // Extract basic property data
            const property = await this.extractPropertyData(
              $,
              listing,
              location
            );

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
              // Check if property already exists
              const existing = await database.get(
                "SELECT id FROM properties WHERE external_id = ? AND source_website = ?",
                [property.external_id, this.source]
              );

              if (existing) {
                // Update existing property
                await database.run(
                  `
                                UPDATE properties SET 
                                    title = ?, description = ?, price = ?, 
                                    property_type = ?, bedrooms = ?, bathrooms = ?,
                                    parking_spaces = ?, location_city = ?, location_suburb = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `,
                  [
                    property.title,
                    property.description,
                    property.price,
                    property.property_type,
                    property.bedrooms,
                    property.bathrooms,
                    property.parking_spaces,
                    property.location_city,
                    property.location_suburb,
                    existing.id,
                  ]
                );
                propertiesUpdated++;
              } else {
                // Insert new property
                await database.insertProperty(property);
                propertiesNew++;
              }

              logger.info(`Processed: ${property.title} - R${property.price}`);
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

        // Check for next page link with multiple selectors
        const nextPageSelectors = [
          '.p24_paginator a[title="Next"]',
          '.pagination a[title="Next"]',
          '.paginator a:contains("Next")',
          ".pagination .next-page",
          'a[href*="/p' + (currentPage + 1) + '"]',
        ];

        let hasNextPage = false;
        for (const selector of nextPageSelectors) {
          try {
            const nextButton = $(selector);
            if (nextButton.length > 0) {
              hasNextPage = true;
              logger.info(`Next page link found with selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        // Also check if listings exist on next page by checking current page results
        if (hasNextPage && listings.length === 0) {
          hasNextPage = false;
          logger.info(
            "Next page link found but no listings on current page, assuming no more content"
          );
        }

        if (hasNextPage && currentPage < lastPageNumber) {
          currentPage++;
          logger.info(
            `Next page found, continuing to page ${currentPage} of ${lastPageNumber}...`
          );
        } else {
          hasMorePages = false;
          const reason =
            currentPage >= lastPageNumber
              ? "reached last page"
              : "no more pages found";
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

  async extractPropertyData($, listing, location = null) {
    const property = {
      source_website: this.source,
      external_id: null,
      title: null,
      description: null,
      price: null,
      price_currency: "ZAR",
      property_type: null,
      bedrooms: null,
      bathrooms: null,
      parking_spaces: null,
      floor_area: null,
      location_province: null,
      location_city: null,
      location_suburb: null,
      location_address: null,
      source_url: null,
      images: [],
      features: [],
      agent_name: null,
      agent_phone: null,
      listing_date: null,
    };

    try {
      // Extract external ID from data-listing-number attribute (primary method)
      property.external_id =
        listing.attr("data-listing-number") ||
        listing
          .find("[data-listing-number]")
          .first()
          .attr("data-listing-number") ||
        listing
          .find("a")
          .attr("href")
          ?.match(/\/(\d+)\?/)?.[1] ||
        `p24_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Processing property with ID: ${property.external_id}`);

      // Extract title from the actual HTML structure
      // First try the link title attribute
      const titleElement = listing.find(".p24_proTile[title]").first();
      if (titleElement.length > 0) {
        property.title = titleElement.attr("title");
      }

      // Fallback: extract from description text
      if (!property.title) {
        const descElement = listing.find(".p24_description").first();
        if (descElement.length > 0) {
          property.title = descElement.text().trim();
        }
      }

      // Extract source URL from the main link
      const linkEl = listing.find('a[href*="/for-sale/"]').first();
      if (linkEl.length > 0) {
        const href = linkEl.attr("href");
        property.source_url = href.startsWith("http")
          ? href
          : this.baseUrl + href;
      }

      logger.info(`Title extracted: ${property.title}`);
      logger.info(`URL extracted: ${property.source_url}`);

      // Extract description
      const descSelectors = [
        ".p24_description",
        ".listing-description",
        ".property-description",
        ".description",
      ];
      for (const selector of descSelectors) {
        const descEl = listing.find(selector);
        if (descEl.length > 0) {
          property.description = descEl.text().trim();
          break;
        }
      }

      // Extract price from the actual HTML structure
      const priceEl = listing.find(".p24_price").first();
      if (priceEl.length > 0) {
        const priceText = priceEl
          .text()
          .replace(/[^\d\s]/g, "")
          .replace(/\s+/g, "")
          .trim();
        property.price = parseFloat(priceText) || null;
        logger.info(`Price extracted: ${priceText} -> ${property.price}`);
      }

      // Extract property details from structured elements and text
      const detailsText = listing.text().toLowerCase();

      // Extract bedrooms from structured data
      const bedroomFeature = listing
        .find('.p24_featureDetails[title="Bedrooms"] span')
        .last();
      if (bedroomFeature.length > 0) {
        const bedroomText = bedroomFeature.text().trim();
        property.bedrooms = parseInt(bedroomText) || null;
        logger.info(
          `Bedrooms extracted: ${bedroomText} -> ${property.bedrooms}`
        );
      }

      // Extract bathrooms from structured data
      const bathroomFeature = listing
        .find('.p24_featureDetails[title="Bathrooms"] span')
        .last();
      if (bathroomFeature.length > 0) {
        const bathroomText = bathroomFeature.text().trim();
        property.bathrooms = parseFloat(bathroomText) || null; // Use parseFloat for values like 1.5
        logger.info(
          `Bathrooms extracted: ${bathroomText} -> ${property.bathrooms}`
        );
      }

      // Extract parking spaces from structured data
      const parkingFeature = listing
        .find('.p24_featureDetails[title="Parking Spaces"] span')
        .last();
      if (parkingFeature.length > 0) {
        const parkingText = parkingFeature.text().trim();
        property.parking_spaces = parseInt(parkingText) || null;
        logger.info(
          `Parking extracted: ${parkingText} -> ${property.parking_spaces}`
        );
      }

      // Property type
      if (detailsText.includes("house")) property.property_type = "house";
      else if (
        detailsText.includes("apartment") ||
        detailsText.includes("flat")
      )
        property.property_type = "apartment";
      else if (detailsText.includes("townhouse"))
        property.property_type = "townhouse";
      else if (
        detailsText.includes("vacant land") ||
        detailsText.includes("plot")
      )
        property.property_type = "vacant land";

            // Extract location from the actual HTML structure
            const locationEl = listing.find('.p24_location').first();
            if (locationEl.length > 0) {
                const locationText = locationEl.text().trim();
                property.location_suburb = locationText;
                property.location_city = location.city; // Set from scraper context
                property.location_province = location.province; // Set from scraper context
                property.p24_id = location.p24_id; // Pass along Property24 ID
                logger.info(`Location extracted: ${locationText}`);
            }

      // Extract address if available
      const addressEl = listing.find(".p24_address").first();
      if (addressEl.length > 0) {
        property.location_address = addressEl.text().trim();
        logger.info(`Address extracted: ${property.location_address}`);
      }

      // Extract listing date - try to find date information
      const dateSelectors = [
        '.p24_listingDate',
        '.listing-date',
        '.date-listed',
        '.p24_dateAdded'
      ];
      
      for (const selector of dateSelectors) {
        const dateEl = listing.find(selector);
        if (dateEl.length > 0) {
          const dateText = dateEl.text().trim();
          // Try to parse various date formats
          const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})|(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
          if (dateMatch) {
            // Convert to ISO format
            if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
              // DD/MM/YYYY or MM/DD/YYYY format
              const day = dateMatch[1].padStart(2, '0');
              const month = dateMatch[2].padStart(2, '0');
              const year = dateMatch[3];
              property.listing_date = `${year}-${month}-${day}`;
            } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) {
              // YYYY/MM/DD format
              const year = dateMatch[4];
              const month = dateMatch[5].padStart(2, '0');
              const day = dateMatch[6].padStart(2, '0');
              property.listing_date = `${year}-${month}-${day}`;
            }
            break;
          }
        }
      }
      
      // If no explicit date found, use current date as fallback
      if (!property.listing_date) {
        property.listing_date = new Date().toISOString().split('T')[0];
      }
      
      logger.info(`Listing date extracted/assigned: ${property.listing_date}`);

      // Extract agent info
      const agentSelectors = [".p24_agent", ".listing-agent", ".agent-name"];
      for (const selector of agentSelectors) {
        const agentEl = listing.find(selector);
        if (agentEl.length > 0) {
          property.agent_name = agentEl.text().trim();
          break;
        }
      }

      // Extract images
      const imgElements = listing.find("img");
      imgElements.each((i, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && !src.includes("placeholder") && !src.includes("logo")) {
          property.images.push(
            src.startsWith("http") ? src : this.baseUrl + src
          );
        }
      });
    } catch (error) {
      logger.error("Error extracting property data:", error.message);
    }

    return property;
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

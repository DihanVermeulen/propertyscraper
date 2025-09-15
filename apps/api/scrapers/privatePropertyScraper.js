const { chromium } = require('playwright');
const cheerio = require('cheerio');
const database = require('../db/database');
const winston = require('winston');
const PropertyExpensesScraper = require('../services/PropertyExpensesScraper');

// Configure logger
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
        new winston.transports.File({ filename: 'scraper.log' })
    ]
});

class PrivatePropertyScraper {
    constructor() {
        this.baseUrl = 'https://www.privateproperty.co.za';
        this.searchUrl = 'https://www.privateproperty.co.za/for-sale';
        this.source = 'privateproperty';
        this.defaultLocation = {
            city: 'Somerset West',
            province: 'Western Cape',
            country: 'South Africa'
        };
        this.expensesScraper = null; // Will be initialized when needed
    }

    /**
     * Build location-specific search URL
     * @param {Object} location - Location object with city, province, country
     * @returns {string} Location-specific search URL
     */
    buildLocationUrl(location) {
        // Use the correct PrivateProperty URL structure for Somerset West
        if (location.city.toLowerCase() === 'somerset west' && location.province.toLowerCase() === 'western cape') {
            // Multiple possible URL patterns for Somerset West on PrivateProperty
            this.possibleUrls = [
                'https://www.privateproperty.co.za/for-sale/western-cape/somerset-west',
                'https://www.privateproperty.co.za/for-sale?search=somerset+west&province=western-cape',
                'https://www.privateproperty.co.za/for-sale?location=somerset-west',
                'https://www.privateproperty.co.za/for-sale/western-cape', // Fallback to province level
                'https://www.privateproperty.co.za/for-sale' // General fallback
            ];
            return this.possibleUrls[0]; // Start with the first one
        }
        
        // Fallback for other locations
        const citySlug = location.city.toLowerCase().replace(/\s+/g, '-');
        const provinceSlug = location.province.toLowerCase().replace(/\s+/g, '-');
        return `${this.baseUrl}/for-sale/${provinceSlug}/${citySlug}`;
    }

    /**
     * Try multiple URL patterns if the first one doesn't work
     */
    async tryAlternativeUrls(page, location) {
        if (!this.possibleUrls || this.possibleUrls.length <= 1) {
            return false;
        }

        for (let i = 1; i < this.possibleUrls.length; i++) {
            try {
                const alternativeUrl = this.possibleUrls[i];
                console.log(`Trying alternative URL: ${alternativeUrl}`);
                
                await page.goto(alternativeUrl, { waitUntil: 'networkidle' });
                
                // Check if we found listings with comprehensive selectors
                const listingCheckSelectors = [
                    '.listingContainer', '.property-listing', '.searchResult',
                    '.property-item', '.listing-item', '.property-card',
                    '.search-result', '.listing', '[data-property-id]',
                    '[data-listing-id]', '.property', 'article.property'
                ];
                
                let hasListings = false;
                for (const checkSelector of listingCheckSelectors) {
                    if (await page.$(checkSelector)) {
                        hasListings = true;
                        break;
                    }
                }
                if (hasListings) {
                    console.log(`Found listings with URL: ${alternativeUrl}`);
                    return true;
                }
            } catch (error) {
                console.log(`Alternative URL ${this.possibleUrls[i]} failed: ${error.message}`);
            }
        }
        
        return false;
    }

    async scrape(options = {}) {
        const location = options.location || this.defaultLocation;
        const locationString = `${location.city}, ${location.province}, ${location.country}`;
        
        // Job record is managed by JobManager, not by scraper directly
        // const job = await database.insertScrapeJob({...}); // REMOVED - JobManager handles this
        
        let browser;
        let propertiesFound = 0;
        let propertiesNew = 0;
        let propertiesUpdated = 0;
        const logs = [{
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Starting Private Property scraper for ${locationString}`
        }];

        try {
            logger.info(`Starting Private Property scraper for ${locationString}`);
            logs.push(`Starting Private Property scraper for ${locationString}`);

            browser = await chromium.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
            
            const page = await context.newPage();
            
            // Set longer timeout for slow pages
            page.setDefaultTimeout(30000);
            
            // Build location-specific URL
            let searchUrl = this.buildLocationUrl(location);
            logger.info(`Navigating to: ${searchUrl}`);
            logs.push(`Navigating to: ${searchUrl}`);
            
            // Navigate to location-specific search page
            await page.goto(searchUrl, { waitUntil: 'networkidle' });
            
            // Try alternative URLs if no listings found
            const hasListings = await page.$('.listingContainer, .property-listing, .searchResult');
            if (!hasListings) {
                const success = await this.tryAlternativeUrls(page, location);
                if (!success) {
                    logger.error('No valid URL found for Somerset West on PrivateProperty');
                    logs.push('No valid URL found for Somerset West on PrivateProperty');
                }
            }
            
            // Wait for listings to load - try multiple selectors
            const waitSelectors = [
                '.listingContainer', '.property-listing', '.searchResult',
                '.property-item', '.listing-item', '.property-card', '.property'
            ];
            
            let listingsLoaded = false;
            for (const waitSelector of waitSelectors) {
                try {
                    await page.waitForSelector(waitSelector, { timeout: 5000 });
                    listingsLoaded = true;
                    logger.info(`Listings loaded with selector: ${waitSelector}`);
                    break;
                } catch (error) {
                    // Continue to next selector
                    continue;
                }
            }
            
            if (!listingsLoaded) {
                logger.warn('No listings selectors found after waiting');
            }
            
            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Extract property listings - Comprehensive selectors for PrivateProperty
            const listingSelectors = [
                '.listingContainer .property-item',        // Primary pattern
                '.searchResults .property-listing',        // Search results pattern
                '.search-results .listing-item',           // Alternative search results
                '.property-results .property-card',        // Property cards pattern
                '.property-listing',                       // Generic property listing
                '.listing-item',                           // Generic listing item
                '.property-card',                          // Generic property card
                '.search-result',                          // Generic search result
                '.listing',                                // Generic listing
                '[data-property-id]',                      // Properties with data attributes
                '[data-listing-id]',                       // Listings with data attributes
                '.property',                               // Generic property class
                'article.property',                        // Semantic property articles
                '.result-item'                             // Generic result items
            ];
            
            let listings = $();
            for (const selector of listingSelectors) {
                const found = $(selector);
                if (found.length > 0) {
                    listings = found;
                    logger.info(`Found ${found.length} listings using selector: ${selector}`);
                    break;
                }
            }
            
            if (listings.length === 0) {
                logger.warn('No listings found with any selector');
                logs.push('No listings found with any selector');
            }
            
            // Process each listing
            for (let i = 0; i < listings.length; i++) {
                try {
                    const listing = listings.eq(i);
                    propertiesFound++;
                    
                    // Extract basic property data
                    const property = await this.extractPropertyData($, listing, location);
                    
                    // Filter properties to only include Somerset West area
                    const isInTargetLocation = this.isInTargetLocation(property, location);
                    
                    if (property.external_id && property.title && isInTargetLocation) {
                        // Check if property already exists
                        const existing = await database.get(
                            'SELECT id FROM properties WHERE external_id = ? AND source_website = ?',
                            [property.external_id, this.source]
                        );
                        
                        if (existing) {
                            // Update existing property
                            await database.run(`
                                UPDATE properties SET 
                                    title = ?, description = ?, price = ?, 
                                    property_type = ?, bedrooms = ?, bathrooms = ?,
                                    parking_spaces = ?, location_city = ?, location_suburb = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [
                                property.title, property.description, property.price,
                                property.property_type, property.bedrooms, property.bathrooms,
                                property.parking_spaces, property.location_city, property.location_suburb,
                                existing.id
                            ]);
                            propertiesUpdated++;
                        } else {
                            // Insert new property
                            const insertResult = await database.insertProperty(property);
                            propertiesNew++;
                            property.id = insertResult.id; // Store the new property ID
                            
                            // Scrape property expenses only for new properties to avoid IP blocking
                            if (property.source_url && property.id) {
                                await this.scrapePropertyExpenses(property.id, property.source_url);
                            }
                        }
                        
                        logger.info(`Processed: ${property.title} - R${property.price}`);
                    }
                } catch (error) {
                    logger.error(`Error processing listing ${i}:`, error.message);
                    logs.push(`Error processing listing ${i}: ${error.message}`);
                }
            }
            
            // Job status is managed by JobManager, not by scraper directly
            // await database.updateScrapeJob(...); // REMOVED - JobManager handles this
            
            logger.info(`Private Property scraping completed. Found: ${propertiesFound}, New: ${propertiesNew}, Updated: ${propertiesUpdated}`);
            
        } catch (error) {
            logger.error('Private Property scraper failed:', error.message);
            logs.push(`Scraper failed: ${error.message}`);
            
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
            propertiesUpdated
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
        
        const cityMatch = property.location_city && 
            property.location_city.toLowerCase().includes(targetLocation.city.toLowerCase());
        const suburbMatch = property.location_suburb && 
            property.location_suburb.toLowerCase().includes(targetLocation.city.toLowerCase());
        const provinceMatch = !property.location_province || 
            property.location_province.toLowerCase().includes(targetLocation.province.toLowerCase());
            
        return (cityMatch || suburbMatch) && provinceMatch;
    }
    
    async extractPropertyData($, listing, location = null) {
        const property = {
            source_website: this.source,
            external_id: null,
            title: null,
            description: null,
            price: null,
            price_currency: 'ZAR',
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
            listing_date: null
        };
        
        try {
            // Extract external ID from various possible sources
            property.external_id = listing.attr('data-property-id') || 
                                 listing.attr('data-listing-id') || 
                                 listing.find('[data-property-id]').attr('data-property-id') ||
                                 listing.find('a').attr('href')?.match(/\d+/)?.[0] ||
                                 `pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Extract title
            const titleSelectors = [
                '.property-title a', '.listing-title a', '.title a',
                'h2 a', 'h3 a', '.property-name a', 'a.property-link'
            ];
            for (const selector of titleSelectors) {
                const titleEl = listing.find(selector);
                if (titleEl.length > 0) {
                    property.title = titleEl.text().trim();
                    const href = titleEl.attr('href');
                    property.source_url = href && this.baseUrl + href;
                    break;
                }
            }
            
            // Extract description
            const descSelectors = ['.property-description', '.listing-description', '.description', '.property-summary'];
            for (const selector of descSelectors) {
                const descEl = listing.find(selector);
                if (descEl.length > 0) {
                    property.description = descEl.text().trim();
                    break;
                }
            }
            
            // Extract price
            const priceSelectors = ['.property-price', '.listing-price', '.price', '.amount'];
            for (const selector of priceSelectors) {
                const priceEl = listing.find(selector);
                if (priceEl.length > 0) {
                    const priceText = priceEl.text().replace(/[^\d.]/g, '');
                    property.price = parseFloat(priceText) || null;
                    break;
                }
            }
            
            // Extract property details
            const detailsText = listing.text().toLowerCase();
            
            // Bedrooms
            const bedroomMatch = detailsText.match(/(\d+)\s*(bed|bedroom)/);
            property.bedrooms = bedroomMatch ? parseInt(bedroomMatch[1]) : null;
            
            // Bathrooms  
            const bathroomMatch = detailsText.match(/(\d+)\s*(bath|bathroom)/);
            property.bathrooms = bathroomMatch ? parseInt(bathroomMatch[1]) : null;
            
            // Parking
            const parkingMatch = detailsText.match(/(\d+)\s*(garage|parking|carport)/);
            property.parking_spaces = parkingMatch ? parseInt(parkingMatch[1]) : null;
            
            // Floor area
            const areaMatch = detailsText.match(/(\d+)\s*(m2|sqm|square)/);
            property.floor_area = areaMatch ? parseInt(areaMatch[1]) : null;
            
            // Property type
            if (detailsText.includes('house') || detailsText.includes('home')) property.property_type = 'house';
            else if (detailsText.includes('apartment') || detailsText.includes('flat')) property.property_type = 'apartment';
            else if (detailsText.includes('townhouse') || detailsText.includes('town house')) property.property_type = 'townhouse';
            else if (detailsText.includes('vacant land') || detailsText.includes('plot') || detailsText.includes('stand')) property.property_type = 'vacant land';
            else if (detailsText.includes('commercial')) property.property_type = 'commercial';
            
            // Extract location
            const locationSelectors = ['.property-location', '.listing-location', '.location', '.address'];
            for (const selector of locationSelectors) {
                const locationEl = listing.find(selector);
                if (locationEl.length > 0) {
                    const locationText = locationEl.text().trim();
                    const parts = locationText.split(',').map(s => s.trim());
                    
                    if (parts.length >= 2) {
                        property.location_suburb = parts[0];
                        property.location_city = parts[1];
                    } else if (parts.length === 1) {
                        property.location_city = parts[0];
                    }
                    
                    // Set to Western Cape (focusing on Somerset West area)
                    const cityLower = (property.location_city || '').toLowerCase();
                    const suburbLower = (property.location_suburb || '').toLowerCase();
                    
                    if (cityLower.includes('somerset west') || suburbLower.includes('somerset west') ||
                        cityLower.includes('cape town') || cityLower.includes('stellenbosch') || 
                        cityLower.includes('george') || cityLower.includes('western cape')) {
                        property.location_province = 'Western Cape';
                    } else {
                        // Default to Western Cape for this focused scraper
                        property.location_province = 'Western Cape';
                    }
                    break;
                }
            }
            
            // Extract agent info
            const agentSelectors = ['.agent-name', '.listing-agent', '.property-agent', '.agent'];
            for (const selector of agentSelectors) {
                const agentEl = listing.find(selector);
                if (agentEl.length > 0) {
                    property.agent_name = agentEl.text().trim();
                    break;
                }
            }
            
            // Extract agent phone
            const phoneSelectors = ['.agent-phone', '.phone', '.contact-number'];
            for (const selector of phoneSelectors) {
                const phoneEl = listing.find(selector);
                if (phoneEl.length > 0) {
                    property.agent_phone = phoneEl.text().trim();
                    break;
                }
            }
            
            // Extract images
            const imgElements = listing.find('img');
            imgElements.each((i, img) => {
                const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy');
                if (src && !src.includes('placeholder') && !src.includes('logo') && !src.includes('icon')) {
                    const fullSrc = src.startsWith('http') ? src : this.baseUrl + src;
                    if (!property.images.includes(fullSrc)) {
                        property.images.push(fullSrc);
                    }
                }
            });
            
            // Extract features
            const featureSelectors = ['.property-features', '.features', '.amenities'];
            for (const selector of featureSelectors) {
                const featuresEl = listing.find(selector);
                if (featuresEl.length > 0) {
                    featuresEl.find('li, span, div').each((i, el) => {
                        const feature = $(el).text().trim().toLowerCase();
                        if (feature && feature.length > 2 && feature.length < 50) {
                            property.features.push(feature);
                        }
                    });
                    break;
                }
            }
            
        } catch (error) {
            logger.error('Error extracting property data:', error.message);
        }
        
        return property;
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
}

module.exports = PrivatePropertyScraper;

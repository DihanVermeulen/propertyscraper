const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Import the scraper class
const Property24Scraper = require('../scrapers/property24Scraper');
const cheerio = require('cheerio');

async function testRentalExtraction() {
    console.log('🔍 Starting rental extraction test...');
    
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });
        
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        
        // Test rental URL for Cape Town
        const testUrl = 'https://www.property24.com/to-rent/western-cape/9';
        console.log(`🌐 Navigating to: ${testUrl}`);
        
        await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(3000);
        
        // Get property links
        console.log('📋 Finding property links...');
        const propertyLinks = await page.evaluate(() => {
            // Look for individual property links, not just any rental link
            const selectors = [
                '.p24_tileContainer a[href*="/to-rent/"]', // Property tile links
                '.js_resultTile a[href*="/to-rent/"]', // Result tile links  
                '.p24_regularTile a[href*="/to-rent/"]', // Regular tile links
                '.p24_content a[href*="/to-rent/"]', // Content area links
                'a[href*="/to-rent/"][href*="/-"]' // Links with property ID patterns
            ];
            
            let links = [];
            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                
                elements.forEach(el => {
                    if (el.href && el.href.includes('/to-rent/') && 
                        // Filter out search/listing page URLs and keep only individual property pages
                        !el.href.match(/\/(to-rent\/[^/]+\/[^/]+\/?$)/) && // Avoid pages ending with just province/city
                        (el.href.includes('/-') || el.href.match(/\/\d+$/))) { // Look for property-specific patterns
                        
                        links.push({
                            url: el.href,
                            text: el.textContent?.trim() || 'No text',
                            selector: selector
                        });
                    }
                });
                
                if (links.length > 0) break;
            }
            
            // Remove duplicates
            const uniqueLinks = [];
            const seenUrls = new Set();
            for (const link of links) {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                }
            }
            
            return uniqueLinks.slice(0, 3); // Test first 3 unique properties
        });
        
        console.log(`🏠 Found ${propertyLinks.length} rental property links`);
        propertyLinks.forEach((link, i) => {
            console.log(`  ${i + 1}. ${link.url}`);
            console.log(`     Text: "${link.text}"`);
            console.log(`     Found via: ${link.selector}`);
        });
        
        if (propertyLinks.length === 0) {
            console.log('❌ No rental property links found! Checking page content...');
            const pageTitle = await page.title();
            const url = await page.url();
            console.log(`Current page title: ${pageTitle}`);
            console.log(`Current URL: ${url}`);
            
            // Save page HTML for inspection
            const html = await page.content();
            fs.writeFileSync(path.join(__dirname, 'debug-rental-page.html'), html);
            console.log('💾 Saved page HTML to debug-rental-page.html');
            return;
        }
        
        // Test extraction on each property
        for (let i = 0; i < propertyLinks.length; i++) {
            const link = propertyLinks[i];
            console.log(`\n🔍 Testing extraction for property ${i + 1}: ${link.url}`);
            
            try {
                await page.goto(link.url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(2000);
                
                console.log('📄 Page loaded, attempting extraction...');
                
                // Get page HTML and test extraction
                const html = await page.content();
                
                // Save individual property HTML for debugging
                fs.writeFileSync(
                    path.join(__dirname, `debug-property-${i + 1}.html`), 
                    html
                );
                
                console.log('🧪 Running extraction function...');
                
                // Create scraper instance and use its extraction method
                const scraper = new Property24Scraper('rent');
                const $ = cheerio.load(html);
                
                // Look for rental property elements on the page
                const listingSelectors = [
                    '.p24_content', // Individual property page content
                    '.property-details',
                    'body' // Fallback - use whole page
                ];
                
                let extractedData = null;
                for (const selector of listingSelectors) {
                    const listing = $(selector).first();
                    if (listing.length > 0) {
                        console.log(`Using selector: ${selector}`);
                        extractedData = await scraper.extractRentalPropertyData($, listing, {
                            city: 'Cape Town',
                            province: 'Western Cape',
                            country: 'South Africa'
                        });
                        break;
                    }
                }
                
                if (!extractedData) {
                    console.log('❌ No suitable content found for extraction');
                    continue;
                }
                
                console.log('✅ Extraction results:');
                console.log(JSON.stringify(extractedData, null, 2));
                
                // Test validation for rental properties
                if (extractedData.title && extractedData.rental_price && extractedData.bedrooms !== undefined) {
                    console.log('✅ Property passes basic validation');
                } else {
                    console.log('❌ Property fails validation:');
                    console.log(`  Title: ${extractedData.title ? '✅' : '❌'}`);
                    console.log(`  Rental Price: ${extractedData.rental_price ? '✅' : '❌'}`);
                    console.log(`  Bedrooms: ${extractedData.bedrooms !== undefined ? '✅' : '❌'}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing property ${i + 1}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Also test the actual scraper database operations
async function testDatabaseOperations() {
    console.log('\n🗄️ Testing database operations...');
    
    try {
        // Import database utilities
        const database = require('../db/database');
        
        // Test rental properties table
        console.log('📊 Checking rental_properties table...');
        const rentalCountResult = await database.getRentalPropertyCount();
        const rentalCount = rentalCountResult.count || 0;
        console.log(`Current rental properties count: ${rentalCount}`);
        
        // Check recent rental properties
        const recentRentals = await database.getRentalProperties({}, 5, 0);
        
        console.log('📋 Recent rental properties:');
        if (recentRentals && recentRentals.length > 0) {
            recentRentals.forEach(rental => {
                console.log(`  - ${rental.title} (R${rental.rental_price}) [${rental.external_id}]`);
            });
        } else {
            console.log('  No rental properties found');
        }
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
    }
}

async function runAllTests() {
    await testRentalExtraction();
    await testDatabaseOperations();
    
    console.log('\n🎯 Test Summary:');
    console.log('- Check debug-rental-page.html for the main listing page');
    console.log('- Check debug-property-*.html for individual property pages');
    console.log('- Review extraction results above');
    console.log('- Check database operations results');
}

if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testRentalExtraction, testDatabaseOperations };

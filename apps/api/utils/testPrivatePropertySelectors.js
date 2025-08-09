const { chromium } = require('playwright');
const cheerio = require('cheerio');

async function testPrivatePropertySelectors() {
    console.log('Testing PrivateProperty website selectors...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();
    
    const urls = [
        'https://www.privateproperty.co.za/for-sale/western-cape/somerset-west',
        'https://www.privateproperty.co.za/for-sale?search=somerset+west&province=western-cape',
        'https://www.privateproperty.co.za/for-sale?location=somerset-west',
        'https://www.privateproperty.co.za/for-sale/western-cape'
    ];
    
    for (const url of urls) {
        console.log(`\n--- Testing URL: ${url} ---`);
        
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            console.log('✓ Page loaded successfully');
            
            // Wait for page to render
            await page.waitForTimeout(3000);
            
            const content = await page.content();
            const $ = cheerio.load(content);
            
            // Test various selectors
            const selectors = [
                '.listingContainer .property-item',
                '.searchResults .property-listing',
                '.search-results .listing-item',
                '.property-results .property-card',
                '.property-listing',
                '.listing-item',
                '.property-card',
                '.search-result',
                '.listing',
                '[data-property-id]',
                '[data-listing-id]',
                '.property',
                'article.property',
                '.result-item',
                // Additional common patterns
                '.property-search-result',
                '.listing-result',
                '.property-item',
                '.property-container',
                '.search-listing',
                '.property-summary'
            ];
            
            let foundAny = false;
            for (const selector of selectors) {
                const found = $(selector);
                if (found.length > 0) {
                    console.log(`✓ Found ${found.length} elements with selector: ${selector}`);
                    foundAny = true;
                    
                    // Show first few elements for debugging
                    if (found.length > 0) {
                        console.log(`  Sample element: ${found.first().text().substring(0, 100)}...`);
                    }
                }
            }
            
            if (!foundAny) {
                console.log('✗ No elements found with any selector');
                
                // Show page title and some key elements for debugging
                console.log(`Page title: ${$('title').text()}`);
                console.log(`Body classes: ${$('body').attr('class')}`);
                
                // Look for any elements that might contain property data
                const potentialElements = $('div[class*="property"], div[class*="listing"], div[class*="result"], div[class*="search"]');
                console.log(`Found ${potentialElements.length} potential property-related elements`);
                
                if (potentialElements.length > 0) {
                    potentialElements.slice(0, 3).each((i, el) => {
                        const classes = $(el).attr('class');
                        console.log(`  - Element ${i + 1}: classes="${classes}"`);
                    });
                }
            }
            
        } catch (error) {
            console.log(`✗ Error loading ${url}: ${error.message}`);
        }
    }
    
    await browser.close();
}

// Run the test
testPrivatePropertySelectors()
    .then(() => {
        console.log('\nSelector testing completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('Test failed:', error);
        process.exit(1);
    });

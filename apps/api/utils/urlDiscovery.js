const { chromium } = require('playwright');

/**
 * Utility to discover correct URL patterns for property websites
 */
class UrlDiscovery {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }

    /**
     * Test URL patterns for Somerset West on PrivateProperty
     */
    async testPrivatePropertyUrls() {
        const urlPatterns = [
            'https://www.privateproperty.co.za/for-sale/western-cape/somerset-west',
            'https://www.privateproperty.co.za/for-sale/somerset-west',
            'https://www.privateproperty.co.za/for-sale/western-cape/somerset-west/',
            'https://www.privateproperty.co.za/for-sale?search=somerset+west&province=western-cape',
            'https://www.privateproperty.co.za/for-sale?location=somerset-west',
            'https://www.privateproperty.co.za/for-sale?q=somerset+west'
        ];

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ userAgent: this.userAgent });
        const page = await context.newPage();

        const results = [];

        for (const url of urlPatterns) {
            try {
                console.log(`Testing: ${url}`);
                
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                
                // Check for property listings
                const listingSelectors = [
                    '.listingContainer .property-item',
                    '.searchResults .property-listing', 
                    '.search-results .listing-item',
                    '.property-results .property-card',
                    '.property-listing',
                    '.listing-result'
                ];

                let foundListings = false;
                let listingCount = 0;

                for (const selector of listingSelectors) {
                    const listings = await page.$$(selector);
                    if (listings.length > 0) {
                        foundListings = true;
                        listingCount = listings.length;
                        break;
                    }
                }

                // Also check page title and content for Somerset West
                const title = await page.title();
                const content = await page.content();
                const hasSomersetWest = content.toLowerCase().includes('somerset west') || 
                                      title.toLowerCase().includes('somerset west');

                results.push({
                    url,
                    status: foundListings ? 'SUCCESS' : 'NO_LISTINGS',
                    listingCount,
                    hasSomersetWest,
                    title: title.substring(0, 100)
                });

                console.log(`  Result: ${foundListings ? 'SUCCESS' : 'NO_LISTINGS'} - ${listingCount} listings, Somerset West: ${hasSomersetWest}`);

            } catch (error) {
                results.push({
                    url,
                    status: 'ERROR',
                    error: error.message,
                    listingCount: 0,
                    hasSomersetWest: false
                });
                console.log(`  Result: ERROR - ${error.message}`);
            }

            // Wait between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        await browser.close();
        return results;
    }

    /**
     * Test URL patterns for Somerset West on Property24
     */
    async testProperty24Urls() {
        const urlPatterns = [
            'https://www.property24.com/for-sale/somerset-west/western-cape/390',
            'https://www.property24.com/for-sale/somerset-west/western-cape/390H',
            'https://www.property24.com/for-sale/somerset-west/western-cape',
            'https://www.property24.com/for-sale?search=somerset+west&province=western+cape'
        ];

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ userAgent: this.userAgent });
        const page = await context.newPage();

        const results = [];

        for (const url of urlPatterns) {
            try {
                console.log(`Testing: ${url}`);
                
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                
                // Check for property listings
                const listingSelectors = [
                    '.p24_results .p24_propertyTile',
                    '.listing-results .listing-result-item',
                    '.search-results .property-listing',
                    '.property-listing',
                    '.listing-result'
                ];

                let foundListings = false;
                let listingCount = 0;

                for (const selector of listingSelectors) {
                    const listings = await page.$$(selector);
                    if (listings.length > 0) {
                        foundListings = true;
                        listingCount = listings.length;
                        break;
                    }
                }

                // Also check page title and content for Somerset West
                const title = await page.title();
                const content = await page.content();
                const hasSomersetWest = content.toLowerCase().includes('somerset west') || 
                                      title.toLowerCase().includes('somerset west');

                results.push({
                    url,
                    status: foundListings ? 'SUCCESS' : 'NO_LISTINGS',
                    listingCount,
                    hasSomersetWest,
                    title: title.substring(0, 100)
                });

                console.log(`  Result: ${foundListings ? 'SUCCESS' : 'NO_LISTINGS'} - ${listingCount} listings, Somerset West: ${hasSomersetWest}`);

            } catch (error) {
                results.push({
                    url,
                    status: 'ERROR',
                    error: error.message,
                    listingCount: 0,
                    hasSomersetWest: false
                });
                console.log(`  Result: ERROR - ${error.message}`);
            }

            // Wait between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        await browser.close();
        return results;
    }

    /**
     * Run URL discovery for both sites
     */
    async discoverUrls() {
        console.log('🔍 Discovering URL patterns for Somerset West...\n');

        console.log('📍 Testing Property24 URLs:');
        const property24Results = await this.testProperty24Urls();

        console.log('\n📍 Testing PrivateProperty URLs:');
        const privatePropertyResults = await this.testPrivatePropertyUrls();

        return {
            property24: property24Results,
            privateproperty: privatePropertyResults
        };
    }
}

// Run discovery if called directly
if (require.main === module) {
    const discovery = new UrlDiscovery();
    discovery.discoverUrls()
        .then((results) => {
            console.log('\n📊 URL Discovery Results:');
            console.log('=========================');
            
            console.log('\nProperty24 Results:');
            results.property24.forEach(result => {
                console.log(`${result.status === 'SUCCESS' ? '✅' : result.status === 'NO_LISTINGS' ? '⚠️' : '❌'} ${result.url}`);
                if (result.status === 'SUCCESS') {
                    console.log(`   Found ${result.listingCount} listings`);
                }
                if (result.error) {
                    console.log(`   Error: ${result.error}`);
                }
            });

            console.log('\nPrivateProperty Results:');
            results.privateproperty.forEach(result => {
                console.log(`${result.status === 'SUCCESS' ? '✅' : result.status === 'NO_LISTINGS' ? '⚠️' : '❌'} ${result.url}`);
                if (result.status === 'SUCCESS') {
                    console.log(`   Found ${result.listingCount} listings`);
                }
                if (result.error) {
                    console.log(`   Error: ${result.error}`);
                }
            });

            process.exit(0);
        })
        .catch((error) => {
            console.error('Discovery failed:', error);
            process.exit(1);
        });
}

module.exports = UrlDiscovery;

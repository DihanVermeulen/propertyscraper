const database = require('../db/database');
const Property24Scraper = require('../scrapers/property24Scraper');

async function testRealRentalScraping() {
    try {
        console.log('🔍 Testing Real Rental Scraping Process...\n');

        // Create scraper instance
        const scraper = new Property24Scraper('rent');
        scraper.city = 'somerset-west';
        scraper.province = 'western-cape';

        console.log('1. 🌐 Making actual web request to Property24...');
        
        const location = { city: 'Somerset West', province: 'Western Cape' };
        
        // Use the scraper's buildRentalUrl method
        const url = scraper.buildRentalUrl(location);
        console.log(`   URL: ${url}`);

        // Make request using scraper's fetch method
        let html;
        try {
            const response = await scraper.fetchWithRetries(url, {
                headers: scraper.getHeaders()
            });
            html = response.data;
            console.log(`   ✅ Request successful, HTML length: ${html.length}`);
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
            return;
        }

        // Parse with cheerio
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        console.log('\\n2. 🔍 Analyzing HTML Structure:');
        
        // Check for rental listings
        const listingSelectors = [
            '.p24_tileContainer',
            '.js_resultTile',
            '.tile-container',
            '.property-tile',
            '.listing-tile'
        ];

        let foundListings = null;
        let selectorUsed = '';
        
        for (const selector of listingSelectors) {
            const listings = $(selector);
            if (listings.length > 0) {
                foundListings = listings;
                selectorUsed = selector;
                console.log(`   ✅ Found ${listings.length} listings using selector: ${selector}`);
                break;
            } else {
                console.log(`   ❌ No listings found with selector: ${selector}`);
            }
        }

        if (!foundListings || foundListings.length === 0) {
            console.log('   ⚠️ No listings found with any selector');
            console.log('   🔍 Available elements with class containing "tile" or "result":');
            
            const tileElements = $('[class*="tile"], [class*="result"], [class*="listing"]');
            tileElements.each((i, el) => {
                if (i < 5) { // Show first 5
                    console.log(`      Element ${i + 1}: ${$(el).attr('class')}`);
                }
            });
            return;
        }

        console.log('\\n3. 📋 Testing Property Extraction:');
        
        // Test first 3 listings
        const testListings = foundListings.slice(0, 3);
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < testListings.length; i++) {
            const listing = foundListings.eq(i);
            
            console.log(`\\n   🏠 Testing listing ${i + 1}:`);
            
            try {
                const property = await scraper.extractRentalPropertyData($, listing, location);
                
                console.log(`      external_id: ${property.external_id || 'MISSING'}`);
                console.log(`      title: ${(property.title || 'MISSING').substring(0, 60)}...`);
                console.log(`      rental_price: ${property.rental_price || 'MISSING'}`);
                console.log(`      bedrooms: ${property.bedrooms || 'MISSING'}`);
                console.log(`      bathrooms: ${property.bathrooms || 'MISSING'}`);
                console.log(`      location_city: ${property.location_city || 'MISSING'}`);
                console.log(`      source_url: ${property.source_url || 'MISSING'}`);
                
                // Test validation
                const hasExternalId = !!(property.external_id);
                const hasTitle = !!(property.title);
                const isInLocation = scraper.isInTargetLocation(property, location);
                
                console.log(`      ✔️ Has external_id: ${hasExternalId}`);
                console.log(`      ✔️ Has title: ${hasTitle}`);
                console.log(`      ✔️ In target location: ${isInLocation}`);
                
                const wouldSave = hasExternalId && hasTitle && isInLocation;
                console.log(`      📊 Would save: ${wouldSave ? '✅ YES' : '❌ NO'}`);
                
                if (wouldSave) {
                    successCount++;
                    
                    // Test actual database save
                    try {
                        await database.insertRentalProperty(property);
                        console.log(`      💾 Database save: ✅ SUCCESS`);
                        
                        // Clean up
                        await database.run('DELETE FROM rental_properties WHERE external_id = ?', [property.external_id]);
                    } catch (dbError) {
                        console.log(`      💾 Database save: ❌ FAILED (${dbError.message})`);
                    }
                } else {
                    failCount++;
                    console.log(`      💾 Database save: ⏭️ SKIPPED (validation failed)`);
                }
                
            } catch (extractError) {
                console.log(`      ❌ Extraction failed: ${extractError.message}`);
                failCount++;
            }
        }

        console.log(`\\n4. 📊 Summary:`)
        console.log(`   Total listings found: ${foundListings.length}`);
        console.log(`   Sample tested: ${testListings.length}`);
        console.log(`   Extraction successes: ${successCount}`);
        console.log(`   Extraction failures: ${failCount}`);
        console.log(`   Success rate: ${((successCount / testListings.length) * 100).toFixed(1)}%`);

        if (successCount > 0) {
            console.log('\\n   🎯 SOLUTION: The extraction and validation are working!');
            console.log('   💡 The issue might be in the scraper\\'s main processing loop.');
            console.log('   📝 Recommend adding debug logging to the main scrapeRentals method.');
        } else {
            console.log('\\n   ⚠️ ISSUE: Property extraction/validation is failing on real data.');
            console.log('   💡 This explains why no properties are being saved.');
        }

        console.log('\\n5. 🔍 Raw HTML Sample:');
        const firstListing = foundListings.first();
        const rawHtml = firstListing.html();
        console.log(`   First listing HTML (first 500 chars):`);
        console.log(`   ${rawHtml.substring(0, 500)}...`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    process.exit(0);
}

setTimeout(testRealRentalScraping, 1000);

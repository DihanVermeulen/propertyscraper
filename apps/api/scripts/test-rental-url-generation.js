const Property24Scraper = require('../scrapers/property24Scraper');

async function testRentalUrlGeneration() {
    console.log('🔍 Testing URL Generation for Rental Scraper...\n');

    // Test sale scraper URL generation
    console.log('📊 Sale Scraper URLs:');
    const saleScraper = new Property24Scraper('sale');
    const location = {
        city: 'Somerset West',
        province: 'Western Cape',
        country: 'South Africa',
        p24_id: '390'
    };
    
    const saleUrl = saleScraper.buildLocationUrl(location);
    console.log(`Primary Sale URL: ${saleUrl}`);
    console.log(`Alternative Sale URLs: ${saleScraper.possibleUrls.length} available`);
    saleScraper.possibleUrls.slice(0, 3).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
    });

    // Test rental scraper URL generation  
    console.log('\n🏠 Rental Scraper URLs:');
    const rentalScraper = new Property24Scraper('rent');
    
    const rentalUrl = rentalScraper.buildLocationUrl(location);
    console.log(`Primary Rental URL: ${rentalUrl}`);
    console.log(`Alternative Rental URLs: ${rentalScraper.possibleUrls.length} available`);
    rentalScraper.possibleUrls.slice(0, 3).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
    });

    // Test slug generation
    console.log('\n🔧 Slug Generation Test:');
    console.log(`"Somerset West" -> "${saleScraper.sanitizeSlug('Somerset West')}"`);
    console.log(`"Western Cape" -> "${saleScraper.sanitizeSlug('Western Cape')}"`);
    console.log(`"Cape Town" -> "${saleScraper.sanitizeSlug('Cape Town')}"`);

    // Test different location formats
    console.log('\n🌍 Different Location Tests:');
    
    const testLocations = [
        { city: 'Somerset West', province: 'Western Cape' },
        { city: 'Cape Town', province: 'Western Cape' },
        { city: 'Johannesburg', province: 'Gauteng' }
    ];

    testLocations.forEach(loc => {
        const citySlug = rentalScraper.sanitizeSlug(loc.city);
        const provinceSlug = rentalScraper.sanitizeSlug(loc.province);
        console.log(`${loc.city}, ${loc.province} -> city: ${citySlug}, province: ${provinceSlug}`);
    });

    console.log('\n✅ URL Generation Test Complete!');
    console.log('\n💡 Expected Rental URL Pattern:');
    console.log('https://www.property24.com/to-rent/somerset-west/western-cape/390');
    
    console.log('\n🔍 What to check:');
    console.log('1. Make sure "somerset-west" has the hyphen (not "somersetwest")');
    console.log('2. Verify the rental URL uses "to-rent" segment');
    console.log('3. Check that special case matching works with hyphens');
}

testRentalUrlGeneration();

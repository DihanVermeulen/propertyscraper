const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testRentalScraperNow() {
    try {
        console.log('🏠 Testing Rental Scraper with Fixed URLs...\n');

        const config = {
            location: {
                city: 'Somerset West',
                province: 'Western Cape',
                country: 'South Africa',
                p24_id: '390'
            },
            maxPages: 3 // Small test
        };

        console.log('📋 Starting rental scraper with config:');
        console.log(JSON.stringify(config, null, 2));
        
        console.log('\n🚀 Expected URL: https://www.property24.com/to-rent/somerset-west/western-cape/390');

        const response = await axios.post(`${API_BASE}/api/scraper/scrape-rentals/property24`, config);
        
        console.log('\n✅ Rental scraper started successfully!');
        console.log('📋 Response:');
        console.log(`  Status: ${response.data.status}`);
        console.log(`  Message: ${response.data.message}`);
        console.log(`  Job ID: ${response.data.jobId}`);
        console.log(`  Duration: ${response.data.estimatedDuration}`);
        
        console.log('\n💡 Monitor progress in:');
        console.log('1. Web scraper page: http://localhost:3000/scraper');
        console.log('2. API logs: Check scraper.log file');
        console.log('3. Database: Check rental_properties table after completion');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testRentalScraperNow();

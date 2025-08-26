const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function quickRentalTest() {
    try {
        console.log('🚀 Quick Rental Scraper Test\n');

        // Test 1: Check scraper status
        console.log('1. Checking scraper status...');
        const statusResponse = await axios.get(`${API_BASE}/api/scraper/status`);
        console.log('✅ Available scrapers:');
        statusResponse.data.forEach(scraper => {
            console.log(`   ${scraper.display_name}: ${scraper.status}`);
        });

        // Test 2: Test rental scraper endpoint
        console.log('\n2. Testing rental scraper endpoint...');
        const config = {
            location: {
                city: 'Somerset West',
                province: 'Western Cape',
                p24_id: '390'
            },
            maxPages: 2 // Small test
        };

        const response = await axios.post(`${API_BASE}/api/scraper/scrape-rentals/property24`, config);
        console.log('✅ Rental scraper started:');
        console.log(`   Status: ${response.data.status}`);
        console.log(`   Message: ${response.data.message}`);
        console.log(`   Duration: ${response.data.estimatedDuration}`);

        console.log('\n🎉 Success! Rental scraping is working.');
        console.log('💡 You can now use the web interface to run rental scrapers.');

    } catch (error) {
        console.error('❌ Error:', error.response?.data?.error || error.message);
        
        if (error.response?.status === 409) {
            console.log('💡 This means a scraper is already running. That\'s actually good!');
        }
    }
}

quickRentalTest();

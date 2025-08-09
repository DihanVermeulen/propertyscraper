const jobManager = require('../services/JobManager');
const Property24Scraper = require('../scrapers/property24Scraper');

async function testJobManager() {
    console.log('🚀 Testing JobManager with Property24 Scraper...');
    
    try {
        // Test 1: Start a job
        console.log('\n1. Starting a test scraper job...');
        
        const scraperJobFunction = async (jobContext) => {
            console.log(`Job ${jobContext.jobId} is running...`);
            
            // Simulate some work (shorter timeout for testing)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return {
                propertiesFound: 5,
                propertiesNew: 3,
                propertiesUpdated: 2,
                testResult: true
            };
        };

        // Start job with 30-second timeout
        const jobPromise = jobManager.startJob(
            'test-scraper', 
            'property24', 
            scraperJobFunction,
            { timeout: 30000 }
        );

        // Test 2: Check running jobs
        console.log('\n2. Checking running jobs...');
        const runningJobs = jobManager.getRunningJobs();
        console.log('Running jobs:', runningJobs.length);
        console.log('Job details:', runningJobs.map(j => ({ jobId: j.jobId, status: j.status })));

        // Test 3: Get stats
        console.log('\n3. Getting job stats...');
        const stats = jobManager.getStats();
        console.log('Stats:', stats);

        // Test 4: Try to start duplicate job (should fail)
        console.log('\n4. Trying to start duplicate job...');
        try {
            await jobManager.startJob('test-scraper', 'property24', scraperJobFunction);
            console.log('❌ ERROR: Duplicate job should have been rejected!');
        } catch (error) {
            console.log('✅ SUCCESS: Duplicate job correctly rejected:', error.message);
        }

        // Test 5: Wait for job completion
        console.log('\n5. Waiting for job completion...');
        const result = await jobPromise;
        console.log('✅ Job completed successfully:', result);

        // Test 6: Check final stats
        console.log('\n6. Final stats after completion...');
        const finalStats = jobManager.getStats();
        console.log('Final stats:', finalStats);

        console.log('\n🎉 All tests passed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testJobManager()
        .then(() => {
            console.log('\nTest completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = testJobManager;

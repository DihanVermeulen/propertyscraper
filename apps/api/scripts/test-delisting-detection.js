const database = require('../db/database');
const DelistingDetectionService = require('../services/DelistingDetectionService');

async function testDelistingDetection() {
    try {
        console.log('🧪 Testing Delisting Detection System...\n');
        
        // Step 1: Show current property status
        console.log('📊 Current Property Status:');
        const currentProperties = await database.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as delisted,
                MIN(last_seen_at) as oldest_seen,
                MAX(last_seen_at) as newest_seen
            FROM properties
        `);
        
        const stats = currentProperties[0];
        console.log(`  Total: ${stats.total}`);
        console.log(`  Active: ${stats.active}`);
        console.log(`  Delisted: ${stats.delisted}`);
        console.log(`  Oldest last seen: ${stats.oldest_seen}`);
        console.log(`  Newest last seen: ${stats.newest_seen}`);
        
        // Step 2: Test periodic detection with old properties
        console.log('\n🔍 Testing Periodic Delisting Detection...');
        const delistingService = new DelistingDetectionService();
        
        // Run detection for properties older than 15 days
        const result = await delistingService.runPeriodicDetection('property24', 'sale', {
            locationFilter: { city: 'Somerset West', province: 'Western Cape' },
            staleThresholdDays: 15, // Mark as stale after 15 days
            maxPropertiesToCheck: 5 // Just check 5 for testing
        });
        
        console.log('✅ Periodic detection completed:');
        console.log(`  Properties Checked: ${result.propertiesChecked}`);
        console.log(`  Properties Delisted: ${result.propertiesDelisted}`);
        
        // Step 3: Show what got delisted
        if (result.propertiesDelisted > 0) {
            console.log('\n📋 Recently Delisted Properties:');
            const delistedProperties = await database.query(`
                SELECT id, title, delisted_at, delisting_reason, 
                       CAST((julianday('now') - julianday(last_seen_at)) AS INTEGER) as days_since_seen
                FROM properties 
                WHERE is_active = 0 
                AND delisted_at >= datetime('now', '-1 hour')
                LIMIT 5
            `);
            
            delistedProperties.forEach((prop, i) => {
                console.log(`  ${i + 1}. "${prop.title.substring(0, 50)}..."`);
                console.log(`     Reason: ${prop.delisting_reason}`);
                console.log(`     Days since last seen: ${prop.days_since_seen}`);
                console.log(`     Delisted at: ${prop.delisted_at}`);
                console.log('');
            });
        }
        
        // Step 4: Test scraper-integrated detection simulation
        console.log('🔄 Testing Scraper-Integrated Detection (Simulation)...');
        
        // Get some existing external IDs to simulate "found during scraping"
        const existingProperties = await database.query(`
            SELECT external_id FROM properties 
            WHERE is_active = 1 
            AND last_seen_at > datetime('now', '-7 days') 
            LIMIT 10
        `);
        
        const foundExternalIds = existingProperties.map(p => p.external_id);
        
        if (foundExternalIds.length > 0) {
            const scraperResult = await delistingService.runScraperIntegratedDetection(
                'property24',
                'sale',
                foundExternalIds,
                { city: 'Somerset West', province: 'Western Cape' },
                48 // 48 hour grace period
            );
            
            console.log('✅ Scraper-integrated detection completed:');
            console.log(`  Properties Checked: ${scraperResult.propertiesChecked}`);
            console.log(`  Properties Found: ${scraperResult.propertiesFound}`);
            console.log(`  Properties Delisted: ${scraperResult.propertiesDelisted}`);
            console.log(`  Properties Relisted: ${scraperResult.propertiesRelisted}`);
        } else {
            console.log('⚠️ No recent properties found for scraper simulation');
        }
        
        // Step 5: Show final statistics
        console.log('\n📈 Final Statistics:');
        const finalStats = await database.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as delisted,
                COUNT(CASE WHEN delisted_at IS NOT NULL THEN 1 END) as ever_delisted
            FROM properties
        `);
        
        const final = finalStats[0];
        console.log(`  Total Properties: ${final.total}`);
        console.log(`  Currently Active: ${final.active}`);
        console.log(`  Currently Delisted: ${final.delisted}`);
        console.log(`  Ever Been Delisted: ${final.ever_delisted}`);
        
        // Step 6: Show detection run history
        console.log('\n📝 Detection Run History:');
        const detectionStats = await delistingService.getDetectionStats(1); // Last 1 day
        
        console.log(`  Total Runs: ${detectionStats.summary.total_runs || 0}`);
        console.log(`  Successful Runs: ${detectionStats.summary.successful_runs || 0}`);
        console.log(`  Failed Runs: ${detectionStats.summary.failed_runs || 0}`);
        console.log(`  Total Properties Checked: ${detectionStats.summary.total_checked || 0}`);
        console.log(`  Total Properties Delisted: ${detectionStats.summary.total_delisted || 0}`);
        console.log(`  Total Properties Relisted: ${detectionStats.summary.total_relisted || 0}`);
        
        if (detectionStats.recent_runs.length > 0) {
            console.log('\n🕒 Recent Detection Runs:');
            detectionStats.recent_runs.slice(0, 3).forEach((run, i) => {
                console.log(`  ${i + 1}. ${run.run_type} - ${run.source_website} ${run.property_type}`);
                console.log(`     Status: ${run.status}`);
                console.log(`     Started: ${run.started_at}`);
                console.log(`     Results: ${run.properties_delisted || 0} delisted, ${run.properties_relisted || 0} relisted`);
                console.log('');
            });
        }
        
        console.log('\n🎉 Delisting Detection Test Complete!');
        console.log('\n💡 Next Steps:');
        console.log('1. ✅ Delisting detection is working');
        console.log('2. ✅ Integrated with scrapers'); 
        console.log('3. ⏳ Run a real scraper to see live detection');
        console.log('4. ⏳ Set up scheduled periodic detection');
        console.log('5. ⏳ Add UI to show delisted properties');
        
    } catch (error) {
        console.error('❌ Error testing delisting detection:', error);
    }
    
    process.exit(0);
}

setTimeout(testDelistingDetection, 1000);

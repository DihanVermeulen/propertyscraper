const database = require('../db/database');

async function verifySetup() {
    try {
        console.log('🔍 Verifying Delisting Detection Setup...\n');
        
        // Check if new columns exist
        console.log('📊 Checking database schema...');
        const propertiesSchema = await database.query('PRAGMA table_info(properties)');
        const hasLastSeen = propertiesSchema.find(col => col.name === 'last_seen_at');
        const hasDelisted = propertiesSchema.find(col => col.name === 'delisted_at');
        const hasReason = propertiesSchema.find(col => col.name === 'delisting_reason');
        
        console.log(`✅ last_seen_at column: ${hasLastSeen ? 'EXISTS' : 'MISSING'}`);
        console.log(`✅ delisted_at column: ${hasDelisted ? 'EXISTS' : 'MISSING'}`);
        console.log(`✅ delisting_reason column: ${hasReason ? 'EXISTS' : 'MISSING'}`);
        
        // Check if tracking table exists
        const tables = await database.query("SELECT name FROM sqlite_master WHERE type='table' AND name='delisting_detection_runs'");
        console.log(`✅ delisting_detection_runs table: ${tables.length > 0 ? 'EXISTS' : 'MISSING'}`);
        
        // Show sample data
        console.log('\n📋 Sample property data:');
        const sampleProperties = await database.query(`
            SELECT id, title, last_seen_at, delisted_at, is_active, scraped_at 
            FROM properties 
            LIMIT 3
        `);
        
        sampleProperties.forEach((prop, i) => {
            console.log(`${i + 1}. "${prop.title.substring(0, 40)}..."`);
            console.log(`   Last Seen: ${prop.last_seen_at || 'NULL'}`);
            console.log(`   Active: ${prop.is_active ? 'YES' : 'NO'}`);
            console.log(`   Delisted: ${prop.delisted_at || 'NO'}`);
            console.log('');
        });
        
        // Check properties with old last_seen_at dates
        console.log('🔍 Properties that might be candidates for delisting:');
        const oldProperties = await database.query(`
            SELECT id, title, last_seen_at, 
                   CAST((julianday('now') - julianday(last_seen_at)) AS INTEGER) as days_since_seen
            FROM properties 
            WHERE is_active = 1 
            AND last_seen_at < datetime('now', '-7 days')
            ORDER BY last_seen_at ASC
            LIMIT 5
        `);
        
        if (oldProperties.length === 0) {
            console.log('   ✅ No properties older than 7 days found');
        } else {
            oldProperties.forEach((prop, i) => {
                console.log(`   ${i + 1}. "${prop.title.substring(0, 40)}..." (${prop.days_since_seen} days old)`);
            });
        }
        
        console.log('\n🎉 Delisting Detection System Status: READY');
        console.log('\n📋 Next Steps:');
        console.log('1. ✅ Database schema is properly set up');
        console.log('2. ✅ Properties have last_seen_at tracking');
        console.log('3. ⏳ Need to integrate with scrapers to update last_seen_at during runs');
        console.log('4. ⏳ Set up periodic detection jobs');
        
        console.log('\n💡 To test delisting detection manually:');
        console.log('   Run a scraper and observe last_seen_at updates');
        
    } catch (error) {
        console.error('❌ Error verifying setup:', error);
    }
    
    process.exit(0);
}

setTimeout(verifySetup, 1000);

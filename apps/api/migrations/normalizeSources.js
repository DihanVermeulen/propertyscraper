const database = require('../db/database');
const { normalizeSource } = require('../utils/sourceUtils');

/**
 * Migration to normalize source_website values in existing data
 */
async function migrateSources() {
    console.log('Starting source normalization migration...');
    
    try {
        // Update scrape_jobs table
        await database.run(`
            UPDATE scrape_jobs 
            SET source_website = CASE 
                WHEN source_website LIKE '%.com' OR source_website LIKE '%.co.za' 
                THEN REPLACE(REPLACE(source_website, '.com', ''), '.co.za', '')
                ELSE source_website
            END
            WHERE source_website LIKE '%.com' OR source_website LIKE '%.co.za'
        `);
        
        // Update properties table
        await database.run(`
            UPDATE properties 
            SET source_website = CASE 
                WHEN source_website LIKE '%.com' OR source_website LIKE '%.co.za' 
                THEN REPLACE(REPLACE(source_website, '.com', ''), '.co.za', '')
                ELSE source_website
            END
            WHERE source_website LIKE '%.com' OR source_website LIKE '%.co.za'
        `);
        
        console.log('✅ Source normalization migration completed successfully');
        
        // Verify the changes
        const scrapeJobSources = await database.query(`
            SELECT DISTINCT source_website, COUNT(*) as count 
            FROM scrape_jobs 
            GROUP BY source_website
        `);
        
        const propertySources = await database.query(`
            SELECT DISTINCT source_website, COUNT(*) as count 
            FROM properties 
            GROUP BY source_website
        `);
        
        console.log('📊 Scrape Jobs Sources:', scrapeJobSources);
        console.log('📊 Property Sources:', propertySources);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

/**
 * Rollback function to restore original domain names
 */
async function rollbackMigration() {
    console.log('Rolling back source normalization...');
    
    try {
        // Rollback scrape_jobs table
        await database.run(`
            UPDATE scrape_jobs 
            SET source_website = CASE 
                WHEN source_website = 'property24' THEN 'property24.com'
                WHEN source_website = 'privateproperty' THEN 'privateproperty.co.za'
                ELSE source_website
            END
            WHERE source_website IN ('property24', 'privateproperty')
        `);
        
        // Rollback properties table
        await database.run(`
            UPDATE properties 
            SET source_website = CASE 
                WHEN source_website = 'property24' THEN 'property24.com'
                WHEN source_website = 'privateproperty' THEN 'privateproperty.co.za'
                ELSE source_website
            END
            WHERE source_website IN ('property24', 'privateproperty')
        `);
        
        console.log('✅ Rollback completed successfully');
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        throw error;
    }
}

// Run migration if called directly
if (require.main === module) {
    const action = process.argv[2];
    
    if (action === 'rollback') {
        rollbackMigration()
            .then(() => {
                console.log('Migration rollback completed');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Migration rollback failed:', error);
                process.exit(1);
            });
    } else {
        migrateSources()
            .then(() => {
                console.log('Migration completed');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Migration failed:', error);
                process.exit(1);
            });
    }
}

module.exports = {
    migrateSources,
    rollbackMigration
};

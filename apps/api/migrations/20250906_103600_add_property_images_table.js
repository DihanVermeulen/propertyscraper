/**
 * Migration: Add Property Images Table
 * Created: 2025-09-06T10:36:00.000Z
 * 
 * This migration creates a separate table for property images
 * to allow multiple images per property with metadata
 */

/**
 * Run the migration
 * @param {Object} database - Database instance
 */
async function up(database) {
    console.log('🔄 Creating property images table...');
    
    // Create property_images table
    await database.run(`
        CREATE TABLE IF NOT EXISTS property_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            property_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            image_type TEXT DEFAULT 'photo',
            display_order INTEGER DEFAULT 0,
            alt_text TEXT,
            is_primary BOOLEAN DEFAULT FALSE,
            file_size INTEGER,
            width INTEGER,
            height INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
        )
    `);
    
    // Create indexes
    await database.run(`
        CREATE INDEX IF NOT EXISTS idx_property_images_property_id 
        ON property_images(property_id)
    `);
    
    await database.run(`
        CREATE INDEX IF NOT EXISTS idx_property_images_primary 
        ON property_images(property_id, is_primary)
    `);
    
    await database.run(`
        CREATE INDEX IF NOT EXISTS idx_property_images_order 
        ON property_images(property_id, display_order)
    `);
    
    console.log('✅ Property images table created successfully');
}

/**
 * Rollback the migration
 * @param {Object} database - Database instance
 */
async function down(database) {
    console.log('🔄 Dropping property images table...');
    
    // Drop indexes first
    await database.run('DROP INDEX IF EXISTS idx_property_images_property_id');
    await database.run('DROP INDEX IF EXISTS idx_property_images_primary');
    await database.run('DROP INDEX IF EXISTS idx_property_images_order');
    
    // Drop table
    await database.run('DROP TABLE IF EXISTS property_images');
    
    console.log('✅ Property images table dropped successfully');
}

module.exports = {
    up,
    down
};

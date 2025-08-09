/**
 * Utility functions for handling source website identifiers
 */

/**
 * Normalize source website identifier by removing domain suffixes
 * @param {string} source - Source identifier (e.g., 'property24.com', 'property24')
 * @returns {string} Normalized source (e.g., 'property24')
 */
function normalizeSource(source) {
    if (!source || typeof source !== 'string') {
        return source;
    }
    
    return source
        .replace(/\.com$/, '')
        .replace(/\.co\.za$/, '')
        .toLowerCase()
        .trim();
}

/**
 * Get the full domain for a normalized source
 * @param {string} normalizedSource - Normalized source (e.g., 'property24')
 * @returns {string} Full domain (e.g., 'property24.com')
 */
function getFullDomain(normalizedSource) {
    const domainMap = {
        'property24': 'property24.com',
        'privateproperty': 'privateproperty.co.za'
    };
    
    return domainMap[normalizedSource] || normalizedSource;
}

/**
 * Get the base URL for a normalized source
 * @param {string} normalizedSource - Normalized source (e.g., 'property24')
 * @returns {string} Base URL (e.g., 'https://www.property24.com')
 */
function getBaseUrl(normalizedSource) {
    const urlMap = {
        'property24': 'https://www.property24.com',
        'privateproperty': 'https://www.privateproperty.co.za'
    };
    
    return urlMap[normalizedSource] || null;
}

/**
 * Check if a source is valid/supported
 * @param {string} source - Source identifier
 * @returns {boolean} True if source is supported
 */
function isValidSource(source) {
    const normalizedSource = normalizeSource(source);
    const validSources = ['property24', 'privateproperty'];
    return validSources.includes(normalizedSource);
}

/**
 * Get all supported sources
 * @returns {Array} Array of supported source identifiers
 */
function getSupportedSources() {
    return ['property24', 'privateproperty'];
}

module.exports = {
    normalizeSource,
    getFullDomain,
    getBaseUrl,
    isValidSource,
    getSupportedSources
};

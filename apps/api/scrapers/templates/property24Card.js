/**
 * Property24 Regular Card Template
 * 
 * This template defines the selectors and extraction logic for regular Property24 property cards.
 * Update these selectors when Property24 changes their HTML structure.
 * 
 * Card Structure Example:
 * <div class="ExcerptsGalling js_resultTile p24_tileContainer" data-listing-number="116008491">
 *   <div class="p24_regularTile js_rollover_container js_resultTileClickable p24_tileHoverWrapper">
 *     <!-- Card content -->
 *   </div>
 * </div>
 */

module.exports = {
  // Card identification - updated for both regular cards and containers without p24_regularTile
  identifier: {
    containerClass: '.js_resultTile',
    cardClass: '.p24_regularTile',
    isRegularCard: (listing) => {
      // Check if it's a regular tile container (with or without p24_regularTile)
      const hasRegularTile = listing.find('.p24_regularTile').length > 0;
      const isResultTile = listing.hasClass('js_resultTile') || listing.hasClass('p24_tileContainer');
      const isNotSponsored = listing.find('.p24_proTile').length === 0;
      return isResultTile && isNotSponsored;
    }
  },

  // Data extraction selectors (in priority order)
  selectors: {
    // External ID extraction
    externalId: [
      '[data-listing-number]',  // Primary: data attribute on container
      'a[href]'                 // Fallback: extract from URL
    ],

    // Title extraction - based on actual regular card structure
    title: [
      '.p24_title',                    // Primary: title class in regular cards
      '.p24_content .p24_title',       // Alternative: title within content area
      'span[itemprop="name"]',         // Schema.org structured data
      '.p24_content span.p24_title',   // Specific content area title
      'a[title]',                      // Fallback: link title attribute
      '[itemprop="name"]'              // Generic schema fallback
    ],

    // Price extraction
    price: [
      '.p24_price',             // Primary: standard price selector
      '[itemprop="price"]',     // Schema.org price
      '.price'                  // Generic fallback
    ],

    // Description/excerpt - based on actual structure
    description: [
      '.p24_excerpt',                  // Primary: excerpt in regular cards
      'span.p24_excerpt',              // Specific span with excerpt
      'span[itemprop="description"]',  // Schema.org structured data
      '.p24_description',              // Alternative description
      '[itemprop="description"]'       // Generic schema fallback
    ],

    // Location extraction
    location: [
      '.p24_location',          // Primary: location class
      '.location'               // Generic fallback
    ],

    // Address extraction - based on actual structure
    address: [
      '.p24_address',                  // Primary: address class
      'span.p24_address',              // Specific span with address
      '.p24_content .p24_address'      // Address within content area
    ],

    // Property features (bedrooms, bathrooms, parking)
    bedrooms: [
      '.p24_featureDetails[title="Bedrooms"] span:last-child',
      '.p24_icons .p24_featureDetails[title="Bedrooms"] span:last-child',
      '[title="Bedrooms"] span'
    ],

    bathrooms: [
      '.p24_featureDetails[title="Bathrooms"] span:last-child',
      '.p24_icons .p24_featureDetails[title="Bathrooms"] span:last-child',
      '[title="Bathrooms"] span'
    ],

    parking: [
      '.p24_featureDetails[title="Parking Spaces"] span:last-child',
      '.p24_featureDetails[title="Parking"] span:last-child',
      '.p24_icons .p24_featureDetails[title="Parking Spaces"] span:last-child',
      '[title="Parking"] span'
    ],

    // Floor/Erf size - based on actual HTML structure
    floorSize: [
      '.p24_size[title="Floor Size"] span:last-child', // Floor size for commercial
      '.p24_size[title="Erf Size"] span:last-child',   // Erf size for residential
      '.p24_icons .p24_size span:last-child',          // Size within icons section
      '.p24_size span:last-child',                     // Generic size span
      '.p24_erfSize',                                   // Specific erf class
      '.p24_floorSize'                                  // Specific floor class
    ],

    // Source URL (property link)
    sourceUrl: [
      'a[href*="/for-sale/"]',  // Sale properties
      'a[href*="/to-rent/"]',   // Rental properties
      '.p24_content a',         // Main content link
      'a[href]'                 // Generic link fallback
    ],

    // Images
    images: [
      'img[src]',               // All images with src
      'img[data-src]'           // Lazy-loaded images
    ],

    // Agent information
    agent: [
      '.p24_agent',
      '.agent-name',
      '.listing-agent'
    ],

    // Listing date
    listingDate: [
      '.p24_listingDate',
      '.listing-date',
      '.date-listed',
      '.p24_dateAdded'
    ]
  },

  // Data transformation functions
  transformers: {
    // Extract numeric value from price text
    price: (priceText) => {
      if (!priceText) return null;
      const cleanPrice = priceText
        .replace(/[^0-9\s]/g, '')  // Remove all non-numeric except spaces
        .replace(/\s+/g, '')       // Remove spaces
        .trim();
      return parseFloat(cleanPrice) || null;
    },

    // Extract numeric value from feature text (bedrooms, bathrooms, etc.)
    numericFeature: (text) => {
      if (!text) return null;
      const numText = text.trim();
      // Handle decimal values for bathrooms (e.g., "2.5")
      return parseFloat(numText) || null;
    },

    // Extract floor size with unit conversion
    floorSize: (sizeText) => {
      if (!sizeText) return null;
      // Extract numeric value from text like "361 m²" or "361 m2" or "361m²"
      const sizeMatch = sizeText.match(/([0-9,\s]+)\s*m[²2]/i);
      if (sizeMatch && sizeMatch[1]) {
        const sizeValue = sizeMatch[1].replace(/[,\s]/g, ''); // Remove commas and spaces
        return parseInt(sizeValue) || null;
      }
      return null;
    },

    // Clean and format URLs
    url: (href, baseUrl) => {
      if (!href) return null;
      try {
        // Resolve relative URLs and preserve the query string
        const u = new URL(href, baseUrl);
        return u.toString();
      } catch {
        // Fallback: leave as-is if URL constructor fails
        return href.startsWith('http') ? href : (baseUrl || '') + href;
      }
    },

    // Extract external ID from URL if needed
    externalIdFromUrl: (href) => {
      if (!href) return null;
      const match = href.match(/\/(\d+)(?:\?|$)/);
      return match ? match[1] : null;
    },

    // Parse date from various formats
    date: (dateText) => {
      if (!dateText) return new Date().toISOString().split('T')[0]; // Default to today
      
      // Try to match various date formats
      const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})|(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (dateMatch) {
        if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
          // DD/MM/YYYY or MM/DD/YYYY format
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3];
          return `${year}-${month}-${day}`;
        } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) {
          // YYYY/MM/DD format
          const year = dateMatch[4];
          const month = dateMatch[5].padStart(2, '0');
          const day = dateMatch[6].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      return new Date().toISOString().split('T')[0];
    }
  },

  // Property type detection based on text content
  propertyTypeDetection: {
    house: ['house', 'home'],
    apartment: ['apartment', 'flat', 'unit'],
    townhouse: ['townhouse', 'town house'],
    'vacant land': ['vacant land', 'plot', 'stand', 'land'],
    commercial: ['commercial', 'office', 'retail', 'warehouse', 'industrial']
  }
};

/**
 * Property24 Sponsored Card Template
 * 
 * This template defines the selectors and extraction logic for sponsored Property24 property cards.
 * Update these selectors when Property24 changes their HTML structure.
 * 
 * Card Structure Example:
 * <div class="p24_tileContainer js_resultTile BeaconsSpinoffs" data-listing-number="116111923">
 *   <div class="p24_proTile p24_tileHoverWrapper js_resultTileClickable js_rollover_container BeaconsSpinoffs">
 *     <!-- Card content -->
 *   </div>
 * </div>
 */

module.exports = {
  // Card identification
  identifier: {
    containerClass: '.js_resultTile',
    cardClass: '.p24_proTile',
    isSponsoredCard: (listing) => {
      // Check if it contains the sponsored card elements
      const hasProTile = listing.find('.p24_proTile').length > 0;
      const hasBeaconsClass = listing.hasClass('BeaconsSpinoffs');
      const hasBrandingHeader = listing.find('.p24_brandingHeader').length > 0;
      return hasProTile || hasBeaconsClass || hasBrandingHeader;
    }
  },

  // Data extraction selectors (in priority order)
  selectors: {
    // External ID extraction
    externalId: [
      '[data-listing-number]',  // Primary: data attribute on container
      'a[href]'                 // Fallback: extract from URL
    ],

    // Title extraction - sponsored cards have title in title attribute or description area
    title: [
      '.p24_proTile[title]',               // Primary: title attribute on sponsored card container
      '.p24_information .p24_description', // Alternative: description area
      '.p24_description',                  // Fallback: description class
      '.p24_content .p24_information .p24_description', // Full path to description
      'a[title]'                           // Link title attribute
    ],

    // Price extraction (different structure in sponsored cards)
    price: [
      '.p24_information .p24_price',  // Primary: price within information section
      '.p24_content .p24_price',      // Alternative: price in content area
      '.p24_price',                   // Generic price selector
      '[itemprop="price"]'            // Schema.org price
    ],

    // Description extraction
    description: [
      '.p24_information .p24_description', // Primary: description in information area
      '.p24_description',                  // Generic description
      '[itemprop="description"]'           // Schema.org description
    ],

    // Location extraction (different structure in sponsored cards)
    location: [
      '.p24_information .p24_location',    // Primary: location within information section
      '.p24_description .p24_location',    // Alternative: location in description
      'span.p24_location',                 // Specific span with location
      '.p24_location',                     // Generic location selector
      '.location'                          // Fallback
    ],

    // Address extraction
    address: [
      '.p24_address',
      '.address'
    ],

    // Property features (bedrooms, bathrooms, parking) - sponsored cards use .p24_featureDetails
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

    // Floor/Erf size
    floorSize: [
      '.p24_size[title="Erf Size"] span:last-child',
      '.p24_size[title="Floor Size"] span:last-child',
      '.p24_icons .p24_size span',
      '.p24_size span',
      '.p24_erfSize',
      '.p24_floorSize'
    ],

    // Source URL (property link) - sponsored cards have different link structure
    sourceUrl: [
      'a[href*="/for-sale/"]:first',        // First sale link found (most likely main link)
      'a[href*="/to-rent/"]:first',         // First rental link found
      '.p24_proTile a[href*="/for-sale/"]', // Sale properties in sponsored cards
      '.p24_proTile a[href*="/to-rent/"]',  // Rental properties in sponsored cards
      'a[href]'                             // Any link fallback
    ],

    // Images (sponsored cards have multiple image elements)
    images: [
      '.p24_promoImage img[src]',     // Main promotional image
      '.p24_promoThumbnails img[src]', // Thumbnail images
      'img[src]',                     // All images with src
      'img[data-src]'                 // Lazy-loaded images
    ],

    // Agent information (sponsored cards may have branding header)
    agent: [
      '.p24_brandingHeader img[alt]', // Agent branding in header
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

  // Data transformation functions (same as regular cards but with specific logic for sponsored cards)
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
      // Extract numeric value from text like "1 700 m²" or "1700 m2"
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

    // Extract title from title attribute (common in sponsored cards)
    titleFromAttribute: (element) => {
      if (!element) return null;
      return element.attr('title') || element.text().trim();
    },

    // Parse date from various formats
    date: (dateText) => {
      if (!dateText) return new Date().toISOString().split('T')[0];
      
      const dateMatch = dateText.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})|(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (dateMatch) {
        if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3];
          return `${year}-${month}-${day}`;
        } else if (dateMatch[4] && dateMatch[5] && dateMatch[6]) {
          const year = dateMatch[4];
          const month = dateMatch[5].padStart(2, '0');
          const day = dateMatch[6].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      return new Date().toISOString().split('T')[0];
    },

    // Extract agent name from branded header
    agentFromBranding: (element) => {
      if (!element) return null;
      const altText = element.attr('alt');
      if (altText) {
        // Remove common suffixes from agency names
        return altText.replace(/\s*(estate\s*agent|properties|realty)\s*$/i, '').trim();
      }
      return null;
    }
  },

  // Property type detection based on text content
  propertyTypeDetection: {
    house: ['house', 'home', 'bedroom house'],
    apartment: ['apartment', 'flat', 'unit'],
    townhouse: ['townhouse', 'town house'],
    'vacant land': ['vacant land', 'plot', 'stand', 'land'],
    commercial: ['commercial', 'office', 'retail', 'warehouse', 'industrial']
  }
};

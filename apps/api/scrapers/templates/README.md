# Property24 Template-Based Scraper

This directory contains the template-based extraction system for Property24.com properties. The system is designed to handle both **regular cards** and **sponsored cards** that appear on Property24 search results pages.

## Overview

Property24 displays properties in two main card formats:

1. **Regular Cards** (`ExcerptsGalling js_resultTile p24_tileContainer`) - Standard property listings
2. **Sponsored Cards** (`p24_tileContainer js_resultTile BeaconsSpinoffs`) - Premium/promoted listings with enhanced branding

The template system automatically detects the card type and applies the appropriate extraction logic.

## Files Structure

```
templates/
├── README.md                    # This documentation
├── property24Card.js            # Regular card template and selectors
├── property24SponsoredCard.js   # Sponsored card template and selectors
├── property24Extractor.js       # Main extraction engine
└── debug_property24_extractor.js # Testing and debugging tool
```

## Card Templates

### Regular Card Template (`property24Card.js`)

Handles standard property listings with the following HTML structure:

```html
<div class="ExcerptsGalling js_resultTile p24_tileContainer" data-listing-number="116008491">
    <div class="p24_regularTile js_rollover_container js_resultTileClickable p24_tileHoverWrapper">
        <!-- Title, price, location, features -->
    </div>
</div>
```

**Key Selectors:**
- **Title**: `.p24_title`, `span[itemprop="name"]`
- **Price**: `.p24_price`, `[itemprop="price"]`
- **Location**: `.p24_location`
- **Description**: `.p24_excerpt`, `span[itemprop="description"]`
- **Features**: `.p24_featureDetails[title="Bedrooms|Bathrooms|Parking Spaces"]`
- **Floor Size**: `.p24_size[title="Floor Size|Erf Size"] span:last-child`

### Sponsored Card Template (`property24SponsoredCard.js`)

Handles premium listings with branding headers and enhanced visuals:

```html
<div class="p24_tileContainer js_resultTile BeaconsSpinoffs" data-listing-number="116111923">
    <div class="p24_proTile p24_tileHoverWrapper js_resultTileClickable">
        <div class="p24_brandingHeader"><!-- Agent branding --></div>
        <div class="p24_promoImage"><!-- Featured images --></div>
        <div class="p24_content">
            <div class="p24_information"><!-- Price, description --></div>
            <div class="p24_icons"><!-- Property features --></div>
        </div>
    </div>
</div>
```

**Key Selectors:**
- **Title**: `.p24_proTile[title]`, `.p24_information .p24_description`
- **Price**: `.p24_information .p24_price`
- **Location**: `.p24_information .p24_location`, `span.p24_location`
- **Features**: `.p24_featureDetails[title="Bedrooms|Bathrooms|Parking Spaces"]`
- **Agent**: `.p24_brandingHeader img[alt]`

## Property24Extractor (`property24Extractor.js`)

The main extraction engine that:

1. **Detects Card Type**: Automatically identifies regular vs sponsored cards
2. **Applies Templates**: Uses appropriate template based on card type
3. **Extracts Data**: Retrieves all property information using template selectors
4. **Handles Rentals**: Includes rental-specific fields (deposit, furnished status, etc.)
5. **Transforms Data**: Cleans and formats extracted values

### Usage Example

```javascript
const Property24Extractor = require('./templates/property24Extractor');

const extractor = new Property24Extractor('https://www.property24.com');
const location = { city: 'Somerset West', province: 'Western Cape', p24_id: '390' };

// Extract property data from a listing element
const property = extractor.extractPropertyData($, listing, location, 'sale');
```

### Extracted Fields

#### Common Fields (Sale & Rental)
- `external_id` - Property24 listing ID
- `title` - Property title/name
- `description` - Property description
- `property_type` - house, apartment, townhouse, etc.
- `bedrooms` - Number of bedrooms
- `bathrooms` - Number of bathrooms (supports decimals like 2.5)
- `parking_spaces` - Number of parking spaces
- `floor_area` - Floor/erf size in m²
- `location_*` - Address and location details
- `source_url` - Link to full property listing
- `images[]` - Array of property image URLs
- `agent_name` - Estate agent name
- `listing_date` - Date property was listed

#### Sale Properties
- `price` - Sale price in ZAR
- `price_currency` - "ZAR"

#### Rental Properties
- `rental_price` - Monthly rental price
- `rental_period` - "monthly", "weekly", or "daily"
- `deposit` - Security deposit amount
- `furnished_status` - "furnished", "unfurnished", "semi-furnished"
- `utilities_included[]` - Array of included utilities
- `pet_policy` - "allowed", "not_allowed", "cats_only", "dogs_only"
- `available_date` - Date property becomes available

## Card Type Detection

The system uses intelligent detection to identify card types:

### Regular Card Detection
- Has `js_resultTile` or `p24_tileContainer` class
- Does NOT contain `.p24_proTile` elements
- May or may not have `.p24_regularTile`

### Sponsored Card Detection  
- Contains `.p24_proTile` elements
- Has `BeaconsSpinoffs` class
- Contains `.p24_brandingHeader` (agent branding)

## Data Transformers

Templates include transformation functions for:

- **Price**: Extracts numeric values from formatted text ("R 4 980 000" → 4980000)
- **Features**: Converts text to numbers ("6" → 6, "4.5" → 4.5)
- **Floor Size**: Extracts area from text ("332 m²" → 332)
- **URLs**: Converts relative URLs to absolute URLs
- **Dates**: Normalizes date formats to ISO format
- **External ID**: Extracts property ID from data attributes or URLs

## Developer Usage

### Integration with Property24Scraper

The main scraper now uses the template system:

```javascript
// In property24Scraper.js constructor:
this.extractor = new Property24Extractor(this.baseUrl);

// During property extraction:
const property = this.extractor.extractPropertyData($, listing, location, this.listingType);
```

### Testing and Debugging

Use the debug script to test extraction:

```bash
node debug_property24_extractor.js
```

This will test both regular and sponsored card extraction using sample HTML.

### Customizing Templates

To modify extraction logic:

1. **Update Selectors**: Edit the `selectors` object in template files
2. **Add Transformers**: Create new transformation functions
3. **Modify Detection**: Update `isRegularCard` or `isSponsoredCard` functions
4. **Test Changes**: Run debug script to verify extraction

### Example Selector Priority

Templates use selector arrays in priority order:

```javascript
title: [
  '.p24_title',                    // Primary: most reliable selector
  '.p24_content .p24_title',       // Secondary: alternative location
  'span[itemprop="name"]',         // Tertiary: schema.org fallback
  '[itemprop="name"]'              // Final: generic fallback
]
```

## Error Handling

The system includes robust error handling:

- **Graceful Degradation**: If primary selectors fail, tries alternatives
- **Logging**: Detailed logging for debugging extraction issues  
- **Fallback Values**: Generates fallback IDs when extraction fails
- **Validation**: Validates extracted data before returning

## Benefits of Template System

1. **Maintainable**: Easy to update selectors when Property24 changes HTML
2. **Flexible**: Handles multiple card types automatically
3. **Extensible**: Easy to add new card types or fields
4. **Testable**: Isolated templates can be tested independently
5. **Documented**: Clear separation of extraction logic from scraping logic

## Troubleshooting

### Properties Being Skipped

1. Check if card type detection is working:
   ```javascript
   const cardInfo = extractor.detectCardType(listing);
   console.log('Card type:', cardInfo.type);
   ```

2. Verify selectors are finding elements:
   ```javascript
   console.log('Title found:', listing.find('.p24_title').length > 0);
   ```

3. Run the debug script to test with known HTML structures

### Missing Data Fields

1. Check if selectors match current Property24 HTML structure
2. Update template selectors if Property24 has changed their markup
3. Add new selectors to the priority array for better coverage

### Performance Issues

The template system is designed for efficiency:
- Selector priority reduces DOM queries
- Early termination when data is found
- Selective field extraction based on property type

## Future Enhancements

Potential improvements:
- Machine learning for dynamic selector adaptation
- Visual element detection for image-based extraction
- A/B testing for selector effectiveness
- Automatic template updates from live site analysis

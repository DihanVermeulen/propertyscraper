/**
 * Debug script to test Property24 templates and extraction logic
 * This helps identify why properties might be getting skipped
 */

const cheerio = require('cheerio');
const Property24Extractor = require('./property24Extractor');

// Sample HTML for testing - Regular Card
const regularCardHTML = `
<div class="ExcerptsGalling js_resultTile p24_tileContainer" data-listing-number="116008491">
    <div class="p24_regularTile js_rollover_container js_resultTileClickable p24_tileHoverWrapper" itemscope="" itemtype="http://schema.org/Product" data-listing-number="116008491">
        <meta itemprop="name" content="Commercial Property">
        <div class="" title="Commercial property for sale in Somerset West Central - Somerset West">
            <span class="js_listingTileImageHolder p24_image">
                <a href="/for-sale/somerset-west-central/somerset-west/western-cape/9019/116008491">
                    <img width="318" height="212" alt="Property image" title="Commercial property for sale" itemprop="image" class="js_rollover_target js_rollover_default js_P24_listingImage js_lazyLoadImage" src="https://images.prop24.com/357767685/Crop600x400">
                </a>
            </span>
            <a href="/for-sale/somerset-west-central/somerset-west/western-cape/9019/116008491" class="p24_content ">
                <span itemprop="offers" itemscope="" itemtype="http://schema.org/Offer">
                    <span class="p24_price" itemprop="price" content="4980000">
                        <meta itemprop="priceCurrency" content="ZAR">
                        R 4 980 000
                    </span>
                    <span class="p24_title " itemprop="name">Commercial Property</span>
                    <span class="p24_location ">Somerset West Central</span>
                    <span class="p24_address">2 and 4 Melcksloot Centre, 2 De Beers Drive</span>
                    <span class="p24_excerpt" itemprop="description" title="Commercial property for sale in Somerset West Central - Somerset West">
                        Now available for sale, this prime 332m2 showroom and workshop unit offers an excellent opportunity...
                    </span>
                </span>
                <span class="clearfix"></span>
                <span class="p24_icons">
                    <span class="p24_size" title="Floor Size">
                        <img src="/Content/images/Optimized/Icons/icon_floor_new.svg" alt="Floor Size" class="p24_sizeIcon">
                        <span>332 m²</span>
                    </span>
                </span>
            </a>
        </div>
    </div>
</div>
`;

// Sample HTML for testing - Sponsored Card
const sponsoredCardHTML = `
<div class="p24_tileContainer js_resultTile BeaconsSpinoffs" data-listing-number="116111923">
    <div class="p24_proTile p24_tileHoverWrapper js_resultTileClickable js_rollover_container BeaconsSpinoffs" title="6 Bedroom House for sale in Spanish Farm" itemscope="" itemtype="http://schema.org/Product" data-listing-number="116111923">
        <a href="/for-sale/spanish-farm/somerset-west/western-cape/9004/116111923">
            <div class="p24_brandingHeader" style="background-color:#1c2959">
                <div class="p24_imageContainer"><img src="https://images.prop24.com/242461179/Ensure528x153" class="img-responsive"></div>
            </div>
            <div class="p24_promoImage">
                <img alt="6 Bedroom House for sale" title="6 Bedroom House for sale in Spanish Farm - Somerset West" itemprop="image" class="js_rollover_target js_rollover_default js_P24_listingImage p24_featImage js_lazyLoadImage" src="https://images.prop24.com/359489106/Crop526x328" style="opacity: 1;">
            </div>
        </a>
        <a href="/for-sale/spanish-farm/somerset-west/western-cape/9004/116111923">
            <div class="p24_content">
                <div class="p24_information">
                    <div class="p24_price">
                        R 19 450 000
                    </div>
                    <div class="p24_description">6 Bedroom House in <span class="p24_location">Spanish Farm</span></div>
                </div>
                <div class="p24_icons">
                    <span class="p24_featureDetails" title="Bedrooms">
                        <svg width="20" height="20">
                            <image xlink:href="/Content/images/Optimized/Icons/icon_bed_new.svg" src="/Content/images/Optimized/Icons/icon_bed_new.svg" alt="Bedrooms" width="20" height="20"></image>
                        </svg>
                        <span>6</span>
                    </span>
                    <span class="p24_featureDetails" title="Bathrooms">
                        <svg class="p24_bathroomIcon" width="20" height="20">
                            <image xlink:href="/Content/images/Optimized/Icons/icon_bath_new.svg" src="/Content/images/Optimized/Icons/icon_bath_new.svg" alt="Bathrooms" width="20" height="20"></image>
                        </svg>
                        <span>4.5</span>
                    </span>
                    <span class="p24_featureDetails" title="Parking Spaces">
                        <svg class="p24_garageIcon" width="20" height="20">
                            <image xlink:href="/Content/images/Optimized/Icons/icon_parking.svg" src="/Content/images/Optimized/Icons/icon_parking.svg" alt="Parking Spaces" width="20" height="20"></image>
                        </svg>
                        <span>5</span>
                    </span>
                    <span class="p24_size" title="Erf Size">
                        <img src="/Content/images/Optimized/Icons/icon_erf_new.svg" alt="Erf Size" class="p24_sizeIcon">
                        <span>1 700 m²</span>
                    </span>
                </div>
            </div>
        </a>
    </div>
</div>
`;

function testExtraction() {
    console.log('=== Testing Property24 Extractor Templates ===\n');
    
    const extractor = new Property24Extractor('https://www.property24.com');
    const location = {
        city: 'Somerset West',
        province: 'Western Cape',
        p24_id: '390'
    };

    // Test regular card
    console.log('--- Testing Regular Card ---');
    const $regular = cheerio.load(regularCardHTML);
    const regularListing = $regular('.js_resultTile').first();
    console.log(`Regular listing found: ${regularListing.length > 0}`);
    console.log(`Regular listing classes: ${regularListing.attr('class')}`);
    
    const regularProperty = extractor.extractPropertyData($regular, regularListing, location, 'sale');
    console.log('Regular card extraction result:', JSON.stringify(regularProperty, null, 2));
    console.log('');

    // Test sponsored card
    console.log('--- Testing Sponsored Card ---');
    const $sponsored = cheerio.load(sponsoredCardHTML);
    const sponsoredListing = $sponsored('.js_resultTile').first();
    console.log(`Sponsored listing found: ${sponsoredListing.length > 0}`);
    console.log(`Sponsored listing classes: ${sponsoredListing.attr('class')}`);
    
    const sponsoredProperty = extractor.extractPropertyData($sponsored, sponsoredListing, location, 'sale');
    console.log('Sponsored card extraction result:', JSON.stringify(sponsoredProperty, null, 2));
    console.log('');

    // Test card type detection
    console.log('--- Testing Card Type Detection ---');
    const regularCardInfo = extractor.detectCardType(regularListing);
    const sponsoredCardInfo = extractor.detectCardType(sponsoredListing);
    
    console.log(`Regular card type: ${regularCardInfo.type}`);
    console.log(`Sponsored card type: ${sponsoredCardInfo.type}`);
    
    console.log('\n=== Test Complete ===');
}

// Run the test
if (require.main === module) {
    testExtraction();
}

module.exports = testExtraction;

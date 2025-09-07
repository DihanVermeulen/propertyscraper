/**
 * Property24 Template-Based Data Extractor
 *
 * This utility uses the card templates to extract property data from Property24 listings.
 * It automatically detects the card type and applies the appropriate extraction logic.
 */

const regularCardTemplate = require("./property24Card");
const sponsoredCardTemplate = require("./property24SponsoredCard");

class Property24Extractor {
  constructor(baseUrl = "https://www.property24.com") {
    this.baseUrl = baseUrl;
    this.regularTemplate = regularCardTemplate;
    this.sponsoredTemplate = sponsoredCardTemplate;
  }

  /**
   * Detect the type of Property24 card and return appropriate template
   * @param {Object} listing - Cheerio listing element
   * @returns {Object} Template object for the detected card type
   */
  detectCardType(listing) {
    // Check for sponsored card first (p24_proTile)
    if (this.sponsoredTemplate.identifier.isSponsoredCard(listing)) {
      return {
        type: "sponsored",
        template: this.sponsoredTemplate,
      };
    }

    // Check for regular card (p24_regularTile)
    if (this.regularTemplate.identifier.isRegularCard(listing)) {
      return {
        type: "regular",
        template: this.regularTemplate,
      };
    }

    // Default to regular card template as fallback
    return {
      type: "unknown",
      template: this.regularTemplate,
    };
  }

  /**
   * Extract data from a listing using the appropriate template
   * @param {Object} $ - Cheerio instance
   * @param {Object} listing - Cheerio listing element
   * @param {Object} location - Location context (city, province, etc.)
   * @param {String} listingType - 'sale' or 'rent'
   * @returns {Object} Extracted property data
   */
  extractPropertyData($, listing, location = null, listingType = "sale") {
    const cardInfo = this.detectCardType(listing);
    const template = cardInfo.template;

    console.log(`Detected card type: ${cardInfo.type}`);

    // Initialize property object
    const property = {
      source_website: "property24",
      card_type: cardInfo.type,
      external_id: null,
      title: null,
      description: null,
      price: listingType === "sale" ? null : null,
      rental_price: listingType === "rent" ? null : null,
      rental_period: listingType === "rent" ? "monthly" : null,
      deposit: listingType === "rent" ? null : null,
      furnished_status: listingType === "rent" ? null : null,
      utilities_included: listingType === "rent" ? [] : null,
      pet_policy: listingType === "rent" ? null : null,
      available_date: listingType === "rent" ? null : null,
      price_currency: "ZAR",
      property_type: null,
      bedrooms: null,
      bathrooms: null,
      parking_spaces: null,
      floor_area: null,
      erf_size: null,
      location_province: location ? location.province : null,
      location_city: location ? location.city : null,
      location_suburb: null,
      location_address: null,
      source_url: null,
      images: [],
      features: [],
      agent_name: null,
      agent_phone: null,
      listing_date: null,
      p24_id: location ? location.p24_id : null,
    };

    try {
      // Extract external ID - first try data attribute from container
      property.external_id =
        listing.attr("data-listing-number") ||
        listing
          .find("[data-listing-number]")
          .first()
          .attr("data-listing-number");

      // If not found, try URL-based extraction
      if (!property.external_id) {
        property.source_url = this.extractWithTemplate(
          $,
          listing,
          template.selectors.sourceUrl,
          "href"
        );
        if (property.source_url) {
          property.external_id = template.transformers.externalIdFromUrl(
            property.source_url
          );
        }
      }

      // Generate fallback ID if still not found
      if (!property.external_id) {
        property.external_id = `p24_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Extract title
      if (cardInfo.type === "sponsored") {
        // For sponsored cards, check title attribute first
        const titleElement = listing.find(template.selectors.title[0]);
        if (titleElement.length > 0) {
          property.title =
            template.transformers.titleFromAttribute(titleElement);
        }
      }
      if (!property.title) {
        property.title = this.extractWithTemplate(
          $,
          listing,
          template.selectors.title,
          "text"
        );
      }

      // Extract source URL (only if not already extracted)
      if (!property.source_url) {
        property.source_url = this.extractWithTemplate(
          $,
          listing,
          template.selectors.sourceUrl,
          "href"
        );
        if (property.source_url) {
          property.source_url = template.transformers.url(
            property.source_url,
            this.baseUrl
          );
        }
      }

      // Extract price
      const priceText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.price,
        "text"
      );
      if (listingType === "rent") {
        property.rental_price = template.transformers.price(priceText);
      } else {
        property.price = template.transformers.price(priceText);
      }

      // Extract description
      property.description = this.extractWithTemplate(
        $,
        listing,
        template.selectors.description,
        "text"
      );

      // Extract location
      const locationText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.location,
        "text"
      );
      if (locationText) {
        property.location_suburb = locationText;
      }

      // Extract address
      property.location_address = this.extractWithTemplate(
        $,
        listing,
        template.selectors.address,
        "text"
      );

      // Extract property features
      const bedroomText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.bedrooms,
        "text"
      );
      property.bedrooms = template.transformers.numericFeature(bedroomText);

      const bathroomText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.bathrooms,
        "text"
      );
      property.bathrooms = template.transformers.numericFeature(bathroomText);

      const parkingText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.parking,
        "text"
      );
      property.parking_spaces =
        template.transformers.numericFeature(parkingText);

      // Extract floor size
      const floorSizeText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.floorSize,
        "text"
      );
      property.floor_area = template.transformers.floorSize(floorSizeText);

      // Determine property type
      const fullText = listing.text().toLowerCase();
      property.property_type = this.detectPropertyType(
        fullText,
        template.propertyTypeDetection
      );

      // Extract agent information
      if (cardInfo.type === "sponsored") {
        const agentElement = listing.find(template.selectors.agent[0]);
        if (agentElement.length > 0) {
          property.agent_name =
            template.transformers.agentFromBranding(agentElement);
        }
      }
      if (!property.agent_name) {
        property.agent_name = this.extractWithTemplate(
          $,
          listing,
          template.selectors.agent,
          "text"
        );
      }

      // Extract listing date
      const dateText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.listingDate,
        "text"
      );
      property.listing_date = template.transformers.date(dateText);

      // Extract images
      property.images = this.extractImages(
        $,
        listing,
        template.selectors.images
      );

      // Extract rental-specific fields if this is a rental property
      if (listingType === "rent") {
        this.extractRentalSpecificFields($, listing, property, template);
      }
    } catch (error) {
      console.error(
        `Error extracting ${cardInfo.type} card data:`,
        error.message
      );
      console.error("Stack trace:", error.stack);
    }

    console.log(
      `Extracted property: ID=${property.external_id}, Title="${property.title}", Type=${cardInfo.type}, Price=${property.price || property.rental_price}`
    );

    return property;
  }

  /**
   * Extract data using template selectors
   * @param {Object} $ - Cheerio instance
   * @param {Object} listing - Cheerio listing element
   * @param {Array} selectors - Array of selectors to try
   * @param {String} extractionType - 'text', 'href', 'attr'
   * @param {String} attrName - Attribute name if extractionType is 'attr'
   * @returns {String|null} Extracted value
   */
  extractWithTemplate(
    $,
    listing,
    selectors,
    extractionType = "text",
    attrName = null
  ) {
    for (const selector of selectors) {
      const element = listing.find(selector).first();
      if (element.length > 0) {
        let value = null;

        switch (extractionType) {
          case "text":
            value = element.text().trim();
            break;
          case "href":
            value = element.attr("href");
            break;
          case "attr":
            value = element.attr(attrName);
            break;
          default:
            value = element.text().trim();
        }

        if (value) {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Detect property type based on text content
   * @param {String} text - Full text content of the listing
   * @param {Object} typeMap - Property type detection mapping
   * @returns {String|null} Detected property type
   */
  detectPropertyType(text, typeMap) {
    for (const [type, keywords] of Object.entries(typeMap)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return type;
        }
      }
    }
    return null;
  }

  /**
   * Extract rental-specific fields from listing
   * @param {Object} $ - Cheerio instance
   * @param {Object} listing - Cheerio listing element
   * @param {Object} property - Property object to populate
   * @param {Object} template - Template with selectors
   */
  extractRentalSpecificFields($, listing, property, template) {
    try {
      const detailsText = listing.text().toLowerCase();

      // Furnished status detection
      if (detailsText.includes("furnished")) {
        if (detailsText.includes("unfurnished")) {
          property.furnished_status = "unfurnished";
        } else if (
          detailsText.includes("semi-furnished") ||
          detailsText.includes("partially furnished")
        ) {
          property.furnished_status = "semi-furnished";
        } else {
          property.furnished_status = "furnished";
        }
      }

      // Pet policy detection
      if (
        detailsText.includes("pet friendly") ||
        detailsText.includes("pets allowed")
      ) {
        property.pet_policy = "allowed";
      } else if (
        detailsText.includes("no pets") ||
        detailsText.includes("pets not allowed")
      ) {
        property.pet_policy = "not_allowed";
      } else if (detailsText.includes("cats only")) {
        property.pet_policy = "cats_only";
      } else if (detailsText.includes("dogs only")) {
        property.pet_policy = "dogs_only";
      }

      // Utilities included detection
      const utilities = [];
      if (detailsText.includes("water included")) utilities.push("water");
      if (detailsText.includes("electricity included"))
        utilities.push("electricity");
      if (
        detailsText.includes("wifi included") ||
        detailsText.includes("internet included")
      )
        utilities.push("wifi");
      if (detailsText.includes("gas included")) utilities.push("gas");
      if (detailsText.includes("dstv") || detailsText.includes("satellite tv"))
        utilities.push("satellite_tv");
      property.utilities_included = utilities;

      // Deposit extraction
      const depositMatch = detailsText.match(
        /deposit[:\s]*r?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i
      );
      if (depositMatch) {
        property.deposit = parseFloat(depositMatch[1].replace(/,/g, ""));
      }

      // Available date extraction
      const availableMatch = detailsText.match(
        /available[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
      );
      if (availableMatch) {
        property.available_date = availableMatch[1];
      } else if (detailsText.includes("available immediately")) {
        property.available_date = new Date().toISOString().split("T")[0];
      }

      // Rental period detection from price text
      const priceText = this.extractWithTemplate(
        $,
        listing,
        template.selectors.price,
        "text"
      );
      if (priceText) {
        const lowerPriceText = priceText.toLowerCase();
        if (
          lowerPriceText.includes("per week") ||
          lowerPriceText.includes("/week")
        ) {
          property.rental_period = "weekly";
        } else if (
          lowerPriceText.includes("per day") ||
          lowerPriceText.includes("/day")
        ) {
          property.rental_period = "daily";
        } else {
          property.rental_period = "monthly"; // Default
        }
      }
    } catch (error) {
      console.warn("Error extracting rental-specific fields:", error.message);
    }
  }

  /**
   * Extract images from listing
   * @param {Object} $ - Cheerio instance
   * @param {Object} listing - Cheerio listing element
   * @param {Array} imageSelectors - Array of image selectors
   * @returns {Array} Array of image URLs
   */
  extractImages($, listing, imageSelectors) {
    const images = [];

    for (const selector of imageSelectors) {
      const imgElements = listing.find(selector);
      imgElements.each((i, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src");
        if (src && !src.includes("placeholder") && !src.includes("logo")) {
          const fullUrl = src.startsWith("http") ? src : this.baseUrl + src;
          if (!images.includes(fullUrl)) {
            images.push(fullUrl);
          }
        }
      });

      // If we found images with this selector, break
      if (images.length > 0) {
        break;
      }
    }

    return images;
  }
}

module.exports = Property24Extractor;

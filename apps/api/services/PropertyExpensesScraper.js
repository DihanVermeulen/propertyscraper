const { chromium } = require("playwright");
const cheerio = require("cheerio");
const database = require("../db/database");
const winston = require("winston");

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "property-expenses.log" }),
  ],
});

class PropertyExpensesScraper {
  constructor() {
    this.browser = null;
  }

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape property expenses from the property detail page
   * @param {string} propertyUrl - The URL of the property
   * @param {number} propertyId - The property ID in our database
   * @returns {Promise<Object>} The scraped expenses data
   */
  async scrapePropertyExpenses(propertyUrl, propertyId) {
    if (!this.browser) {
      await this.init();
    }

    const context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36",
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
      logger.info(`Scraping property expenses from: ${propertyUrl}`);

      await page.goto(propertyUrl, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      await page.waitForTimeout(3000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const expenses = this.extractExpensesFromHTML($);

      logger.info(`Extracted expenses: ${JSON.stringify(expenses)}`);

      // Save to database
      const savedExpenses = await this.saveExpensesToDatabase(
        propertyId,
        expenses
      );

      await context.close();

      return {
        success: true,
        expenses: savedExpenses,
        url: propertyUrl,
      };
    } catch (error) {
      logger.error(`Error scraping property expenses: ${error.message}`);
      await context.close();

      return {
        success: false,
        error: error.message,
        url: propertyUrl,
      };
    }
  }

  /**
   * Extract expenses data from the HTML using cheerio
   * @param {CheerioAPI} $ - The cheerio instance
   * @returns {Object} The extracted expenses
   */
  extractExpensesFromHTML($) {
    const expenses = {
      municipal_rates: 0,
      body_corporate_levies: 0,
      insurance_estimate: 0,
      maintenance_reserve: 0,
      municipal_taxes: 0,
      property_tax: 0,
      transfer_costs: 0,
      bond_costs: 0,
      data_source: "scraped",
    };

    try {
      // Look for the property overview accordion section
      const propertyOverview = $(
        ".p24_listingCard.p24_propertyOverview, .p24_accordion"
      );

      if (propertyOverview.length === 0) {
        logger.warn("Property overview section not found");
        return expenses;
      }

      // Find all property overview rows
      const overviewRows = propertyOverview.find(
        ".p24_propertyOverviewRow, .row.p24_propertyOverviewRow"
      );

      logger.info(`Found ${overviewRows.length} property overview rows`);

      overviewRows.each((index, element) => {
        const keyElement = $(element).find(".p24_propertyOverviewKey");
        const valueElement = $(element).find(".p24_info");

        if (keyElement.length && valueElement.length) {
          const key = keyElement.text().trim().toLowerCase();
          const value = valueElement.text().trim();

          logger.info(`Processing: "${key}" = "${value}"`);

          // Extract numeric value from strings like "R 2,370" or "R 807"
          const numericValue = this.extractCurrency(value);

          switch (key) {
            case "levies":
            case "body corporate levies":
            case "body corporate":
              expenses.body_corporate_levies = numericValue;
              logger.info(`Set body_corporate_levies to: ${numericValue}`);
              break;
            case "rates and taxes":
            case "municipal rates":
            case "rates":
            case "municipal taxes":
              expenses.municipal_rates = numericValue;
              logger.info(`Set municipal_rates to: ${numericValue}`);
              break;
            case "municipal rates and taxes":
              // If combined, split evenly (rough estimate)
              expenses.municipal_rates = Math.floor(numericValue / 2);
              expenses.municipal_taxes = Math.ceil(numericValue / 2);
              logger.info(
                `Split municipal_rates_taxes: rates=${expenses.municipal_rates}, taxes=${expenses.municipal_taxes}`
              );
              break;
          }
        }
      });

      // Leave insurance estimate and maintenance reserve at 0 - users should input their own estimates
    } catch (error) {
      logger.error(`Error extracting expenses from HTML: ${error.message}`);
    }

    return expenses;
  }

  /**
   * Extract currency value from text like "R 2,370" or "R807"
   * @param {string} text - Text containing currency
   * @returns {number} Numeric value
   */
  extractCurrency(text) {
    if (!text || typeof text !== "string") return 0;

    // Remove currency symbols and clean up the text
    const cleanText = text.replace(/[R$,\s]/g, "");

    // Extract numbers
    const match = cleanText.match(/(\d+(?:\.\d+)?)/);

    if (match) {
      const value = parseFloat(match[1]);
      return isNaN(value) ? 0 : value;
    }

    return 0;
  }

  /**
   * Save expenses to database
   * @param {number} propertyId - The property ID
   * @param {Object} expenses - The expenses object
   * @returns {Promise<Object>} The saved expenses
   */
  async saveExpensesToDatabase(propertyId, expenses) {
    try {
      const expensesData = {
        property_id: propertyId,
        property_table: "properties",
        ...expenses,
      };

      const result = await database.insertPropertyExpenses(expensesData);

      // Return the saved data with the new ID
      return {
        id: result.id,
        ...expensesData,
        scraped_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error saving expenses to database: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get existing expenses for a property
   * @param {number} propertyId - The property ID
   * @returns {Promise<Object|null>} The existing expenses or null
   */
  async getExistingExpenses(propertyId) {
    try {
      return await database.getPropertyExpenses(propertyId, "properties");
    } catch (error) {
      logger.error(`Error getting existing expenses: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if expenses need to be refreshed (older than 30 days)
   * @param {Object} expenses - The existing expenses object
   * @returns {boolean} True if refresh is needed
   */
  needsRefresh(expenses) {
    if (!expenses || !expenses.scraped_at) return true;

    const scrapedDate = new Date(expenses.scraped_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return scrapedDate < thirtyDaysAgo;
  }
}

module.exports = PropertyExpensesScraper;

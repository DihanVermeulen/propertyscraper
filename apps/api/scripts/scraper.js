const playwright = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');
const database = require('../db/database');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
    ],
});

async function scrapePropertyData() {
    logger.info('Starting scraper...');

    // Example URLs - Replace with actual listing URLs
    const urls = ['https://www.property24.com', 'https://www.privateproperty.co.za'];

    for (const url of urls) {
        try {
            logger.info(`Navigating to ${url}`);

            const browser = await playwright.chromium.launch();
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const content = await page.content();
            await browser.close();

            const $ = cheerio.load(content);

            // Replace below with selector logic to extract property data
            $('.listing-item').each((i, el) => {
                const property = {
                    external_id: $(el).attr('data-id'),
                    title: $(el).find('.title').text().trim(),
                    description: $(el).find('.description').text().trim(),
                    price: parseFloat($(el).find('.price').text().replace(/[R,]/g, '')),
                    source_website: new URL(url).hostname,
                    source_url: url
                };

                logger.info(`Scraped property: ${property.title}`);

                // Save property data to the database
                database.insertProperty(property).catch(err => {
                    logger.error('Error saving property to database:', err);
                });
            });

            logger.info(`Completed scraping for ${url}`);

        } catch (error) {
            logger.error(`Error scraping ${url}:`, error);
        }
    }

    logger.info('Scraper finished.');
}

// Run the scraper
scrapePropertyData();

module.exports = scrapePropertyData;

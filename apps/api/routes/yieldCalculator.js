const express = require('express');
const database = require('../db/database');
const PropertyExpensesScraper = require('../services/PropertyExpensesScraper');
const router = express.Router();

// Initialize the scraper (singleton pattern)
let expensesScraper = null;

const getExpensesScraper = () => {
    if (!expensesScraper) {
        expensesScraper = new PropertyExpensesScraper();
    }
    return expensesScraper;
};

/**
 * Get property expenses (scrape if not exists or if refresh requested)
 */
router.get('/property-expenses/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { refresh } = req.query;
        
        const property = await database.get('SELECT * FROM properties WHERE id = ?', [propertyId]);
        
        if (!property) {
            return res.status(404).json({ error: 'Property not found' });
        }

        const scraper = getExpensesScraper();
        let expenses = await scraper.getExistingExpenses(propertyId);
        
        // Check if we need to scrape expenses
        const shouldScrape = !expenses || refresh === 'true' || scraper.needsRefresh(expenses);
        
        if (shouldScrape && property.source_url) {
            console.log(`Scraping expenses for property ${propertyId} from ${property.source_url}`);
            
            const scrapeResult = await scraper.scrapePropertyExpenses(property.source_url, propertyId);
            
            if (scrapeResult.success) {
                expenses = scrapeResult.expenses;
            } else {
                // If scraping failed but we have existing data, return it
                if (expenses) {
                    console.warn(`Scraping failed, returning existing data: ${scrapeResult.error}`);
                } else {
                    return res.status(500).json({ 
                        error: 'Failed to scrape expenses and no existing data available',
                        details: scrapeResult.error 
                    });
                }
            }
        }

        res.json({
            expenses: expenses || {
                municipal_rates: 0,
                body_corporate_levies: 0,
                insurance_estimate: 0,
                maintenance_reserve: 0,
                data_source: 'default'
            },
            needsRefresh: scraper.needsRefresh(expenses),
            lastScraped: expenses?.scraped_at
        });

    } catch (error) {
        console.error('Error getting property expenses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Calculate rental yield based on user inputs
 */
router.post('/calculate-yield', async (req, res) => {
    try {
        const {
            propertyId,
            purchasePrice,
            depositAmount,
            depositPercentage,
            interestRate,
            loanTermMonths,
            monthlyLevies,
            monthlyRates,
            monthlyInsurance,
            monthlyMaintenance,
            estimatedMonthlyRental,
            vacancyFactor = 5.0,
            calculationName,
            notes,
            userId = null
        } = req.body;

        // Validate required fields
        if (!propertyId || !purchasePrice || !depositAmount || !interestRate || !loanTermMonths || !estimatedMonthlyRental) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['propertyId', 'purchasePrice', 'depositAmount', 'interestRate', 'loanTermMonths', 'estimatedMonthlyRental']
            });
        }

        // Calculate loan details
        const loanAmount = purchasePrice - depositAmount;
        const monthlyInterestRate = interestRate / 100 / 12;
        
        // Calculate monthly repayment using PMT formula
        const monthlyRepayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTermMonths)) / 
                                (Math.pow(1 + monthlyInterestRate, loanTermMonths) - 1);

        // Calculate rental income (accounting for vacancy)
        const monthlyRentalIncome = estimatedMonthlyRental * ((100 - vacancyFactor) / 100);
        
        // Calculate total monthly expenses
        const totalMonthlyExpenses = monthlyRepayment + (monthlyLevies || 0) + (monthlyRates || 0) + 
                                   (monthlyInsurance || 0) + (monthlyMaintenance || 0);
        
        // Calculate cash flows
        const monthlyCashFlow = monthlyRentalIncome - totalMonthlyExpenses;
        const annualCashFlow = monthlyCashFlow * 12;
        
        // Calculate yields
        const annualRental = estimatedMonthlyRental * 12;
        const grossRentalYield = (annualRental / purchasePrice) * 100;
        const netRentalYield = (annualCashFlow + (monthlyRepayment * 12)) / purchasePrice * 100; // Net before loan repayment
        const cashOnCashReturn = (annualCashFlow / depositAmount) * 100;

        const calculation = {
            property_id: propertyId,
            user_id: userId,
            purchase_price: purchasePrice,
            deposit_amount: depositAmount,
            deposit_percentage: depositPercentage,
            loan_amount: loanAmount,
            interest_rate: interestRate,
            loan_term_months: loanTermMonths,
            monthly_repayment: Math.round(monthlyRepayment * 100) / 100,
            monthly_levies: monthlyLevies || 0,
            monthly_rates: monthlyRates || 0,
            monthly_insurance: monthlyInsurance || 0,
            monthly_maintenance: monthlyMaintenance || 0,
            estimated_monthly_rental: estimatedMonthlyRental,
            vacancy_factor: vacancyFactor,
            monthly_rental_income: Math.round(monthlyRentalIncome * 100) / 100,
            total_monthly_expenses: Math.round(totalMonthlyExpenses * 100) / 100,
            monthly_cash_flow: Math.round(monthlyCashFlow * 100) / 100,
            annual_cash_flow: Math.round(annualCashFlow * 100) / 100,
            gross_rental_yield: Math.round(grossRentalYield * 100) / 100,
            net_rental_yield: Math.round(netRentalYield * 100) / 100,
            cash_on_cash_return: Math.round(cashOnCashReturn * 100) / 100,
            calculation_name: calculationName || `Calculation ${new Date().toLocaleDateString()}`,
            notes: notes || null
        };

        res.json({
            calculation,
            summary: {
                monthlyRentalIncome: calculation.monthly_rental_income,
                totalMonthlyExpenses: calculation.total_monthly_expenses,
                monthlyCashFlow: calculation.monthly_cash_flow,
                annualCashFlow: calculation.annual_cash_flow,
                grossRentalYield: calculation.gross_rental_yield,
                netRentalYield: calculation.net_rental_yield,
                cashOnCashReturn: calculation.cash_on_cash_return,
                breakEvenRental: Math.ceil(totalMonthlyExpenses)
            }
        });

    } catch (error) {
        console.error('Error calculating yield:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Save user's yield calculation
 */
router.post('/save-calculation', async (req, res) => {
    try {
        const calculationData = req.body;
        
        // Validate required fields
        if (!calculationData.property_id || !calculationData.purchase_price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const sql = `
            INSERT INTO user_yield_calculations (
                property_id, user_id, purchase_price, deposit_amount, deposit_percentage,
                loan_amount, interest_rate, loan_term_months, monthly_repayment,
                monthly_levies, monthly_rates, monthly_insurance, monthly_maintenance,
                estimated_monthly_rental, vacancy_factor, monthly_rental_income,
                total_monthly_expenses, monthly_cash_flow, annual_cash_flow,
                gross_rental_yield, net_rental_yield, cash_on_cash_return,
                calculation_name, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            calculationData.property_id, calculationData.user_id, calculationData.purchase_price,
            calculationData.deposit_amount, calculationData.deposit_percentage, calculationData.loan_amount,
            calculationData.interest_rate, calculationData.loan_term_months, calculationData.monthly_repayment,
            calculationData.monthly_levies, calculationData.monthly_rates, calculationData.monthly_insurance,
            calculationData.monthly_maintenance, calculationData.estimated_monthly_rental, calculationData.vacancy_factor,
            calculationData.monthly_rental_income, calculationData.total_monthly_expenses, calculationData.monthly_cash_flow,
            calculationData.annual_cash_flow, calculationData.gross_rental_yield, calculationData.net_rental_yield,
            calculationData.cash_on_cash_return, calculationData.calculation_name, calculationData.notes
        ];

        const result = await database.run(sql, params);

        res.json({
            success: true,
            calculationId: result.id,
            message: 'Calculation saved successfully'
        });

    } catch (error) {
        console.error('Error saving calculation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get saved calculations for a property
 */
router.get('/calculations/:propertyId', async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { userId } = req.query;

        let sql = 'SELECT * FROM user_yield_calculations WHERE property_id = ?';
        const params = [propertyId];

        if (userId) {
            sql += ' AND (user_id = ? OR user_id IS NULL)';
            params.push(userId);
        } else {
            sql += ' AND user_id IS NULL';
        }

        sql += ' ORDER BY created_at DESC';

        const calculations = await database.query(sql, params);

        res.json({ calculations });

    } catch (error) {
        console.error('Error getting calculations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete a saved calculation
 */
router.delete('/calculations/:calculationId', async (req, res) => {
    try {
        const { calculationId } = req.params;
        const { userId } = req.query;

        let sql = 'DELETE FROM user_yield_calculations WHERE id = ?';
        const params = [calculationId];

        if (userId) {
            sql += ' AND (user_id = ? OR user_id IS NULL)';
            params.push(userId);
        } else {
            sql += ' AND user_id IS NULL';
        }

        const result = await database.run(sql, params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Calculation not found or access denied' });
        }

        res.json({ success: true, message: 'Calculation deleted successfully' });

    } catch (error) {
        console.error('Error deleting calculation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cleanup function for graceful shutdown
process.on('SIGINT', async () => {
    if (expensesScraper) {
        await expensesScraper.close();
    }
});

process.on('SIGTERM', async () => {
    if (expensesScraper) {
        await expensesScraper.close();
    }
});

module.exports = router;

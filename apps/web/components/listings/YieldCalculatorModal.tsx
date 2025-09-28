'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import {
  RefreshCcw as RefreshCcwIcon,
  Calculator as CalculatorIcon,
  Save as SaveIcon,
  Loader as LoaderIcon,
  AlertCircle as AlertCircleIcon,
  TrendingUp as TrendingUpIcon,
  DollarSign as DollarSignIcon,
  Percent as PercentIcon,
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { IProperty } from '@app-types/property';
import { investorApi } from '../../lib/api';

interface PropertyExpenses {
  municipal_rates: number;
  body_corporate_levies: number;
  insurance_estimate: number;
  maintenance_reserve: number;
  data_source: string;
}

interface CalculationResult {
  monthlyRentalIncome: number;
  totalMonthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  grossRentalYield: number;
  netRentalYield: number;
  cashOnCashReturn: number;
  breakEvenRental: number;
}

interface YieldCalculatorModalProps {
  property: IProperty;
  isOpen: boolean;
  onClose: () => void;
}

export default function YieldCalculatorModal({ property, isOpen, onClose }: YieldCalculatorModalProps) {
  const queryClient = useQueryClient();
  const [isEditingExpenses, setIsEditingExpenses] = useState(false);
  const [editableExpenses, setEditableExpenses] = useState<PropertyExpenses>({} as PropertyExpenses);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);

  // React Query for expenses
  const {
    data: expensesData,
    isLoading: isLoadingExpenses,
    error: expensesError,
    refetch: refetchExpenses
  } = useQuery({
    queryKey: ['yieldCalculatorExpenses', property.id],
    queryFn: () => investorApi.getYieldCalculatorExpenses(property.id),
    enabled: isOpen && !!property.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract expenses from query data
  const expenses = expensesData?.expenses || null;

  // Mutation for saving expenses
  const saveExpensesMutation = useMutation({
    mutationFn: (expenses: PropertyExpenses) => investorApi.saveYieldCalculatorExpenses(property.id, expenses),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yieldCalculatorExpenses', property.id] });
      setIsEditingExpenses(false);
    },
    onError: (error) => {
      console.error('Error saving expenses:', error);
      alert('Failed to save expenses. Please try again.');
    },
  });

  // Mutation for calculating yield
  const calculateYieldMutation = useMutation({
    mutationFn: (calculationData: any) => investorApi.calculateYield(calculationData),
    onSuccess: (data) => {
      setCalculationResult(data.summary);
    },
    onError: (error) => {
      console.error('Error calculating yield:', error);
    },
  });

  // Mutation for saving calculation
  const saveCalculationMutation = useMutation({
    mutationFn: (calculationData: any) => investorApi.saveYieldCalculation(calculationData),
    onSuccess: () => {
      alert('Calculation saved successfully!');
    },
    onError: (error) => {
      console.error('Error saving calculation:', error);
      alert('Failed to save calculation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  // Form inputs
  const [purchasePrice, setPurchasePrice] = useState(property.price || 0);
  const [depositPercentage, setDepositPercentage] = useState([20]);
  const [depositAmount, setDepositAmount] = useState(Math.round((property.price || 0) * 0.2));
  const [interestRate, setInterestRate] = useState([11.5]);
  const [loanTermYears, setLoanTermYears] = useState([20]);
  const [estimatedMonthlyRental, setEstimatedMonthlyRental] = useState(0);
  const [vacancyFactor, setVacancyFactor] = useState([5]);
  const [calculationName, setCalculationName] = useState('');

  // Update deposit amount when percentage or purchase price changes
  useEffect(() => {
    setDepositAmount(Math.round(purchasePrice * (depositPercentage?.[0] || 0) / 100));
  }, [purchasePrice, depositPercentage]);

  // Initialize editable expenses when expenses data changes
  useEffect(() => {
    if (expenses) {
      if (expenses.municipal_rates > 0 || expenses.body_corporate_levies > 0 || 
          expenses.insurance_estimate > 0 || expenses.maintenance_reserve > 0) {
        // We have meaningful expense data
        setEditableExpenses(expenses);
        setIsEditingExpenses(false); // Show existing data, not in edit mode
      } else {
        // No pre-scraped expenses available, provide default values for manual input
        const defaultExpenses = {
          municipal_rates: 0,
          body_corporate_levies: 0,
          insurance_estimate: 0,
          maintenance_reserve: 0,
          data_source: 'user_input'
        };
        setEditableExpenses(defaultExpenses);
        setIsEditingExpenses(true); // Start in edit mode if no data
      }
    } else if (expensesError) {
      // Set default expenses on error and enable editing
      const defaultExpenses = {
        municipal_rates: 0,
        body_corporate_levies: 0,
        insurance_estimate: 0,
        maintenance_reserve: 0,
        data_source: 'user_input'
      };
      setEditableExpenses(defaultExpenses);
      setIsEditingExpenses(true);
    }
  }, [expenses, expensesError]);

  // Clean up state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset calculation result when modal closes
      setCalculationResult(null);
      
      // Ensure body scroll is restored
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure body scroll is restored on unmount
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  const handleEditExpenses = () => {
    setIsEditingExpenses(true);
  };

  const handleSaveExpenses = () => {
    saveExpensesMutation.mutate(editableExpenses);
  };

  const handleCancelEditExpenses = () => {
    // Reset to original values
    setEditableExpenses(expenses || {
      municipal_rates: 0,
      body_corporate_levies: 0,
      insurance_estimate: 0,
      maintenance_reserve: 0,
      data_source: 'user_input'
    });
    setIsEditingExpenses(false);
  };

  const calculateYield = () => {
    if (!expenses) return;

    const requestBody = {
      propertyId: property.id,
      purchasePrice,
      depositAmount,
      depositPercentage: depositPercentage?.[0] || 0,
      interestRate: interestRate?.[0] || 0,
      loanTermMonths: (loanTermYears?.[0] || 0) * 12,
      monthlyLevies: expenses.body_corporate_levies || 0,
      monthlyRates: expenses.municipal_rates || 0,
      monthlyInsurance: expenses.insurance_estimate || 0,
      monthlyMaintenance: expenses.maintenance_reserve || 0,
      estimatedMonthlyRental,
      vacancyFactor: vacancyFactor[0],
      calculationName: calculationName || `Calculation ${new Date().toLocaleDateString()}`,
      notes: null,
      userId: null
    };

    calculateYieldMutation.mutate(requestBody);
  };

  const saveCalculation = () => {
    if (!calculationResult || !expenses) return;

    const calculationData = {
      property_id: property.id,
      user_id: null,
      purchase_price: purchasePrice,
      deposit_amount: depositAmount,
      deposit_percentage: depositPercentage?.[0] || 0,
      loan_amount: purchasePrice - depositAmount,
      interest_rate: interestRate?.[0] || 0,
      loan_term_months: (loanTermYears?.[0] || 0) * 12,
      monthly_repayment: Math.round(calculationResult.totalMonthlyExpenses - (expenses.body_corporate_levies || 0) - (expenses.municipal_rates || 0) - (expenses.insurance_estimate || 0) - (expenses.maintenance_reserve || 0)),
      monthly_levies: expenses.body_corporate_levies || 0,
      monthly_rates: expenses.municipal_rates || 0,
      monthly_insurance: expenses.insurance_estimate || 0,
      monthly_maintenance: expenses.maintenance_reserve || 0,
      estimated_monthly_rental: estimatedMonthlyRental,
      vacancy_factor: vacancyFactor[0],
      monthly_rental_income: calculationResult.monthlyRentalIncome,
      total_monthly_expenses: calculationResult.totalMonthlyExpenses,
      monthly_cash_flow: calculationResult.monthlyCashFlow,
      annual_cash_flow: calculationResult.annualCashFlow,
      gross_rental_yield: calculationResult.grossRentalYield,
      net_rental_yield: calculationResult.netRentalYield,
      cash_on_cash_return: calculationResult.cashOnCashReturn,
      calculation_name: calculationName || `Calculation ${new Date().toLocaleDateString()}`,
      notes: null
    };

    saveCalculationMutation.mutate(calculationData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number, decimals = 2) => {
    return `${value.toFixed(decimals)}%`;
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        console.log('Dialog onOpenChange:', open);
        if (!open) {
          // Add a small timeout to ensure proper cleanup
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CalculatorIcon className="h-5 w-5" />
            <span>Rental Yield Calculator</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{property.title}</p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            {/* Property Expenses */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Property Expenses</CardTitle>
                  <div className="flex space-x-2">
                    {!isEditingExpenses ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditExpenses}
                        disabled={isLoadingExpenses}
                      >
                        Edit
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditExpenses}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveExpenses}
                          disabled={saveExpensesMutation.isPending}
                        >
                          {saveExpensesMutation.isPending ? (
                            <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Save
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {expensesError && (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertDescription>
                      {expensesError instanceof Error ? expensesError.message : 'Failed to load expenses'}
                    </AlertDescription>
                  </Alert>
                )}
                
                {isLoadingExpenses ? (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    <span>Loading expenses...</span>
                  </div>
                ) : expenses ? (
                  isEditingExpenses ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="municipalRates">Municipal Rates (monthly)</Label>
                          <Input
                            id="municipalRates"
                            type="number"
                            value={editableExpenses.municipal_rates || 0}
                            onChange={(e) => setEditableExpenses(prev => ({
                              ...prev,
                              municipal_rates: Number(e.target.value)
                            }))}
                            placeholder="Enter monthly municipal rates"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bodyCorporatelevies">Levies</Label>
                          <Input
                            id="bodyCorporatelevies"
                            type="number"
                            value={editableExpenses.body_corporate_levies || 0}
                            onChange={(e) => setEditableExpenses(prev => ({
                              ...prev,
                              body_corporate_levies: Number(e.target.value)
                            }))}
                            placeholder="Enter monthly levies"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="insuranceEstimate">Insurance Estimate</Label>
                          <Input
                            id="insuranceEstimate"
                            type="number"
                            value={editableExpenses.insurance_estimate || 0}
                            onChange={(e) => setEditableExpenses(prev => ({
                              ...prev,
                              insurance_estimate: Number(e.target.value)
                            }))}
                            placeholder="Enter monthly insurance"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maintenanceReserve">Maintenance Reserve</Label>
                          <Input
                            id="maintenanceReserve"
                            type="number"
                            value={editableExpenses.maintenance_reserve || 0}
                            onChange={(e) => setEditableExpenses(prev => ({
                              ...prev,
                              maintenance_reserve: Number(e.target.value)
                            }))}
                            placeholder="Enter monthly maintenance"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Municipal Rates:</span>
                        <span className="font-medium">{formatCurrency(expenses.municipal_rates || 0)}/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Body Corporate Levies:</span>
                        <span className="font-medium">{formatCurrency(expenses.body_corporate_levies || 0)}/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Insurance Estimate:</span>
                        <span className="font-medium">{formatCurrency(expenses.insurance_estimate || 0)}/month</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Maintenance Reserve:</span>
                        <span className="font-medium">{formatCurrency(expenses.maintenance_reserve || 0)}/month</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total Property Expenses:</span>
                        <span>{formatCurrency((expenses.municipal_rates || 0) + (expenses.body_corporate_levies || 0) + (expenses.insurance_estimate || 0) + (expenses.maintenance_reserve || 0))}/month</span>
                      </div>
                      {expenses.data_source === 'scraped' && (
                        <p className="text-xs text-green-600">
                          ✓ Data scraped from property listing
                        </p>
                      )}
                      {expenses.data_source === 'user_input' && (
                        <p className="text-xs text-blue-600">
                          ✓ User-provided data
                        </p>
                      )}
                      {expenses.data_source === 'default' && (
                        <p className="text-xs text-muted-foreground">
                          Using default values - click Edit to customize
                        </p>
                      )}
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>

            {/* Investment Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Investment Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchasePrice">Purchase Price</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyRental">Est. Monthly Rental</Label>
                    <Input
                      id="monthlyRental"
                      type="number"
                      value={estimatedMonthlyRental}
                      onChange={(e) => setEstimatedMonthlyRental(Number(e.target.value))}
                      placeholder="Enter estimated rental"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Deposit: {formatPercentage(depositPercentage?.[0] || 0, 0)} ({formatCurrency(depositAmount)})</Label>
                    <Slider
                      value={depositPercentage}
                      onValueChange={setDepositPercentage}
                      min={5}
                      max={50}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Interest Rate: {formatPercentage(interestRate?.[0] || 0)}</Label>
                    <Slider
                      value={interestRate}
                      onValueChange={setInterestRate}
                      min={6}
                      max={18}
                      step={0.25}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Loan Term: {loanTermYears[0]} years</Label>
                    <Slider
                      value={loanTermYears}
                      onValueChange={setLoanTermYears}
                      min={10}
                      max={30}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Vacancy Factor: {formatPercentage(vacancyFactor?.[0] || 0, 0)}</Label>
                    <Slider
                      value={vacancyFactor}
                      onValueChange={setVacancyFactor}
                      min={0}
                      max={20}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calculationName">Calculation Name (Optional)</Label>
                  <Input
                    id="calculationName"
                    value={calculationName}
                    onChange={(e) => setCalculationName(e.target.value)}
                    placeholder="My Investment Scenario"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button 
                onClick={calculateYield} 
                disabled={calculateYieldMutation.isPending || !estimatedMonthlyRental || !expenses}
                className="flex-1"
              >
                {calculateYieldMutation.isPending ? (
                  <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CalculatorIcon className="h-4 w-4 mr-2" />
                )}
                Calculate Yield
              </Button>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {calculateYieldMutation.error && (
              <Alert variant="destructive">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  {calculateYieldMutation.error instanceof Error ? calculateYieldMutation.error.message : 'Calculation failed'}
                </AlertDescription>
              </Alert>
            )}

            {calculationResult && (
              <>
                {/* Key Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <TrendingUpIcon className="h-5 w-5" />
                      <span>Key Metrics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {formatPercentage(calculationResult.grossRentalYield)}
                        </div>
                        <div className="text-sm text-muted-foreground">Gross Yield</div>
                      </div>
                      <div className="text-center p-3 bg-secondary/5 rounded-lg">
                        <div className="text-2xl font-bold text-secondary-foreground">
                          {formatPercentage(calculationResult.netRentalYield)}
                        </div>
                        <div className="text-sm text-muted-foreground">Net Yield</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg col-span-2">
                        <div className="text-2xl font-bold text-green-600">
                          {formatPercentage(calculationResult.cashOnCashReturn)}
                        </div>
                        <div className="text-sm text-muted-foreground">Cash-on-Cash Return</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cash Flow Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <DollarSignIcon className="h-5 w-5" />
                      <span>Cash Flow Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Monthly Rental Income:</span>
                        <span className="font-medium text-green-600">
                          +{formatCurrency(calculationResult.monthlyRentalIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Monthly Expenses:</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency(calculationResult.totalMonthlyExpenses)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Monthly Cash Flow:</span>
                        <span className={calculationResult.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {calculationResult.monthlyCashFlow >= 0 ? '+' : ''}{formatCurrency(calculationResult.monthlyCashFlow)}
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Annual Cash Flow:</span>
                        <span className={calculationResult.annualCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {calculationResult.annualCashFlow >= 0 ? '+' : ''}{formatCurrency(calculationResult.annualCashFlow)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="text-sm text-muted-foreground">
                        <strong>Break-even rental:</strong> {formatCurrency(calculationResult.breakEvenRental)}/month
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Save Calculation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Save Calculation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={saveCalculation} 
                      disabled={saveCalculationMutation.isPending}
                      className="w-full"
                    >
                      {saveCalculationMutation.isPending ? (
                        <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <SaveIcon className="h-4 w-4 mr-2" />
                      )}
                      Save This Calculation
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

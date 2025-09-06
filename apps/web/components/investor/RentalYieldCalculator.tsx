'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Calculator, TrendingUp, DollarSign } from 'lucide-react';

export interface IRentalYieldCalculation {
  purchasePrice: number;
  monthlyRental: number;
  annualRental: number;
  monthlyExpenses: number;
  annualExpenses: number;
  grossYield: number;
  netYield: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  breakEvenRental: number;
}

interface IRentalYieldCalculatorProps {
  defaultPurchasePrice?: number;
  defaultMonthlyRental?: number;
  onCalculate?: (calculation: IRentalYieldCalculation) => void;
}

export default function RentalYieldCalculator({ 
  defaultPurchasePrice = 0, 
  defaultMonthlyRental = 0,
  onCalculate 
}: IRentalYieldCalculatorProps) {
  const [formData, setFormData] = useState({
    purchasePrice: defaultPurchasePrice,
    monthlyRental: defaultMonthlyRental,
    municipalRates: 0,
    bodyCorporate: 0,
    insurance: 0,
    maintenance: 0,
    management: 0,
  });

  const [calculation, setCalculation] = useState<IRentalYieldCalculation | null>(null);

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const calculateYield = () => {
    const { purchasePrice, monthlyRental, municipalRates, bodyCorporate, insurance, maintenance, management } = formData;
    
    if (purchasePrice <= 0) return;

    const annualRental = monthlyRental * 12;
    const monthlyExpenses = municipalRates + bodyCorporate + insurance + maintenance + management;
    const annualExpenses = monthlyExpenses * 12;
    
    const grossYield = (annualRental / purchasePrice) * 100;
    const netYield = ((annualRental - annualExpenses) / purchasePrice) * 100;
    const monthlyCashFlow = monthlyRental - monthlyExpenses;
    const annualCashFlow = annualRental - annualExpenses;
    const breakEvenRental = monthlyExpenses;

    const result: IRentalYieldCalculation = {
      purchasePrice,
      monthlyRental,
      annualRental,
      monthlyExpenses,
      annualExpenses,
      grossYield,
      netYield,
      monthlyCashFlow,
      annualCashFlow,
      breakEvenRental,
    };

    setCalculation(result);
    onCalculate?.(result);
  };

  const getYieldColor = (yieldNumber: number) => {
    if (yieldNumber >= 10) return 'bg-green-100 text-green-800 border-green-200';
    if (yieldNumber >= 8) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (yieldNumber >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getYieldLabel = (yieldNumber: number) => {
    if (yieldNumber >= 10) return 'Excellent';
    if (yieldNumber >= 8) return 'Good';
    if (yieldNumber >= 6) return 'Fair';
    return 'Poor';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Rental Yield Calculator
        </CardTitle>
        <CardDescription>
          Calculate gross and net rental yields for investment properties
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="purchasePrice">Purchase Price (R)</Label>
            <Input
              id="purchasePrice"
              type="number"
              value={formData.purchasePrice || ''}
              onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
              placeholder="e.g. 2000000"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="monthlyRental">Monthly Rental (R)</Label>
            <Input
              id="monthlyRental"
              type="number"
              value={formData.monthlyRental || ''}
              onChange={(e) => handleInputChange('monthlyRental', e.target.value)}
              placeholder="e.g. 15000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="municipalRates">Municipal Rates (Monthly)</Label>
            <Input
              id="municipalRates"
              type="number"
              value={formData.municipalRates || ''}
              onChange={(e) => handleInputChange('municipalRates', e.target.value)}
              placeholder="e.g. 1200"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyCorporate">Body Corporate (Monthly)</Label>
            <Input
              id="bodyCorporate"
              type="number"
              value={formData.bodyCorporate || ''}
              onChange={(e) => handleInputChange('bodyCorporate', e.target.value)}
              placeholder="e.g. 800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="insurance">Insurance (Monthly)</Label>
            <Input
              id="insurance"
              type="number"
              value={formData.insurance || ''}
              onChange={(e) => handleInputChange('insurance', e.target.value)}
              placeholder="e.g. 600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance">Maintenance Reserve (Monthly)</Label>
            <Input
              id="maintenance"
              type="number"
              value={formData.maintenance || ''}
              onChange={(e) => handleInputChange('maintenance', e.target.value)}
              placeholder="e.g. 1000"
            />
          </div>
        </div>

        <Button onClick={calculateYield} className="w-full" size="lg">
          Calculate Rental Yield
        </Button>

        {/* Results */}
        {calculation && (
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Results</h3>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-600">Gross Yield</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {calculation.grossYield.toFixed(2)}%
                </div>
                <Badge className={`mt-2 ${getYieldColor(calculation.grossYield)}`}>
                  {getYieldLabel(calculation.grossYield)}
                </Badge>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-600">Net Yield</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {calculation.netYield.toFixed(2)}%
                </div>
                <Badge className={`mt-2 ${getYieldColor(calculation.netYield)}`}>
                  {getYieldLabel(calculation.netYield)}
                </Badge>
              </div>

              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-600">Monthly Cash Flow</span>
                </div>
                <div className={`text-2xl font-bold ${calculation.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R{calculation.monthlyCashFlow.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  R{calculation.annualCashFlow.toLocaleString()}/year
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Income</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monthly Rental:</span>
                    <span className="font-medium">R{calculation.monthlyRental.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Annual Rental:</span>
                    <span className="font-medium">R{calculation.annualRental.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Expenses</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monthly Expenses:</span>
                    <span className="font-medium">R{calculation.monthlyExpenses.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Annual Expenses:</span>
                    <span className="font-medium">R{calculation.annualExpenses.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-blue-600">
                    <span className="font-medium">Break-even Rental:</span>
                    <span className="font-medium">R{calculation.breakEvenRental.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

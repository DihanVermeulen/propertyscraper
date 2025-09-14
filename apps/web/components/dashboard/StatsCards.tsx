'use client';

import { IDashboardStats } from '@/@types/dashboard';
import { 
  BuildingOfficeIcon, 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon 
} from '@heroicons/react/24/outline';

interface StatsCardsProps {
  stats?: IDashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-ZA').format(num);
  };

  const cards = [
    {
      name: 'Total Properties',
      stat: stats?.total_properties ? formatNumber(stats.total_properties) : '0',
      icon: BuildingOfficeIcon,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      name: 'Average Price',
      stat: stats?.price_stats?.avg_price ? formatCurrency(stats.price_stats.avg_price) : 'R0',
      icon: CurrencyDollarIcon,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      name: 'Highest Price',
      stat: stats?.price_stats?.max_price ? formatCurrency(stats.price_stats.max_price) : 'R0',
      icon: ArrowTrendingUpIcon,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
    {
      name: 'Lowest Price',
      stat: stats?.price_stats?.min_price ? formatCurrency(stats.price_stats.min_price) : 'R0',
      icon: ArrowTrendingDownIcon,
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div key={card.name} className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`${card.bgColor} p-3 rounded-lg`}>
                <card.icon className={`h-6 w-6 ${card.color}`} aria-hidden="true" />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-secondary-500 truncate">
                  {card.name}
                </dt>
                <dd className="text-lg font-semibold text-secondary-900">
                  {card.stat}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SourceDistributionData {
  source_website: string;
  count: number;
}

interface SourceDistributionProps {
  data: SourceDistributionData[];
}

export default function SourceDistribution({ data }: SourceDistributionProps) {
  const colors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
  ];

  const chartData = {
    labels: data.map(item => {
      const domain = item.source_website.replace('www.', '');
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }),
    datasets: [
      {
        data: data.map(item => item.count),
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          color: '#374151',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#374151',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: ${context.parsed} (${percentage}%)`;
          }
        }
      },
    },
    cutout: '60%',
  };

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">
          Source Distribution
        </h3>
        <span className="text-sm text-secondary-500">
          Total: {total.toLocaleString()} properties
        </span>
      </div>
      
      {data.length > 0 ? (
        <div className="h-64 relative">
          <Doughnut data={chartData} options={options} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary-900">
                {total.toLocaleString()}
              </div>
              <div className="text-sm text-secondary-500">
                Total Properties
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-secondary-500">
          <div className="text-center">
            <p className="text-lg font-medium">No data available</p>
            <p className="text-sm mt-1">Start scraping to see source distribution</p>
          </div>
        </div>
      )}
      
      {data.length > 0 && (
        <div className="mt-6 space-y-3">
          {data.map((item, index) => (
            <div key={item.source_website} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm font-medium text-secondary-700">
                  {item.source_website.replace('www.', '')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-secondary-900">
                  {item.count.toLocaleString()}
                </span>
                <span className="text-xs text-secondary-500">
                  ({((item.count / total) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

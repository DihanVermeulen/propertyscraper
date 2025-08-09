'use client';

import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RecentActivityData {
  date: string;
  properties_scraped: number;
}

interface RecentActivityProps {
  data: RecentActivityData[];
}

export default function RecentActivity({ data }: RecentActivityProps) {
  const chartData = {
    labels: data.map(item => format(parseISO(item.date), 'MMM dd')),
    datasets: [
      {
        label: 'Properties Scraped',
        data: data.map(item => item.properties_scraped),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#374151',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6',
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
      },
    },
    elements: {
      point: {
        hoverBackgroundColor: '#3b82f6',
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 2,
      },
    },
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-900">
          Recent Scraping Activity
        </h3>
        <span className="text-sm text-secondary-500">
          Last 7 days
        </span>
      </div>
      
      {data.length > 0 ? (
        <div className="h-64">
          <Line data={chartData} options={options} />
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-secondary-500">
          <div className="text-center">
            <p className="text-lg font-medium">No data available</p>
            <p className="text-sm mt-1">Start scraping to see activity trends</p>
          </div>
        </div>
      )}
    </div>
  );
}

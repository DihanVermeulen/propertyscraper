'use client';

import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertProps {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  className?: string;
  children: ReactNode;
}

export function Alert({ variant = 'default', className = '', children }: AlertProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getVariantStyles()} ${className}`}>
      {children}
    </div>
  );
}

interface AlertDescriptionProps {
  className?: string;
  children: ReactNode;
}

export function AlertDescription({ className = '', children }: AlertDescriptionProps) {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
}

interface AlertTitleProps {
  className?: string;
  children: ReactNode;
}

export function AlertTitle({ className = '', children }: AlertTitleProps) {
  return (
    <h5 className={`mb-2 font-medium leading-none tracking-tight ${className}`}>
      {children}
    </h5>
  );
}

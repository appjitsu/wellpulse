/**
 * StatCard Component - Status/stat display card
 * Shared across all platforms with NativeWind styling
 */

import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

export interface StatCardProps extends ViewProps {
  /** Card title/label */
  label: string;
  /** Main value to display */
  value: string | number;
  /** Card variant for different states */
  variant?: 'success' | 'warning' | 'info' | 'default';
  /** Optional icon/emoji */
  icon?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  variant = 'default',
  icon,
  className,
  ...props
}) => {
  // Variant styles
  const variantClasses = {
    success: 'bg-green-50 border-green-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    default: 'bg-gray-50 border-gray-200',
  };

  const textVariantClasses = {
    success: 'text-green-900',
    warning: 'text-amber-900',
    info: 'text-blue-900',
    default: 'text-gray-900',
  };

  const labelVariantClasses = {
    success: 'text-green-700',
    warning: 'text-amber-700',
    info: 'text-blue-700',
    default: 'text-gray-600',
  };

  return (
    <View
      className={`p-4 rounded-lg border ${variantClasses[variant]} ${className || ''}`}
      {...props}
    >
      <Text className={`text-sm ${labelVariantClasses[variant]} mb-1`}>{label}</Text>
      <Text className={`text-2xl font-bold ${textVariantClasses[variant]}`}>
        {icon && `${icon} `}
        {value}
      </Text>
    </View>
  );
};

/**
 * Button Component - Shared across all platforms
 * Uses NativeWind for consistent styling
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

export interface ButtonProps extends TouchableOpacityProps {
  /** Button text */
  title: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}) => {
  // Base styles
  const baseClasses = 'rounded-lg items-center justify-center flex-row';

  // Variant styles
  const variantClasses = {
    primary: 'bg-primary-700 active:bg-primary-800',
    secondary: 'bg-secondary-500 active:bg-secondary-600',
    outline: 'bg-transparent border-2 border-primary-700 active:bg-primary-50',
    ghost: 'bg-transparent active:bg-gray-100',
  };

  // Size styles
  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  // Text variant styles
  const textVariantClasses = {
    primary: 'text-white font-semibold',
    secondary: 'text-white font-semibold',
    outline: 'text-primary-700 font-semibold',
    ghost: 'text-primary-700 font-semibold',
  };

  // Text size styles
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  // Disabled styles
  const disabledClasses = disabled || loading ? 'opacity-50' : '';

  // Full width
  const widthClasses = fullWidth ? 'w-full' : '';

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${widthClasses} ${className || ''}`;
  const textClasses = `${textVariantClasses[variant]} ${textSizeClasses[size]}`;

  return (
    <TouchableOpacity className={buttonClasses} disabled={disabled || loading} {...props}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#1E40AF' : '#FFFFFF'}
          className="mr-2"
        />
      )}
      <Text className={textClasses}>{title}</Text>
    </TouchableOpacity>
  );
};

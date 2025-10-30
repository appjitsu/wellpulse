/**
 * TextField Component - Text input with label
 * Shared across all platforms with NativeWind styling
 */

import React from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

export interface TextFieldProps extends TextInputProps {
  /** Field label */
  label: string;
  /** Error message to display */
  error?: string;
  /** Required field indicator */
  required?: boolean;
  /** Helper text below input */
  helperText?: string;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  required = false,
  helperText,
  className,
  ...props
}) => {
  const hasError = !!error;

  return (
    <View className="mb-4">
      {/* Label */}
      <Text className="text-sm font-semibold text-gray-700 mb-2">
        {label}
        {required && <Text className="text-red-500 ml-1">*</Text>}
      </Text>

      {/* Input */}
      <TextInput
        className={`bg-white border ${
          hasError ? 'border-red-500' : 'border-gray-300'
        } rounded-lg px-4 py-3 text-base text-gray-900 ${className || ''}`}
        placeholderTextColor="#9CA3AF"
        {...props}
      />

      {/* Error message */}
      {hasError && <Text className="text-sm text-red-500 mt-1">{error}</Text>}

      {/* Helper text */}
      {!hasError && helperText && <Text className="text-sm text-gray-500 mt-1">{helperText}</Text>}
    </View>
  );
};

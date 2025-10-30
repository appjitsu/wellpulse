/**
 * NativeWind Type Augmentation for React Native
 *
 * This file augments React Native component props to include className support from NativeWind.
 * Module augmentation allows us to extend existing types without modifying the original declarations.
 */

/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }

  interface TextProps {
    className?: string;
  }

  interface TouchableOpacityProps {
    className?: string;
  }

  interface ActivityIndicatorProps {
    className?: string;
  }

  interface ImageProps {
    className?: string;
  }

  interface ScrollViewProps {
    className?: string;
  }

  interface TextInputProps {
    className?: string;
  }

  interface PressableProps {
    className?: string;
  }

  interface SafeAreaViewProps {
    className?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface FlatListProps<ItemT> {
    className?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  interface SectionListProps<ItemT, SectionT = any> {
    className?: string;
  }
}

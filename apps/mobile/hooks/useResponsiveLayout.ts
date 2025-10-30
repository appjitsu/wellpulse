/**
 * Responsive Layout Hook
 * Determines if device should use mobile or desktop layout
 *
 * Native mobile apps (iOS/Android) always use mobile layout regardless of screen width/orientation
 * Web/Desktop layouts are determined by screen width breakpoints
 */

import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

const TABLET_BREAKPOINT = 768;

export interface LayoutType {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export function useResponsiveLayout(): LayoutType {
  const [layout, setLayout] = useState<LayoutType>(() => {
    const { width, height } = Dimensions.get('window');

    // Native mobile apps (iOS/Android) should always use mobile layout regardless of screen width
    const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';

    const isMobile = isNativeMobile || width < TABLET_BREAKPOINT;
    const isTablet = !isNativeMobile && width >= TABLET_BREAKPOINT && width < 1024;
    const isDesktop = !isNativeMobile && (width >= 1024 || Platform.OS === 'web');

    return {
      isMobile,
      isTablet,
      isDesktop,
      width,
      height,
    };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const { width, height } = window;

      // Native mobile apps (iOS/Android) should always use mobile layout regardless of screen width
      const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';

      const isMobile = isNativeMobile || width < TABLET_BREAKPOINT;
      const isTablet = !isNativeMobile && width >= TABLET_BREAKPOINT && width < 1024;
      const isDesktop = !isNativeMobile && (width >= 1024 || Platform.OS === 'web');

      setLayout({
        isMobile,
        isTablet,
        isDesktop,
        width,
        height,
      });
    });

    return () => subscription?.remove();
  }, []);

  return layout;
}

/**
 * Tab Navigation Layout - WellPulse Field Mobile
 * Responsive navigation: Hamburger on small web, side nav on large screens, bottom tabs on mobile
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View, Platform } from 'react-native';
import SideNav from '../../components/SideNav';
import HamburgerMenu from '../../components/HamburgerMenu';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { HeaderNetworkStatus } from '../../components/HeaderNetworkStatus';
import { EntryScreenHeaderLeft } from '../../components/EntryScreenHeader';

export default function TabLayout() {
  const layout = useResponsiveLayout();

  // Determine which navigation to show
  const isWebPlatform =
    Platform.OS === 'web' || Platform.OS === 'macos' || Platform.OS === 'windows';
  const showHamburger = isWebPlatform && layout.isMobile; // Small web/desktop screens
  const showSideNav = (layout.isTablet || layout.isDesktop) && !layout.isMobile; // Large screens
  const showBottomTabs = !isWebPlatform && layout.isMobile; // Mobile devices only

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Hamburger Menu for Small Web/Desktop Screens */}
      {showHamburger && <HamburgerMenu />}

      {/* Side Navigation for Large Screens */}
      {showSideNav && <SideNav />}

      {/* Main Content Area */}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#1E40AF',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: showBottomTabs
              ? {
                  backgroundColor: '#FFFFFF',
                  borderTopWidth: 1,
                  borderTopColor: '#E5E7EB',
                  paddingBottom: 28,
                  paddingTop: 8,
                  height: 80,
                }
              : { display: 'none' }, // Hide tab bar when using side nav or hamburger
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
            headerStyle: {
              backgroundColor: '#1E40AF',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerShown: showBottomTabs, // Show header only on mobile with bottom tabs
            headerRight: () => <HeaderNetworkStatus />, // Network status in header
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Wells',
              tabBarIcon: ({ color }) => <TabBarIcon name="🏭" color={color} />,
              headerTitle: 'My Wells',
            }}
          />
          <Tabs.Screen
            name="entry"
            options={{
              title: 'New Entry',
              tabBarIcon: ({ color }) => <TabBarIcon name="➕" color={color} />,
              headerTitle: 'Field Data Entry',
              headerLeft: () => <EntryScreenHeaderLeft />,
            }}
          />
          <Tabs.Screen
            name="sync"
            options={{
              title: 'Sync',
              tabBarIcon: ({ color }) => <TabBarIcon name="🔄" color={color} />,
              headerTitle: 'Sync Status',
            }}
          />
          <Tabs.Screen
            name="alerts"
            options={{
              title: 'Alerts',
              tabBarIcon: ({ color }) => <TabBarIcon name="🚨" color={color} />,
              headerTitle: 'Alerts',
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              tabBarIcon: ({ color }) => <TabBarIcon name="📋" color={color} />,
              headerTitle: 'Entry History',
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color }) => <TabBarIcon name="👤" color={color} />,
              headerTitle: 'Profile & Settings',
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

function TabBarIcon({ name, color }: { name: string; color: string }) {
  return <Text style={{ fontSize: 24, color }}>{name}</Text>;
}

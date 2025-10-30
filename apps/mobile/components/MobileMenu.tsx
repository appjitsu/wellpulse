/**
 * Mobile Menu Component
 * Full-width navigation menu for small web/desktop screens
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/(tabs)', icon: '🏠', label: 'Home' },
  { path: '/(tabs)/entry', icon: '📝', label: 'Field Entry' },
  { path: '/(tabs)/sync', icon: '🔄', label: 'Sync' },
  { path: '/(tabs)/history', icon: '📊', label: 'History' },
  { path: '/(tabs)/profile', icon: '👤', label: 'Profile' },
];

interface MobileMenuProps {
  onNavigate?: () => void;
}

export default function MobileMenu({ onNavigate }: MobileMenuProps = {}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigate = (path: string) => {
    router.push(path);
    onNavigate?.();
  };

  const isActive = (path: string) => {
    if (path === '/(tabs)') {
      return pathname === '/(tabs)' || pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⚡</Text>
        <Text style={styles.title}>WellPulse</Text>
      </View>

      {/* Navigation Items */}
      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.path}
            style={[styles.navItem, isActive(item.path) && styles.navItemActive]}
            onPress={() => handleNavigate(item.path)}
          >
            <Text style={styles.navIcon}>{item.icon}</Text>
            <Text style={[styles.navLabel, isActive(item.path) && styles.navLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>v1.0.0</Text>
        <Text style={styles.footerSubtext}>Permian Basin</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
    width: '100%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F9FAFB',
  },
  nav: {
    flex: 1,
  },
  navContent: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navItemActive: {
    backgroundColor: '#4F46E5',
  },
  navIcon: {
    fontSize: 28,
    marginRight: 20,
    width: 32,
    textAlign: 'center',
  },
  navLabel: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: '#6B7280',
  },
});

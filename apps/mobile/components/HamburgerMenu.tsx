/**
 * Hamburger Menu Component
 * Full-width mobile navigation for small web/desktop screens
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import MobileMenu from './MobileMenu';

export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger Button - Positioned on the Right */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => setIsOpen(true)}
        accessibilityLabel="Open navigation menu"
        accessibilityRole="button"
      >
        <View style={styles.hamburgerLine} />
        <View style={styles.hamburgerLine} />
        <View style={styles.hamburgerLine} />
      </TouchableOpacity>

      {/* Overlay Modal with Full-Width Mobile Menu */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.menuContainer}>
            <MobileMenu onNavigate={() => setIsOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hamburgerButton: {
    position: 'absolute',
    top: 16,
    right: 16, // Changed from left to right
    zIndex: 1000,
    width: 44,
    height: 44,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  hamburgerLine: {
    width: 24,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginVertical: 3,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    flex: 1, // Full width
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
});

import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WellPulse Field</Text>
        <Text style={styles.subtitle}>Mobile Data Entry for Field Operators</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Purpose</Text>
        <Text style={styles.cardText}>
          Offline-first mobile app for iOS and Android field operators to enter production data and
          equipment readings with GPS tagging and photo capture.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 Features</Text>
        <Text style={styles.bulletItem}>• 100% offline operation with local database</Text>
        <Text style={styles.bulletItem}>• GPS auto-tagging of field entries</Text>
        <Text style={styles.bulletItem}>• Superior camera quality vs laptop webcams</Text>
        <Text style={styles.bulletItem}>• QR/barcode scanning for equipment ID</Text>
        <Text style={styles.bulletItem}>• Voice-to-text for notes</Text>
        <Text style={styles.bulletItem}>• Push notifications for alerts</Text>
        <Text style={styles.bulletItem}>• Biometric authentication (Face ID, Touch ID)</Text>
        <Text style={styles.bulletItem}>• Automatic sync when connectivity restored</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 System Info</Text>
        <Text style={styles.infoText}>
          Platform: <Text style={styles.infoBold}>{Platform.OS}</Text>
        </Text>
        <Text style={styles.infoText}>
          Version: <Text style={styles.infoBold}>{Platform.Version}</Text>
        </Text>
        <Text style={styles.infoText}>
          Status: <Text style={styles.statusOnline}>● Offline Mode</Text>
        </Text>
      </View>

      <View style={[styles.card, styles.nextStepsCard]}>
        <Text style={styles.cardTitle}>📋 Next Steps</Text>
        <Text style={styles.cardText}>
          Implement field data entry forms, well selection UI, camera integration, GPS tagging,
          local database queries, and sync manager.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  bulletItem: {
    fontSize: 15,
    color: '#555',
    lineHeight: 24,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 8,
  },
  infoBold: {
    fontWeight: 'bold',
    color: '#667eea',
  },
  statusOnline: {
    color: '#00b894',
    fontWeight: 'bold',
  },
  nextStepsCard: {
    backgroundColor: '#ffeaa7',
    marginBottom: 32,
  },
});

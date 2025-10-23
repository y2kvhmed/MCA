import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import GeometricBackground from '../components/GeometricBackground';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';

export default function Welcome() {
  const router = useRouter();
  
  console.log('Welcome screen loaded');

  return (
    <LinearGradient
      colors={[Colors.primary, '#000d1a']}
      style={styles.container}
    >
      <GeometricBackground opacity={0.15} patternSize={80} />
      <SafeAreaView style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Physics with Mr. Saddam</Text>
          <Text style={styles.subtitle}>Learn Physics Anywhere</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.inverse,
    textAlign: 'center',
    opacity: 0.9,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});

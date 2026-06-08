/**
 * Splash / Onboarding screen
 * First impression of HERE. Minimal, moody, direct.
 */

import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { Colors, Typography, Spacing } from '@/constants/theme'

const { height } = Dimensions.get('window')

export default function SplashScreen() {
  const wordmarkOpacity = useSharedValue(0)
  const taglineOpacity = useSharedValue(0)
  const ctaOpacity = useSharedValue(0)
  const wordmarkY = useSharedValue(24)

  useEffect(() => {
    wordmarkOpacity.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }))
    wordmarkY.value = withDelay(300, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }))
    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }))
    ctaOpacity.value = withDelay(1800, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }))
  }, [])

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }))

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }))

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }))

  return (
    <LinearGradient
      colors={['#0A0A0A', '#0F0A1A', '#0A0A0A']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      {/* Ambient glow */}
      <View style={styles.glowContainer} pointerEvents="none">
        <View style={styles.glow} />
      </View>

      {/* Wordmark */}
      <Animated.View style={[styles.wordmarkContainer, wordmarkStyle]}>
        <Text style={styles.wordmark}>HERE</Text>
        <View style={styles.dot} />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineContainer, taglineStyle]}>
        <Text style={styles.tagline}>You can only speak</Text>
        <Text style={styles.taglineAccent}>where you stand.</Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View style={[styles.ctaContainer, ctaStyle]}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Presence is permission.{'\n'}No fake locations. No remote posting.
        </Text>
      </Animated.View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  glowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.accent,
    opacity: 0.06,
    transform: [{ scaleY: 0.6 }],
  },
  wordmarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  wordmark: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.heavy,
    color: Colors.text,
    letterSpacing: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginLeft: 4,
    marginBottom: 8,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: height * 0.12,
  },
  tagline: {
    fontSize: Typography.lg,
    fontWeight: Typography.regular,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  taglineAccent: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 64,
    left: Spacing.xl,
    right: Spacing.xl,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    letterSpacing: 0.3,
  },
  disclaimer: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.xs * Typography.relaxed,
  },
})

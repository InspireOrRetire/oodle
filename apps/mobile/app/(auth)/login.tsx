/**
 * Login screen — phone OTP (primary) or email (fallback).
 * Two-step: enter phone → enter OTP code.
 */

import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { Colors, Typography, Spacing, Radii } from '@/constants/theme'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const { signInWithPhone, verifyOtp, profile } = useAuth()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const otpRef = useRef<TextInput>(null)

  const handleSendOtp = async () => {
    const cleaned = phone.trim().replace(/\D/g, '')
    if (cleaned.length < 10) {
      setError('Enter a valid phone number.')
      return
    }

    setLoading(true)
    setError(null)

    const formatted = `+1${cleaned}` // Assume US — update for international
    const { error: err } = await signInWithPhone(formatted)

    setLoading(false)

    if (err) {
      setError(err)
    } else {
      setStep('otp')
      setTimeout(() => otpRef.current?.focus(), 300)
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code.')
      return
    }

    setLoading(true)
    setError(null)

    const formatted = `+1${phone.trim().replace(/\D/g, '')}`
    const { error: err } = await verifyOtp(formatted, otp.trim())

    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    // If no profile yet, go to setup
    if (!profile) {
      router.replace('/(auth)/setup')
    } else {
      router.replace('/(app)')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Back + Header */}
        {step === 'otp' && (
          <Pressable onPress={() => { setStep('phone'); setError(null) }} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        )}

        <Text style={styles.title}>
          {step === 'phone' ? 'Enter your number.' : 'Check your texts.'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'We\'ll send a one-time code. No password needed.'
            : `Sent a 6-digit code to +1 ${phone}. It expires in 5 minutes.`}
        </Text>

        {/* Input */}
        {step === 'phone' ? (
          <View style={styles.inputWrapper}>
            <Text style={styles.prefix}>+1</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 000-0000"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={14}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
              autoFocus
            />
          </View>
        ) : (
          <TextInput
            ref={otpRef}
            style={[styles.input, styles.otpInput]}
            placeholder="000000"
            placeholderTextColor={Colors.textTertiary}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleVerifyOtp}
          />
        )}

        {/* Error */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.button, loading && styles.buttonDisabled, pressed && styles.buttonPressed]}
          onPress={step === 'phone' ? handleSendOtp : handleVerifyOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {step === 'phone' ? 'Send Code' : 'Verify & Enter'}
            </Text>
          )}
        </Pressable>

        {step === 'otp' && (
          <Pressable onPress={handleSendOtp} disabled={loading}>
            <Text style={styles.resend}>Resend code</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: 100,
  },
  back: {
    marginBottom: Spacing.xl,
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    lineHeight: Typography.sm * Typography.relaxed,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    height: 56,
  },
  prefix: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.md,
    color: Colors.text,
    height: 56,
  },
  otpInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    height: 56,
    letterSpacing: 8,
    fontSize: Typography.xl,
    textAlign: 'center',
  },
  error: {
    color: Colors.error,
    fontSize: Typography.sm,
    marginBottom: Spacing.base,
  },
  button: {
    backgroundColor: Colors.accent,
    height: 56,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
  resend: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
})

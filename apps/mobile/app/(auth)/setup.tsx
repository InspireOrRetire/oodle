/**
 * Profile setup screen — username selection + anonymous preference.
 * Shown once after first login if profile doesn't exist.
 */

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { checkUsernameAvailable, createProfile } from '@/lib/api'
import { Colors, Typography, Spacing, Radii } from '@/constants/theme'

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/

export default function SetupScreen() {
  const { user, setProfile } = useAuth()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [anonymousByDefault, setAnonymousByDefault] = useState(false)
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUsernameChange = async (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
    setUsername(cleaned)
    setAvailable(null)

    if (cleaned.length < 3) return
    if (!USERNAME_REGEX.test(cleaned)) return

    setChecking(true)
    const ok = await checkUsernameAvailable(cleaned)
    setChecking(false)
    setAvailable(ok)
  }

  const handleContinue = async () => {
    if (!user) return
    if (!USERNAME_REGEX.test(username)) {
      setError('Username: 3–20 characters, letters, numbers, underscores only.')
      return
    }
    if (available === false) {
      setError('That username is taken.')
      return
    }

    setLoading(true)
    setError(null)

    const profile = await createProfile(
      user.id,
      username,
      displayName.trim() || undefined
    )

    setLoading(false)

    if (!profile) {
      setError('Could not create profile. Try a different username.')
      return
    }

    setProfile(profile)
    router.replace('/(app)')
  }

  const usernameStatus = () => {
    if (username.length < 3) return null
    if (checking) return <ActivityIndicator size="small" color={Colors.textSecondary} />
    if (available === true) return <Text style={styles.available}>✓ Available</Text>
    if (available === false) return <Text style={styles.unavailable}>✗ Taken</Text>
    return null
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Set up your presence.</Text>
        <Text style={styles.subtitle}>
          This is how others will see you — or not.
        </Text>

        {/* Username */}
        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="your_handle"
              placeholderTextColor={Colors.textTertiary}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              autoFocus
            />
            <View style={styles.usernameStatus}>{usernameStatus()}</View>
          </View>
          <Text style={styles.hint}>3–20 characters. Letters, numbers, underscores.</Text>
        </View>

        {/* Display name (optional) */}
        <View style={styles.field}>
          <Text style={styles.label}>Display Name <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="How you appear when not posting anonymously"
            placeholderTextColor={Colors.textTertiary}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={40}
          />
        </View>

        {/* Anonymous default */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Post anonymously by default</Text>
            <Text style={styles.toggleHint}>
              You can always claim posts later. Your identity is known to us, not others.
            </Text>
          </View>
          <Switch
            value={anonymousByDefault}
            onValueChange={setAnonymousByDefault}
            trackColor={{ false: Colors.surface3, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (loading || available === false) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleContinue}
          disabled={loading || available === false}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Enter HERE</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 100,
    paddingBottom: Spacing.huge,
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
  },
  field: { marginBottom: Spacing.xl },
  label: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optional: {
    fontWeight: Typography.regular,
    textTransform: 'none',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.text,
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
  },
  usernameStatus: { marginLeft: Spacing.sm },
  available: { color: Colors.verified, fontSize: Typography.sm },
  unavailable: { color: Colors.error, fontSize: Typography.sm },
  hint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.base,
  },
  toggleText: { flex: 1 },
  toggleLabel: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  toggleHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: Typography.xs * Typography.relaxed,
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
    marginTop: Spacing.base,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
  },
})

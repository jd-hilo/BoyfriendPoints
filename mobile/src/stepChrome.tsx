import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from './theme';

export function StepHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number;
  totalSteps: number;
  onBack?: () => void;
}) {
  const pct = ((step + 1) / totalSteps) * 100;
  return (
    <View style={stepStyles.stepHeader}>
      <View style={stepStyles.stepHeaderRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10}>
            <Text style={stepStyles.backArrow}>←</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={stepStyles.stepCount}>
          Step {step + 1} of {totalSteps}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={stepStyles.progressTrack}>
        <View style={[stepStyles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export function StepShell({
  title,
  sub,
  error,
  children,
}: {
  title: string;
  sub?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <ScrollView
      contentContainerStyle={stepStyles.stepContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={stepStyles.stepTitle}>{title}</Text>
      {sub ? <Text style={stepStyles.stepSub}>{sub}</Text> : null}
      {error ? <Text style={stepStyles.error}>{error}</Text> : null}
      <View style={stepStyles.stepForm}>{children}</View>
    </ScrollView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        stepStyles.primaryBtn,
        (disabled || pressed) && stepStyles.btnMuted,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={stepStyles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SkipLink({
  label = "I'll do this later",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={stepStyles.skipWrap}>
      <Text style={stepStyles.skipText}>{label}</Text>
    </Pressable>
  );
}

export const stepStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  stepHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backArrow: { fontSize: 20, color: colors.black, width: 24 },
  stepCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9b9a97',
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#ececea',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.black,
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.black,
    marginBottom: 8,
  },
  stepSub: {
    fontSize: 15,
    lineHeight: 22,
    color: '#787774',
    marginBottom: 28,
  },
  stepForm: { gap: 14 },
  bigInput: {
    borderWidth: 1,
    borderColor: '#e3e2e0',
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: '#ffffff',
    color: colors.black,
  },
  primaryBtn: {
    marginTop: 6,
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnMuted: { opacity: 0.45 },
  switchText: {
    marginTop: 16,
    fontSize: 14,
    color: '#787774',
    textAlign: 'center',
  },
  link: {
    color: colors.black,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  skipWrap: { alignItems: 'center', marginTop: 8 },
  skipText: { fontSize: 14, color: '#9b9a97', fontWeight: '500' },
  error: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
});

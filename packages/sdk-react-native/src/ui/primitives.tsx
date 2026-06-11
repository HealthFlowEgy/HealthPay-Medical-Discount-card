/** Themed building blocks shared by the flow screens. */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { HealthPayTheme } from "../theme";

export function Badge({
  label,
  theme,
  tone = "teal",
}: {
  label: string;
  theme: HealthPayTheme;
  tone?: "teal" | "gold" | "solid";
}) {
  const map = {
    teal: { bg: theme.tealSoft, fg: theme.tealDark, bd: theme.tealSoft },
    gold: { bg: theme.goldSoft, fg: "#8a6212", bd: theme.gold },
    solid: { bg: theme.teal, fg: theme.onPrimary, bd: theme.teal },
  }[tone];
  return (
    <View
      style={{
        backgroundColor: map.bg,
        borderColor: map.bd,
        borderWidth: tone === "teal" ? 0 : 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  theme,
  variant = "teal",
  loading = false,
  disabled = false,
  isRTL = false,
}: {
  label: string;
  onPress: () => void;
  theme: HealthPayTheme;
  variant?: "teal" | "navy" | "outline";
  loading?: boolean;
  disabled?: boolean;
  isRTL?: boolean;
}) {
  const isOutline = variant === "outline";
  const bg = isOutline ? "transparent" : variant === "navy" ? theme.navy : theme.teal;
  const fg = isOutline ? theme.tealDark : theme.onPrimary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: isOutline ? theme.teal : bg,
          borderWidth: isOutline ? 1.5 : 0,
          borderRadius: theme.radius,
          opacity: off ? 0.55 : pressed ? 0.9 : 1,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} style={{ marginHorizontal: 6 }} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  theme,
  selected = false,
  style,
}: {
  children: React.ReactNode;
  theme: HealthPayTheme;
  selected?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: selected ? theme.tealSoft : theme.surface,
          borderColor: selected ? theme.teal : theme.border,
          borderWidth: selected ? 2 : 1.3,
          borderRadius: theme.radiusLg,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A flow header bar with the HealthPay mark and an optional status chip. */
export function Header({
  theme,
  isRTL,
  statusLabel,
}: {
  theme: HealthPayTheme;
  isRTL: boolean;
  statusLabel?: string;
}) {
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: theme.navy, flexDirection: isRTL ? "row-reverse" : "row" },
      ]}
    >
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center" }}>
        <View style={[styles.logoOuter, { backgroundColor: theme.teal }]}>
          <View style={[styles.logoInner, { backgroundColor: theme.navy }]} />
        </View>
        <View style={{ marginHorizontal: 10 }}>
          <Text style={{ color: theme.onPrimary, fontSize: 15, fontWeight: "700" }}>HealthPay</Text>
          <Text style={{ color: "#9fb4d6", fontSize: 10.5 }}>Medical discount card</Text>
        </View>
      </View>
      {statusLabel ? (
        <View style={styles.statusChip}>
          <Text style={{ color: theme.onPrimary, fontSize: 11, fontWeight: "700" }}>
            {statusLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  logoOuter: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  logoInner: { width: 10, height: 10, borderRadius: 5 },
  statusChip: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});

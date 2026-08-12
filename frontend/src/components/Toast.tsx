import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "./AppText";
import { colors, radius, spacing } from "@/src/theme/theme";

type ToastContextValue = { show: (message: string) => void };
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(20, { duration: 200 });
  }, [opacity, translateY]);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      opacity.value = withTiming(1, { duration: 220 });
      translateY.value = withTiming(0, { duration: 220 });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        runOnJS(hide)();
      }, 1800);
    },
    [opacity, translateY, hide],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.wrap, { bottom: insets.bottom + 90 }, animStyle]}
      >
        <View style={styles.toast} testID="toast">
          <Feather name="check" size={16} color={colors.onSurfaceInverse} />
          <AppText variant="medium" color={colors.onSurfaceInverse} style={styles.text}>
            {message}
          </AppText>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 13,
  },
});

import React, { useRef, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { WebView } from "react-native-webview";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import { useToast } from "@/src/components/Toast";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { colors, spacing } from "@/src/theme/theme";

const LOGIN_URL = "https://shop.altosindia.net/login/dsm";

export default function AltosLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { setVerified } = useAltosAuth();

  const [loading, setLoading] = useState(true);
  const seenLogin = useRef(false);
  const done = useRef(false);

  const onSuccess = () => {
    if (done.current) return;
    done.current = true;
    setVerified(true);
    toast.show("Altos ID verified — login successful");
    router.back();
  };

  const onNavChange = (navState: { url: string }) => {
    const url = navState.url || "";
    if (url.includes("/login")) {
      seenLogin.current = true;
      return;
    }
    // Successful login: site navigated away from the login page
    if (seenLogin.current && url.startsWith("https://shop.altosindia.net")) {
      onSuccess();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="altos-login-close" onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.headerTitle}>
          Altos ID Login
        </AppText>
        <View style={styles.closeBtn} />
      </View>

      {Platform.OS === "web" ? (
        <View style={styles.webFallback}>
          <Feather name="external-link" size={32} color={colors.brand} />
          <AppText variant="displayMedium" style={styles.webTitle}>
            Log in with your Altos ID
          </AppText>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.webSub}>
            The login page will open in a new tab. Once you have logged in successfully, come back here and confirm.
          </AppText>
          <Button
            testID="open-login-page"
            label="Open Login Page"
            onPress={() => Linking.openURL(LOGIN_URL)}
            style={styles.webBtn}
          />
          <Button
            testID="confirm-logged-in"
            label="I have logged in"
            variant="secondary"
            onPress={onSuccess}
            style={styles.webBtn}
          />
        </View>
      ) : (
        <>
          <WebView
            testID="altos-login-webview"
            source={{ uri: LOGIN_URL }}
            incognito
            onNavigationStateChange={onNavChange}
            onLoadEnd={() => setLoading(false)}
            style={styles.webview}
          />
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.brand} size="large" />
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Loading Altos login…
              </AppText>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16 },
  webview: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    top: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  webTitle: { fontSize: 24, textAlign: "center" },
  webSub: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  webBtn: {
    alignSelf: "stretch",
    maxWidth: 320,
    width: "100%",
  },
});

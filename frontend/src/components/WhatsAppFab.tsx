import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { openWhatsApp, STORE_WHATSAPP } from "@/src/utils/whatsapp";

const GREETING = "Hi Altos World! I'd like to know more about your products.";

export default function WhatsAppFab() {
  return (
    <Pressable
      testID="whatsapp-fab"
      onPress={() => openWhatsApp(GREETING, STORE_WHATSAPP)}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <FontAwesome name="whatsapp" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});

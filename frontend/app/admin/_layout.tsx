import React from "react";
import { Stack } from "expo-router";

import AdminLock from "@/src/components/AdminLock";
import { useAdminAuth } from "@/src/context/AdminAuthContext";

export default function AdminLayout() {
  const { unlocked } = useAdminAuth();
  if (!unlocked) return <AdminLock />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="product-form" options={{ presentation: "modal" }} />
    </Stack>
  );
}

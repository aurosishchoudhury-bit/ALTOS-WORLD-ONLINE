import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { openWhatsApp, registrationMessage, STORE_WHATSAPP } from "@/src/utils/whatsapp";
import { colors, spacing, radius } from "@/src/theme/theme";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const TITLES = ["Mr", "Mrs", "Ms", "Dr"];
const GUARDIAN = [
  { key: "S", label: "Son of" },
  { key: "D", label: "Daughter of" },
  { key: "W", label: "Wife of" },
];

export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [title, setTitle] = useState("Mr");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [guardianType, setGuardianType] = useState("S");
  const [guardianName, setGuardianName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!name.trim()) return "Please enter your full name";
    if (mobile.trim().length < 10) return "Please enter a valid 10-digit mobile number";
    if (!emailRe.test(email.trim())) return "Please enter a valid email";
    if (!guardianName.trim()) return "Please enter the S/D/W of name";
    if (!dateRe.test(dob.trim())) return "Please enter date of birth as YYYY-MM-DD";
    if (address.trim().length < 5) return "Please enter your full address";
    if (!nomineeName.trim()) return "Please enter the nominee name";
    if (!nomineeRelation.trim()) return "Please enter relation with nominee";
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      toast.show(err);
      return;
    }
    setSubmitting(true);
    const payload = {
      title,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      guardian_type: guardianType,
      guardian_name: guardianName.trim(),
      dob: dob.trim(),
      address: address.trim(),
      nominee_name: nomineeName.trim(),
      nominee_relation: nomineeRelation.trim(),
    };
    try {
      await api.createRegistration(payload);
      toast.show("Registration submitted — opening WhatsApp");
      openWhatsApp(registrationMessage(payload), STORE_WHATSAPP);
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Could not submit registration");
    } finally {
      setSubmitting(false);
    }
  };

  const Segment = ({
    options,
    value,
    onChange,
    testID,
  }: {
    options: { key: string; label: string }[];
    value: string;
    onChange: (k: string) => void;
    testID: string;
  }) => (
    <View style={styles.segmentRow} testID={testID}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            testID={`${testID}-${o.key}`}
            onPress={() => onChange(o.key)}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <AppText
              variant={on ? "semibold" : "body"}
              color={on ? "#fff" : colors.onSurface}
              style={styles.segmentText}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="register-back" onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="displaySemiBold" style={styles.headerTitle}>
          Register
        </AppText>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <AppText variant="displayMedium" style={styles.sectionTitle}>
          Direct Seller Registration
        </AppText>

        <AppText variant="semibold" style={styles.fieldLabel}>
          Title
        </AppText>
        <Segment
          options={TITLES.map((t) => ({ key: t, label: t }))}
          value={title}
          onChange={setTitle}
          testID="title-segment"
        />

        <FormField testID="reg-name" label="Full name" value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
        <FormField testID="reg-mobile" label="Mobile number" value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
        <FormField testID="reg-email" label="Email ID" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />

        <AppText variant="semibold" style={styles.fieldLabel}>
          S / D / W of
        </AppText>
        <Segment options={GUARDIAN} value={guardianType} onChange={setGuardianType} testID="guardian-segment" />
        <FormField testID="reg-guardian-name" label="S/D/W of (name)" value={guardianName} onChangeText={setGuardianName} placeholder="Father / Husband name" autoCapitalize="words" />

        <FormField testID="reg-dob" label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1990-01-31" />
        <FormField testID="reg-address" label="Address" value={address} onChangeText={setAddress} placeholder="Flat, street, city, PIN" multiline numberOfLines={3} style={styles.addressInput} />
        <FormField testID="reg-nominee-name" label="Nominee name" value={nomineeName} onChangeText={setNomineeName} placeholder="Nominee full name" autoCapitalize="words" />
        <FormField testID="reg-nominee-relation" label="Relation with nominee" value={nomineeRelation} onChangeText={setNomineeRelation} placeholder="e.g. Wife, Son, Father" autoCapitalize="words" />

        <View style={styles.disclaimer}>
          <Feather name="info" size={16} color={colors.brand} />
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.disclaimerText}>
            Your Altos ID and password will be shared with you within 15 minutes via WhatsApp and text
            message. Please keep the ID and password safe for your future purchases.
          </AppText>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button testID="submit-registration" label="Submit & Send on WhatsApp" onPress={onSubmit} loading={submitting} />
        </View>
      </KeyboardStickyView>
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
  },
  headerTitle: { fontSize: 22 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 140 },
  sectionTitle: { fontSize: 24, marginBottom: spacing.lg, marginTop: spacing.sm },
  fieldLabel: { fontSize: 13, marginBottom: spacing.sm, marginTop: spacing.sm },
  segmentRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" },
  segment: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  segmentOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  segmentText: { fontSize: 13 },
  addressInput: { minHeight: 90, textAlignVertical: "top" },
  disclaimer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  disclaimerText: { flex: 1, fontSize: 13, lineHeight: 19 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});

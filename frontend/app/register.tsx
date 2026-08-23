import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, ScrollView } from "react-native";
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

const TITLES = ["Mr", "Mrs", "Ms", "Dr"];
const GUARDIAN = [
  { key: "S", label: "Son of" },
  { key: "D", label: "Daughter of" },
  { key: "W", label: "Wife of" },
];
const INTERESTS = [
  { key: "products", label: "1 · Products" },
  { key: "business", label: "2 · Business" },
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 18 - 1940 + 1 }, (_, i) => String(CURRENT_YEAR - 18 - i));

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
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState(""); // "1".."12"
  const [dobYear, setDobYear] = useState("");
  const [address, setAddress] = useState("");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeRelation, setNomineeRelation] = useState("");
  const [referralId, setReferralId] = useState("");
  const [referralName, setReferralName] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [interestedIn, setInterestedIn] = useState("products");
  const [submitting, setSubmitting] = useState(false);

  const dob =
    dobDay && dobMonth && dobYear
      ? `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`
      : "";

  const validate = () => {
    if (!name.trim()) return "Please enter your full name";
    if (mobile.trim().length < 10) return "Please enter a valid 10-digit mobile number";
    if (!emailRe.test(email.trim())) return "Please enter a valid email";
    if (!guardianName.trim()) return "Please enter the S/D/W of name";
    if (!dob) return "Please select your date of birth";
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
      dob,
      address: address.trim(),
      nominee_name: nomineeName.trim(),
      nominee_relation: nomineeRelation.trim(),
      referral_id: referralId.trim(),
      referral_name: referralName.trim(),
      sponsor_id: sponsorId.trim(),
      sponsor_name: sponsorName.trim(),
      interested_in: interestedIn,
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

  const Dropdown = ({
    label,
    value,
    display,
    options,
    onSelect,
    testID,
  }: {
    label: string;
    value: string;
    display?: (v: string) => string;
    options: string[];
    onSelect: (v: string) => void;
    testID: string;
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <View style={{ flex: 1 }}>
        <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.dropdown}>
          <AppText
            variant={value ? "medium" : "body"}
            color={value ? colors.onSurface : colors.muted}
            style={styles.dropdownText}
            numberOfLines={1}
          >
            {value ? (display ? display(value) : value) : label}
          </AppText>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.ddOverlay} onPress={() => setOpen(false)}>
            <View style={styles.ddCard}>
              <AppText variant="semibold" style={styles.ddTitle}>
                {label}
              </AppText>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {options.map((o) => (
                  <Pressable
                    key={o}
                    testID={`${testID}-${o}`}
                    onPress={() => {
                      onSelect(o);
                      setOpen(false);
                    }}
                    style={styles.ddRow}
                  >
                    <AppText
                      variant={o === value ? "semibold" : "body"}
                      color={o === value ? colors.brand : colors.onSurface}
                    >
                      {display ? display(o) : o}
                    </AppText>
                    {o === value && <Feather name="check" size={16} color={colors.brand} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  };

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

        <AppText variant="semibold" style={styles.fieldLabel}>
          Date of birth
        </AppText>
        <View style={styles.dobRow}>
          <Dropdown label="Day" value={dobDay} options={DAYS} onSelect={setDobDay} testID="dob-day" />
          <Dropdown
            label="Month"
            value={dobMonth}
            options={MONTHS.map((_, i) => String(i + 1))}
            display={(v) => MONTHS[parseInt(v, 10) - 1]}
            onSelect={setDobMonth}
            testID="dob-month"
          />
          <Dropdown label="Year" value={dobYear} options={YEARS} onSelect={setDobYear} testID="dob-year" />
        </View>
        <FormField testID="reg-address" label="Address" value={address} onChangeText={setAddress} placeholder="Flat, street, city, PIN" multiline numberOfLines={3} style={styles.addressInput} />
        <FormField testID="reg-nominee-name" label="Nominee name" value={nomineeName} onChangeText={setNomineeName} placeholder="Nominee full name" autoCapitalize="words" />
        <FormField testID="reg-nominee-relation" label="Relation with nominee" value={nomineeRelation} onChangeText={setNomineeRelation} placeholder="e.g. Wife, Son, Father" autoCapitalize="words" />

        <View style={styles.pairRow}>
          <View style={{ flex: 1 }}>
            <FormField testID="reg-referral-id" label="Referral ID (optional)" value={referralId} onChangeText={setReferralId} placeholder="Referral ID" autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField testID="reg-referral-name" label="Referral name (optional)" value={referralName} onChangeText={setReferralName} placeholder="Referral name" autoCapitalize="words" />
          </View>
        </View>
        <View style={styles.pairRow}>
          <View style={{ flex: 1 }}>
            <FormField testID="reg-sponsor-id" label="Sponsor ID (optional)" value={sponsorId} onChangeText={setSponsorId} placeholder="Sponsor ID" autoCapitalize="characters" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField testID="reg-sponsor-name" label="Sponsor name (optional)" value={sponsorName} onChangeText={setSponsorName} placeholder="Sponsor name" autoCapitalize="words" />
          </View>
        </View>

        <AppText variant="semibold" style={styles.fieldLabel}>
          Interested in
        </AppText>
        <Segment options={INTERESTS} value={interestedIn} onChange={setInterestedIn} testID="interest-segment" />

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
  dobRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pairRow: { flexDirection: "row", gap: spacing.sm },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  dropdownText: { fontSize: 14, flex: 1 },
  ddOverlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  ddCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  ddTitle: { fontSize: 15, marginBottom: spacing.sm },
  ddRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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

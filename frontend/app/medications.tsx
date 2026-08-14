import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Card, Muted, Title, PrimaryButton, Tag } from "@/src/components/ui";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Medication } from "@/src/api";
import { colors, spacing, fontSize, fonts } from "@/src/theme";

export default function MedicationsScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick } = useApp();
  const { t } = useI18n();
  const { openMed } = useLog();

  const [items, setItems] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      setItems(await api.listMeds(activeId));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const del = async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    await api.deleteMed(id).catch(() => {});
  };

  const active = items.filter((m) => m.active);
  const past = items.filter((m) => !m.active);

  const renderMed = (m: Medication) => (
    <Card key={m.id} testID={`medication-${m.id}`} style={{ marginBottom: spacing.md }}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="medkit" size={18} color={colors.onSurface} />
        </View>
        <View style={{ flex: 1 }}>
          <Title>{m.name}</Title>
          <Muted style={{ marginTop: 2 }}>{[m.dose, m.schedule].filter(Boolean).join(" · ") || "—"}</Muted>
        </View>
        {m.active && <Tag label={t("active")} />}
        <Pressable onPress={() => del(m.id)} hitSlop={8} style={{ marginLeft: spacing.sm }} testID={`delete-medication-${m.id}`}>
          <Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title={t("m_meds")} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.onSurface} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="medkit-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md }}>{t("no_active_meds")}</Muted>
            </View>
          ) : (
            <>
              {active.map(renderMed)}
              {past.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t("tasks_done")}</Text>
                  {past.map(renderMed)}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
      <View style={[styles.fabWrap, { bottom: insets.bottom + 24 }]}>
        <PrimaryButton label={t("add_medication")} icon="add" onPress={openMed} testID="add-med-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  sectionLabel: {
    fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginVertical: spacing.md, fontFamily: fonts.text,
  },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
});

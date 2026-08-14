import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { GradientCard } from "@/src/components/ui";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, gradients } from "@/src/theme";

type Mod = {
  key: string;
  route: string;
  label: string;
  icon: any;
  grad: readonly string[];
  count?: number;
};

export default function HealthHub() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeId, refreshTick } = useApp();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      const [labs, vitals, checkins, meds] = await Promise.all([
        api.listLabs(activeId),
        api.listVitals(activeId),
        api.listCheckins(activeId),
        api.listMeds(activeId),
      ]);
      setCounts({
        labs: labs.length,
        pressure: vitals.filter((v) => v.kind === "bp").length,
        measures: vitals.filter((v) => v.kind !== "bp").length,
        mind: checkins.length,
        meds: meds.length,
      });
    } catch (e) {
      // ignore
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { load(); }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const mods: Mod[] = [
    { key: "labs", route: "/labs", label: t("m_labs"), icon: "water", grad: gradients.pink, count: counts.labs },
    { key: "pressure", route: "/pressure", label: t("m_pressure"), icon: "heart-circle", grad: gradients.warm, count: counts.pressure },
    { key: "mind", route: "/mind", label: t("m_mind"), icon: "happy", grad: gradients.lime, count: counts.mind },
    { key: "meds", route: "/medications", label: t("m_meds"), icon: "medkit", grad: gradients.cool, count: counts.meds },
    { key: "measures", route: "/measurements", label: t("m_measures"), icon: "fitness", grad: gradients.warmSoft, count: counts.measures },
    { key: "history", route: "/history", label: t("m_history"), icon: "time", grad: gradients.pink, count: undefined },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar subtitle={t("health_modules")} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
      >
        <View style={styles.grid}>
          {mods.map((m) => (
            <Pressable
              key={m.key}
              testID={`module-${m.key}`}
              style={styles.cell}
              onPress={() => router.push(m.route as any)}
            >
              <GradientCard gradient={m.grad} style={styles.modCard}>
                <View style={styles.modIcon}>
                  <Ionicons name={m.icon} size={22} color={colors.onSurface} />
                </View>
                <Text style={styles.modLabel}>{m.label}</Text>
                {typeof m.count === "number" && (
                  <Text style={styles.modCount}>
                    {m.count} {m.count === 0 ? "" : ""}
                  </Text>
                )}
              </GradientCard>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cell: { width: "47.8%" },
  modCard: { minHeight: 130, justifyContent: "space-between", padding: spacing.lg },
  modIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  modLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, letterSpacing: -0.2, fontFamily: fonts.text },
  modCount: { fontSize: fontSize.sm, color: "rgba(27,27,29,0.6)", marginTop: 2, fontFamily: fonts.text },
});

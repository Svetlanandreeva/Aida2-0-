import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { GradientCard } from "@/src/components/ui";
import { useLog } from "@/src/components/LogProvider";
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
  const { t, lang } = useI18n();
  const { openMenu } = useLog();
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!activeId) {
      setCounts({});
      return;
    }
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
      setCounts({});
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

  const countLabel = (count?: number) => {
    if (typeof count !== "number" || count === 0) return lang === "ru" ? "Пока нет данных" : "No data yet";
    return String(count);
  };

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
        <Pressable style={styles.logCard} onPress={openMenu} testID="health-log-data-button">
          <View style={styles.logIcon}>
            <Ionicons name="add" size={24} color={colors.surfaceSecondary} />
          </View>
          <View style={styles.logCopy}>
            <Text style={styles.logTitle}>{lang === "ru" ? "Добавить данные" : "Add health data"}</Text>
            <Text style={styles.logSubtitle}>
              {lang === "ru" ? "Давление, симптомы, сон, измерения и другое" : "Vitals, symptoms, sleep, measurements and more"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.surfaceSecondary} />
        </Pressable>

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
                {m.key !== "history" && (
                  <Text style={[styles.modCount, (!m.count || m.count === 0) && styles.modEmpty]}>{countLabel(m.count)}</Text>
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
  logCard: {
    minHeight: 86,
    borderRadius: radius.xl,
    backgroundColor: colors.onSurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logCopy: { flex: 1 },
  logTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.surfaceSecondary,
    fontFamily: fonts.text,
  },
  logSubtitle: {
    marginTop: 3,
    fontSize: fontSize.sm,
    lineHeight: 18,
    color: "rgba(255,255,255,0.68)",
    fontFamily: fonts.text,
  },
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
  modCount: { fontSize: fontSize.sm, color: "rgba(27,27,29,0.68)", marginTop: 2, fontWeight: "700", fontFamily: fonts.text },
  modEmpty: { fontWeight: "500", color: "rgba(27,27,29,0.48)" },
});
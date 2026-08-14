import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { Card, GradientCard, Title, Muted, ProgressBar, PrimaryButton, Tag } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useLog } from "@/src/components/LogProvider";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Medication, Symptom, LabTest } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts, gradients, statusColor } from "@/src/theme";

const COMPANION_IMG =
  "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHNvZnQlMjAzZCUyMHNoYXBlcyUyMHdhcm18ZW58MHx8fHwxNzg0ODMwMjc2fDA&ixlib=rb-4.1.0&q=85";

const WIDGET_LABELS: Record<string, { ru: string; en: string; icon: any }> = {
  companion: { ru: "Спутник Аида", en: "Aida companion", icon: "heart-outline" },
  readiness: { ru: "Готовность аналитики", en: "Analytics readiness", icon: "analytics-outline" },
  next_medication: { ru: "Ближайшее лекарство", en: "Next medication", icon: "medkit-outline" },
  recent_symptom: { ru: "Последний симптом", en: "Recent symptom", icon: "pulse-outline" },
  latest_lab: { ru: "Последний анализ", en: "Latest lab result", icon: "water-outline" },
  quests: { ru: "Квесты", en: "Quests", icon: "trophy-outline" },
  quick_note: { ru: "Быстрая заметка", en: "Quick note", icon: "create-outline" },
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, activeProfile, refreshTick } = useApp();
  const { t, lang } = useI18n();
  const { openMenu, openLab, toast } = useLog();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readiness, setReadiness] = useState<{ overall: number; scores: Record<string, number> } | null>(null);
  const [game, setGame] = useState<any>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [labs, setLabs] = useState<LabTest[]>([]);
  const [widgets, setWidgets] = useState<{ id: string; enabled: boolean; order: number }[]>([]);
  const [customize, setCustomize] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      const [r, g, m, s, l, p] = await Promise.all([
        api.readiness(activeId),
        api.gamification(activeId),
        api.listMeds(activeId),
        api.listSymptoms(activeId),
        api.listLabs(activeId),
        api.getPuzzle(activeId),
      ]);
      setReadiness(r);
      setGame(g);
      setMeds(m);
      setSymptoms(s);
      setLabs(l);
      setWidgets((p.widgets || []).sort((a: any, b: any) => a.order - b.order));
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load, refreshTick])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleWidget = async (id: string) => {
    const next = widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    setWidgets(next);
    if (activeId) await api.savePuzzle(activeId, next).catch(() => {});
  };

  const { inRange, outRange } = useMemo(() => {
    let inR = 0;
    let outR = 0;
    labs.forEach((l) =>
      l.biomarkers.forEach((b) => {
        if (b.status === "high" || b.status === "low") outR += 1;
        else if (b.status === "normal") inR += 1;
      })
    );
    return { inRange: inR, outRange: outR };
  }, [labs]);

  const activeMed = meds.find((m) => m.active) || meds[0];
  const lastSymptom = symptoms[0];
  const lastLab = labs[0];
  const readinessOn = widgets.find((w) => w.id === "readiness")?.enabled ?? true;

  const renderWidget = (id: string) => {
    switch (id) {
      case "readiness":
        return null; // rendered in hero
      case "companion":
        return <CompanionWidget key={id} game={game} />;
      case "next_medication":
        return (
          <Card key={id} testID="widget-medication" style={styles.halfCard}>
            <WidgetHeader icon="medkit-outline" label={t("next_medication")} />
            {activeMed ? (
              <>
                <Title numberOfLines={1}>{activeMed.name}</Title>
                <Muted style={{ marginTop: 2 }} numberOfLines={1}>
                  {[activeMed.dose, activeMed.schedule].filter(Boolean).join(" · ") || "—"}
                </Muted>
              </>
            ) : (
              <Muted>{t("no_active_meds")}</Muted>
            )}
          </Card>
        );
      case "recent_symptom":
        return (
          <Card key={id} testID="widget-symptom" style={styles.halfCard}>
            <WidgetHeader icon="pulse-outline" label={t("recent_symptom")} />
            {lastSymptom ? (
              <>
                <Title numberOfLines={1}>{lastSymptom.name}</Title>
                <View style={styles.sevInline}>
                  <View style={styles.sevBadge}>
                    <Text style={styles.sevBadgeText}>{lastSymptom.severity}/10</Text>
                  </View>
                </View>
              </>
            ) : (
              <Muted>{t("none_yet")}</Muted>
            )}
          </Card>
        );
      case "latest_lab":
        return (
          <Card key={id} testID="widget-lab">
            <WidgetHeader icon="water-outline" label={t("latest_lab")} />
            {lastLab ? (
              <>
                <Title>{lastLab.title}</Title>
                <Muted style={{ marginTop: 2 }}>
                  {lastLab.date} · {lastLab.biomarkers.length} {t("biomarkers")}
                </Muted>
                <View style={styles.bioTags}>
                  {lastLab.biomarkers.slice(0, 3).map((b, i) => (
                    <View key={i} style={styles.bioTag}>
                      <View style={[styles.dot, { backgroundColor: statusColor(b.status) }]} />
                      <Text style={styles.bioTagText}>
                        {b.name} {b.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Muted>{t("none_yet")}</Muted>
            )}
          </Card>
        );
      case "quests":
        return (
          <Card key={id} testID="widget-quests">
            <WidgetHeader icon="trophy-outline" label={t("quests")} />
            {(game?.quests || []).map((q: any) => (
              <View key={q.id} style={styles.questRow}>
                <Ionicons
                  name={q.done ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={q.done ? colors.success : colors.onSurfaceSecondary}
                />
                <Text style={[styles.questText, q.done && styles.questDone]}>
                  {lang === "ru" ? q.title : q.title_en}
                </Text>
                <Tag label={`+${q.xp}`} />
              </View>
            ))}
          </Card>
        );
      case "quick_note":
        return (
          <Card key={id} testID="widget-note" onPress={openMenu}>
            <WidgetHeader icon="create-outline" label={t("quick_note")} />
            <Muted>{lang === "ru" ? "Нажмите, чтобы записать данные" : "Tap to log data"}</Muted>
          </Card>
        );
      default:
        return null;
    }
  };

  // pair half-width widgets side by side
  const enabledWidgets = widgets.filter((w) => w.enabled && w.id !== "readiness");
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < enabledWidgets.length; i++) {
    const w = enabledWidgets[i];
    const isHalf = w.id === "next_medication" || w.id === "recent_symptom";
    const nextW = enabledWidgets[i + 1];
    const nextHalf = nextW && (nextW.id === "next_medication" || nextW.id === "recent_symptom");
    if (isHalf && nextHalf) {
      rows.push(
        <View key={`row-${i}`} style={styles.halfRow}>
          {renderWidget(w.id)}
          {renderWidget(nextW!.id)}
        </View>
      );
      i++;
    } else {
      rows.push(renderWidget(w.id));
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar subtitle={`${t("hello")}, ${activeProfile?.name || ""} · ${t("home_subtitle")}`} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.onSurface} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.onSurface} />}
        >
          {/* Stat strip */}
          <View style={styles.statStrip}>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{inRange}</Text>
              <View style={[styles.statTag, { backgroundColor: colors.accent }]}>
                <Text style={styles.statTagText}>{lang === "ru" ? "В норме" : "In range"}</Text>
              </View>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statNum}>{outRange}</Text>
              <View style={[styles.statTag, { backgroundColor: "#F6D8CE" }]}>
                <Text style={[styles.statTagText, { color: colors.error }]}>
                  {lang === "ru" ? "Вне нормы" : "Out of range"}
                </Text>
              </View>
            </View>
          </View>

          {/* Hero readiness (biological-age style) */}
          {readinessOn && (
            <GradientCard gradient={gradients.warm} style={styles.hero} testID="hero-readiness">
              <Text style={styles.heroLabel}>{t("readiness")}</Text>
              <Text style={styles.heroNum}>{readiness?.overall ?? 0}%</Text>
              <Text style={styles.heroSub}>{t("readiness_hint")}</Text>
              <View style={styles.heroBar}>
                <View style={{ width: `${readiness?.overall ?? 0}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 3 }} />
              </View>
            </GradientCard>
          )}

          {/* Upload + connect row */}
          <View style={styles.dualRow}>
            <Card style={styles.dualCard} onPress={() => openLab()} testID="upload-records-card">
              <View style={styles.plusRow}>
                <Ionicons name="cloud-upload-outline" size={22} color={colors.onSurface} />
                <View style={styles.plusBtn}>
                  <Ionicons name="add" size={18} color={colors.onSurface} />
                </View>
              </View>
              <Text style={styles.dualTitle}>{t("upload_lab")}</Text>
              <Muted numberOfLines={1}>{labs.length} {t("labs").toLowerCase()}</Muted>
            </Card>
            <GradientCard
              gradient={gradients.pink}
              style={styles.dualCard}
              onPress={() => toast(lang === "ru" ? "Подключение устройств — скоро" : "Device sync — coming soon")}
              testID="connect-device-card"
            >
              <View style={styles.plusRow}>
                <Ionicons name="watch-outline" size={22} color={colors.onSurface} />
                <View style={styles.plusBtn}>
                  <Ionicons name="add" size={18} color={colors.onSurface} />
                </View>
              </View>
              <Text style={styles.dualTitle}>{lang === "ru" ? "Подключить устройство" : "Connect tracker"}</Text>
              <Muted numberOfLines={1} style={{ color: "rgba(27,27,29,0.55)" }}>
                Apple Watch · Xiaomi
              </Muted>
            </GradientCard>
          </View>

          <View style={{ gap: spacing.md, marginTop: spacing.md }}>{rows}</View>

          <Pressable style={styles.customizeBtn} onPress={() => setCustomize(true)} testID="customize-button">
            <Ionicons name="options-outline" size={18} color={colors.onSurface} />
            <Text style={styles.customizeText}>{t("customize")}</Text>
          </Pressable>
        </ScrollView>
      )}

      <View style={[styles.fabWrap, { bottom: insets.bottom + 74 }]}>
        <PrimaryButton label={t("log_data")} icon="add" onPress={openMenu} testID="log-data-button" />
      </View>

      <Sheet visible={customize} onClose={() => setCustomize(false)} testID="customize-sheet" scroll>
        <Text style={styles.customizeTitle}>{t("customize")}</Text>
        <Muted style={{ marginBottom: spacing.lg }}>{t("customize_hint")}</Muted>
        {widgets.map((w) => {
          const meta = WIDGET_LABELS[w.id];
          if (!meta) return null;
          return (
            <View key={w.id} style={styles.toggleRow}>
              <Ionicons name={meta.icon} size={20} color={colors.onSurface} />
              <Text style={styles.toggleLabel}>{lang === "ru" ? meta.ru : meta.en}</Text>
              <Switch
                testID={`toggle-${w.id}`}
                value={w.enabled}
                onValueChange={() => toggleWidget(w.id)}
                trackColor={{ true: colors.accent, false: colors.surfaceTertiary }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}

const WidgetHeader: React.FC<{ icon: any; label: string }> = ({ icon, label }) => (
  <View style={styles.widgetHeader}>
    <Ionicons name={icon} size={15} color={colors.onSurfaceSecondary} />
    <Text style={styles.widgetHeaderText}>{label}</Text>
  </View>
);

const CompanionWidget: React.FC<{ game: any }> = ({ game }) => {
  const { t } = useI18n();
  const pct = game ? (game.xp_in_level / game.next_threshold) * 100 : 0;
  return (
    <GradientCard gradient={gradients.lime} testID="widget-companion">
      <View style={styles.companionRow}>
        <Image source={{ uri: COMPANION_IMG }} style={styles.companionImg} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.companionName}>{t("companion")}</Text>
          <View style={styles.levelRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{t("level")} {game?.level ?? 1}</Text>
            </View>
            <Text style={styles.xpText}>{game?.xp ?? 0} XP</Text>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <View style={styles.companionBar}>
              <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.onSurface, borderRadius: 4 }} />
            </View>
          </View>
          <Text style={styles.companionHint}>
            {game?.xp_to_next ?? 0} {t("xp_to_next")} {(game?.level ?? 1) + 1}
          </Text>
        </View>
      </View>
    </GradientCard>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statStrip: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  statNum: { fontSize: fontSize["4xl"], fontWeight: "800", color: colors.onSurface, letterSpacing: -1, fontFamily: fonts.display },
  statTag: { alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, marginTop: 4 },
  statTagText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onAccent, fontFamily: fonts.text },
  hero: { marginBottom: spacing.md, paddingVertical: spacing.xl },
  heroLabel: { fontSize: fontSize.base, fontWeight: "600", color: "rgba(27,27,29,0.6)", fontFamily: fonts.text },
  heroNum: { fontSize: 64, fontWeight: "800", color: colors.onSurface, letterSpacing: -2, marginTop: 4, fontFamily: fonts.display },
  heroSub: { fontSize: fontSize.base, color: "rgba(27,27,29,0.6)", marginTop: 2, fontFamily: fonts.text },
  heroBar: { height: 6, backgroundColor: "rgba(27,27,29,0.15)", borderRadius: 3, marginTop: spacing.lg, overflow: "hidden" },
  dualRow: { flexDirection: "row", gap: spacing.md },
  dualCard: { flex: 1, minHeight: 130, justifyContent: "space-between" },
  plusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plusBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  dualTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, marginTop: spacing.lg, fontFamily: fonts.text, letterSpacing: -0.2 },
  widgetHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  widgetHeaderText: {
    fontSize: fontSize.sm,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
    fontFamily: fonts.text,
  },
  halfRow: { flexDirection: "row", gap: spacing.md },
  halfCard: { flex: 1, minHeight: 110 },
  sevInline: { flexDirection: "row", marginTop: spacing.sm },
  sevBadge: { backgroundColor: "#F6D8CE", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  sevBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.error, fontFamily: fonts.text },
  bioTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  bioTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  bioTagText: { fontSize: fontSize.sm, color: colors.onSurface, fontFamily: fonts.text },
  dot: { width: 8, height: 8, borderRadius: 4 },
  questRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 7 },
  questText: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  questDone: { color: colors.onSurfaceSecondary, textDecorationLine: "line-through" },
  companionRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  companionImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.5)" },
  companionName: { fontSize: fontSize.lg, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4 },
  levelBadge: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
  levelBadgeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.onSurfaceInverse, fontFamily: fonts.text },
  xpText: { fontSize: fontSize.sm, fontWeight: "700", color: "rgba(27,27,29,0.6)", fontFamily: fonts.text },
  companionBar: { height: 8, backgroundColor: "rgba(27,27,29,0.15)", borderRadius: 4, overflow: "hidden" },
  companionHint: { fontSize: fontSize.sm, color: "rgba(27,27,29,0.6)", marginTop: 6, fontFamily: fonts.text },
  customizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  customizeText: { fontSize: fontSize.base, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.text },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  customizeTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, fontFamily: fonts.display },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  toggleLabel: { flex: 1, fontSize: fontSize.lg, color: colors.onSurface, fontFamily: fonts.text },
});

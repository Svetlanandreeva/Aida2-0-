import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { Muted, PrimaryButton, Chip } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, Task } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const TYPE_ICON: Record<string, any> = {
  medication: "medkit-outline",
  pressure: "heart-outline",
  lab: "water-outline",
  upload: "cloud-upload-outline",
  diary: "create-outline",
  visit: "medical-outline",
  custom: "ellipse-outline",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, refreshTick, bumpRefresh } = useApp();
  const { t, lang } = useI18n();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("custom");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      setTasks(await api.listTasks(activeId));
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load, refreshTick]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async (id: string) => {
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
    await api.toggleTask(id).catch(() => {});
    bumpRefresh();
  };

  const del = async (id: string) => {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    await api.deleteTask(id).catch(() => {});
  };

  const save = async () => {
    if (!title.trim() || !activeId) return;
    setSaving(true);
    try {
      await api.createTask({ profile_id: activeId, title: title.trim(), kind, due: todayStr() });
      setTitle("");
      setKind("custom");
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const td = todayStr();
  const active = tasks.filter((x) => !x.done);
  const today = active.filter((x) => (x.due || "").slice(0, 10) <= td);
  const upcoming = active.filter((x) => (x.due || "").slice(0, 10) > td);
  const done = tasks.filter((x) => x.done);

  const renderTask = (task: Task) => (
    <View key={task.id} style={styles.taskRow} testID={`task-${task.id}`}>
      <Pressable onPress={() => toggle(task.id)} hitSlop={8} testID={`toggle-task-${task.id}`}>
        <Ionicons
          name={task.done ? "checkmark-circle" : "ellipse-outline"}
          size={26}
          color={task.done ? colors.success : colors.onSurfaceSecondary}
        />
      </Pressable>
      <View style={styles.taskIcon}>
        <Ionicons name={TYPE_ICON[task.kind] || TYPE_ICON.custom} size={16} color={colors.onSurface} />
      </View>
      <Text style={[styles.taskTitle, task.done && styles.taskDone]} numberOfLines={2}>
        {task.title}
      </Text>
      <Pressable onPress={() => del(task.id)} hitSlop={8} testID={`delete-task-${task.id}`}>
        <Ionicons name="trash-outline" size={18} color={colors.onSurfaceSecondary} />
      </Pressable>
    </View>
  );

  const Section: React.FC<{ label: string; items: Task[] }> = ({ label, items }) =>
    items.length ? (
      <View style={{ marginBottom: spacing.xl }}>
        <Text style={styles.sectionLabel}>{label} · {items.length}</Text>
        <View style={styles.sectionCard}>{items.map(renderTask)}</View>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar subtitle={t("tab_tasks")} />
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
          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: spacing.md }}>{t("tasks_empty")}</Muted>
            </View>
          ) : (
            <>
              <Section label={t("tasks_today")} items={today} />
              <Section label={t("tasks_upcoming")} items={upcoming} />
              <Section label={t("tasks_done")} items={done} />
            </>
          )}
        </ScrollView>
      )}

      <View style={[styles.fabWrap, { bottom: insets.bottom + 74 }]}>
        <PrimaryButton label={t("add_task")} icon="add" onPress={() => setOpen(true)} testID="add-task-button" />
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} testID="task-sheet" scroll>
        <Text style={styles.sheetTitle}>{t("add_task")}</Text>
        <Text style={styles.fieldLabel}>{t("task_title")}</Text>
        <TextInput
          testID="task-title-input"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>{t("task_type")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
          {[
            { k: "medication", l: t("m_meds") },
            { k: "pressure", l: t("measure_pressure") },
            { k: "diary", l: t("fill_diary") },
            { k: "lab", l: t("m_labs") },
            { k: "visit", l: lang === "ru" ? "Приём врача" : "Doctor visit" },
            { k: "custom", l: lang === "ru" ? "Другое" : "Other" },
          ].map((o) => (
            <Chip key={o.k} label={o.l} active={kind === o.k} onPress={() => setKind(o.k)} testID={`task-kind-${o.k}`} />
          ))}
        </ScrollView>
        <PrimaryButton label={t("save")} onPress={save} loading={saving} testID="save-task" style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: spacing["3xl"] },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    fontFamily: fonts.text,
  },
  sectionCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  taskIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  taskTitle: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontWeight: "500", fontFamily: fonts.text },
  taskDone: { color: colors.onSurfaceSecondary, textDecorationLine: "line-through" },
  fabWrap: { position: "absolute", left: spacing.lg, right: spacing.lg },
  sheetTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg, fontFamily: fonts.display },
  fieldLabel: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, marginBottom: spacing.sm, fontWeight: "600", fontFamily: fonts.text },
  input: {
    height: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.text,
  },
});

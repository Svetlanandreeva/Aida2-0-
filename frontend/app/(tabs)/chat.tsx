import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "@/src/components/TopBar";
import { useApp } from "@/src/store";
import { useI18n } from "@/src/i18n";
import { api, ChatMsg } from "@/src/api";
import { colors, spacing, radius, fontSize, fonts } from "@/src/theme";

const AIDA_IMG =
  "https://images.unsplash.com/photo-1622547748225-3fc4abd2cca0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHNvZnQlMjAzZCUyMHNoYXBlcyUyMHdhcm18ZW58MHx8fHwxNzg0ODMwMjc2fDA&ixlib=rb-4.1.0&q=85";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { activeId, activeProfile, refreshTick } = useApp();
  const { t, lang } = useI18n();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!activeId) return;
    try {
      const msgs = await api.listChat(activeId);
      setMessages(msgs);
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

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  const send = async (text: string) => {
    if (!text.trim() || !activeId || sending) return;
    setInput("");
    const optimistic: ChatMsg = { id: `tmp-${Date.now()}`, profile_id: activeId, role: "user", text };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    scrollDown();
    try {
      const res = await api.sendChat(activeId, text, lang);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        res.user,
        res.assistant,
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, profile_id: activeId, role: "assistant", text: lang === "ru" ? "Не удалось получить ответ. Попробуйте ещё раз." : "Could not get a response. Please try again." },
      ]);
    } finally {
      setSending(false);
      scrollDown();
    }
  };

  const clear = async () => {
    if (!activeId) return;
    await api.clearChat(activeId);
    setMessages([]);
  };

  const starters = [t("starter_1"), t("starter_2"), t("starter_3")];
  const showEmpty = !loading && messages.length === 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TopBar />
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>{t("tab_chat")}</Text>
          {messages.length > 0 && (
            <Pressable onPress={clear} testID="clear-chat" hitSlop={10} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.onSurfaceSecondary} />
              <Text style={styles.clearText}>{t("clear_chat")}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.top + 96}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}
          onContentSizeChange={scrollDown}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: spacing["2xl"] }} />
          ) : (
            <>
              <View style={styles.greetRow}>
                <Image source={{ uri: AIDA_IMG }} style={styles.aidaAvatar} contentFit="cover" />
                <View style={[styles.bubble, styles.bubbleAida, { flex: 1 }]}>
                  <Text style={styles.bubbleTextAida}>{t("aida_greeting")}</Text>
                </View>
              </View>

              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[styles.msgRow, m.role === "user" ? styles.rowRight : styles.rowLeft]}
                >
                  {m.role === "assistant" && (
                    <Image source={{ uri: AIDA_IMG }} style={styles.aidaAvatarSm} contentFit="cover" />
                  )}
                  <View style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAida]}>
                    <Text style={m.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAida}>{m.text}</Text>
                  </View>
                </View>
              ))}

              {sending && (
                <View style={[styles.msgRow, styles.rowLeft]}>
                  <Image source={{ uri: AIDA_IMG }} style={styles.aidaAvatarSm} contentFit="cover" />
                  <View style={[styles.bubble, styles.bubbleAida]}>
                    <Text style={styles.typingText}>{t("aida_thinking")}</Text>
                  </View>
                </View>
              )}

              {showEmpty && (
                <View style={styles.starters}>
                  {starters.map((s, i) => (
                    <Pressable key={i} style={styles.starterChip} onPress={() => send(s)} testID={`starter-${i}`}>
                      <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.brand} />
                      <Text style={styles.starterText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Text style={styles.disclaimer}>{t("chat_disclaimer")}</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="chat-input"
              value={input}
              onChangeText={setInput}
              placeholder={t("chat_placeholder")}
              placeholderTextColor={colors.onSurfaceSecondary}
              style={styles.input}
              multiline
              onSubmitEditing={() => send(input)}
            />
            <Pressable
              testID="chat-send"
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  pageTitle: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.onSurface, fontFamily: fonts.display },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText: { fontSize: fontSize.sm, color: colors.onSurfaceSecondary, fontFamily: fonts.text },
  greetRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" },
  aidaAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary },
  aidaAvatarSm: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary },
  msgRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end", maxWidth: "100%" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", padding: spacing.md, borderRadius: radius.lg },
  bubbleAida: { backgroundColor: colors.brandTertiary, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderTopRightRadius: 4 },
  bubbleTextAida: { fontSize: fontSize.base, color: colors.onSurface, lineHeight: 21, fontFamily: fonts.text },
  bubbleTextUser: { fontSize: fontSize.base, color: colors.onSurface, lineHeight: 21, fontFamily: fonts.text },
  typingText: { fontSize: fontSize.base, color: colors.onSurfaceSecondary, fontStyle: "italic", fontFamily: fonts.text },
  starters: { gap: spacing.sm, marginTop: spacing.lg },
  starterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  starterText: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: fonts.text },
  inputBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclaimer: { fontSize: 11, color: colors.onSurfaceSecondary, textAlign: "center", marginBottom: 6, fontFamily: fonts.text },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontSize: fontSize.lg,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.text,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});

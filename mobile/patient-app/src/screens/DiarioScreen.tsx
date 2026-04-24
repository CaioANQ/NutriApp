// mobile/patient-app/src/screens/DiarioScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GREEN = '#0A2E20';
const MINT = '#B8DECA';
const GOLD = '#C9963A';

const EMOJIS = [
  { emoji: '😊', label: 'Bem-disposto(a)' },
  { emoji: '😄', label: 'Ótimo!' },
  { emoji: '😐', label: 'Neutro' },
  { emoji: '😔', label: 'Triste' },
  { emoji: '😢', label: 'Choroso(a)' },
  { emoji: '😤', label: 'Estressado(a)' },
  { emoji: '😴', label: 'Cansado(a)' },
  { emoji: '💪', label: 'Com energia!' },
  { emoji: '🤒', label: 'Doente' },
  { emoji: '😰', label: 'Ansioso(a)' },
];

const MAX_CHARS = 300;

interface DiaryEntry {
  id: string;
  text: string;
  moodEmoji: string | null;
  createdAt: string;
}

export function DiarioScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' });

  useEffect(() => {
    loadTodayEntry();
  }, []);

  async function loadTodayEntry() {
    try {
      const data = await apiGet<DiaryEntry | null>(`/diary/today`);
      if (data) {
        setEntry(data);
        setText(data.text);
        setEmoji(data.moodEmoji ?? '');
      }
    } catch {
      // Sem entrada hoje — normal
    } finally {
      setIsLoading(false);
    }
  }

  async function saveEntry() {
    if (!text.trim() && !emoji) {
      Alert.alert('Atenção', 'Escreva algo ou selecione um emoji antes de salvar.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await apiPost<DiaryEntry>('/diary', {
        text: text.trim(),
        moodEmoji: emoji || null,
      });
      setEntry(saved);
      Alert.alert('✅ Salvo!', 'Seu diário do dia foi registrado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error ?? 'Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  const isSaved = !!entry;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Data */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>📖 {today}</Text>
      </View>

      {/* Aviso LGPD / privacidade */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          <Text style={styles.noticeBold}>ℹ️ Diário pessoal</Text>
          {' '}— Este registro é confidencial e poderá ser visualizado pela sua nutricionista para acompanhamento clínico. Não é um canal de comunicação direta.
        </Text>
      </View>

      {isSaved ? (
        /* ── Modo leitura (já salvo hoje) ── */
        <View style={styles.savedCard}>
          <Text style={styles.savedTitle}>✅ Diário de hoje registrado</Text>
          {entry.moodEmoji && (
            <Text style={styles.savedEmoji}>{entry.moodEmoji}</Text>
          )}
          <Text style={styles.savedText}>{entry.text}</Text>
          <Text style={styles.savedTime}>
            Salvo em {new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.onePerDayNotice}>
            <Text style={styles.onePerDayText}>
              🔒 Apenas um registro por dia é permitido. Volte amanhã para fazer um novo registro.
            </Text>
          </View>
        </View>
      ) : (
        /* ── Modo edição ── */
        <View>
          {/* Emoji selector */}
          <Text style={styles.sectionLabel}>Como você está se sentindo hoje?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
            <View style={styles.emojiRow}>
              {EMOJIS.map(({ emoji: e, label }) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEmoji((prev) => prev === e ? '' : e)}
                  style={[styles.emojiBtn, emoji === e && styles.emojiBtnSel]}
                  accessibilityLabel={label}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                  {emoji === e && (
                    <Text style={styles.emojiLabel}>{label}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Textarea */}
          <Text style={styles.sectionLabel}>Escreva como se sente (opcional)</Text>
          <TextInput
            style={[styles.textarea, isOverLimit && styles.textareaError]}
            multiline
            maxLength={MAX_CHARS + 50} // js controla o max
            placeholder="Descreva seu humor, energia, como foi o dia, como se sentiu com a alimentação..."
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_CHARS))}
            returnKeyType="default"
            textAlignVertical="top"
          />
          <View style={styles.charRow}>
            <Text style={[styles.charCount, isOverLimit && styles.charCountError]}>
              {charCount}/{MAX_CHARS} caracteres
            </Text>
          </View>

          {/* Não é comunicação */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💬 Este campo <Text style={styles.infoTextBold}>não</Text> é uma mensagem para a nutricionista. É apenas um registro pessoal do seu bem-estar diário.
            </Text>
          </View>

          {/* Botão salvar */}
          <TouchableOpacity
            style={[styles.saveBtn, (isSaving || (!text.trim() && !emoji)) && styles.saveBtnDisabled]}
            onPress={saveEntry}
            disabled={isSaving || (!text.trim() && !emoji)}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Salvar diário do dia</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.signature}>Projeto por Caio César · @CaioANQ</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE9', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateRow: { marginBottom: 12 },
  dateText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  noticeBox: {
    backgroundColor: '#FDF3E0', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(201,150,58,0.3)',
  },
  noticeText: { fontSize: 12, color: '#633806', lineHeight: 18 },
  noticeBold: { fontWeight: '700', color: '#854F0B' },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  emojiScroll: { marginBottom: 16 },
  emojiRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  emojiBtn: {
    padding: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#fff', alignItems: 'center', minWidth: 48,
  },
  emojiBtnSel: { borderColor: GREEN, backgroundColor: '#E8F5EE' },
  emojiText: { fontSize: 24 },
  emojiLabel: { fontSize: 9, color: GREEN, marginTop: 2, textAlign: 'center', fontWeight: '500' },
  textarea: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    padding: 12, fontSize: 14, color: '#111827', minHeight: 100, lineHeight: 20,
  },
  textareaError: { borderColor: '#EF4444' },
  charRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4, marginBottom: 12 },
  charCount: { fontSize: 11, color: '#9CA3AF' },
  charCountError: { color: '#EF4444' },
  infoBox: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(22,163,74,0.2)',
  },
  infoText: { fontSize: 12, color: '#166534', lineHeight: 18 },
  infoTextBold: { fontWeight: '700' },
  saveBtn: {
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  savedCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  savedTitle: { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 10 },
  savedEmoji: { fontSize: 36, marginBottom: 8, textAlign: 'center' },
  savedText: { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 10 },
  savedTime: { fontSize: 11, color: '#9CA3AF' },
  onePerDayNotice: {
    marginTop: 14, backgroundColor: '#F0FDF4', borderRadius: 8,
    padding: 10, borderWidth: 0.5, borderColor: 'rgba(22,163,74,0.2)',
  },
  onePerDayText: { fontSize: 11, color: '#166534', lineHeight: 16 },
  signature: { marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9CA3AF' },
});

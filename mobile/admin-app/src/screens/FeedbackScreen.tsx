// mobile/admin-app/src/screens/FeedbackScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../services/api';

const GREEN = '#0A2E20';
const SAGE = '#3D6B52';

interface DiaryFeedback {
  id: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  patientColor: string;
  patientBg: string;
  text: string;
  moodEmoji: string | null;
  entryDate: string;
  isReadByAdmin: boolean;
  createdAt: string;
}

export function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<DiaryFeedback[]>([]);
  const [selected, setSelected] = useState<DiaryFeedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<DiaryFeedback[]>('/diary/all-for-admin');
      setEntries(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os feedbacks.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setIsSending(true);
    try {
      await apiPost('/feedback', {
        patientId: selected.patientId,
        text: replyText.trim(),
      });
      setReplyText('');
      Alert.alert('✅ Resposta enviada!', `${selected.patientName} receberá sua mensagem no app.`);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a resposta.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={GREEN} size="large" /></View>;
  }

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={styles.detailContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Voltar */}
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        {/* Header do paciente */}
        <View style={styles.detailHeader}>
          <View style={[styles.avatarLg, { backgroundColor: selected.patientBg }]}>
            <Text style={[styles.avatarTextLg, { color: selected.patientColor }]}>{selected.patientInitials}</Text>
          </View>
          <View>
            <Text style={styles.detailPatientName}>{selected.patientName} {selected.moodEmoji ?? ''}</Text>
            <Text style={styles.detailDate}>
              {new Date(selected.entryDate).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* Aviso diário */}
        <View style={styles.diaryNotice}>
          <Text style={styles.diaryNoticeText}>
            📖 <Text style={{ fontWeight: '700' }}>Entrada do diário pessoal</Text> — este registro foi feito pelo paciente no diário do app, não é uma mensagem direta.
          </Text>
        </View>

        {/* Texto do diário */}
        <View style={styles.diaryTextBox}>
          <Text style={styles.diaryText}>{selected.text}</Text>
        </View>

        {/* Resposta */}
        <Text style={styles.replyLabel}>Responder ao paciente (via mensagem no app):</Text>
        <TextInput
          style={styles.replyInput}
          multiline
          placeholder="Escreva sua orientação ou resposta..."
          placeholderTextColor="#9CA3AF"
          value={replyText}
          onChangeText={setReplyText}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!replyText.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={sendReply}
          disabled={!replyText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>📤 Enviar resposta</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.signature}>Projeto por Caio César · @CaioANQ</Text>
        <View style={{ height: insets.bottom }} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Aviso geral */}
      <View style={styles.headerNotice}>
        <Text style={styles.headerNoticeText}>
          📖 Entradas do <Text style={{ fontWeight: '700' }}>diário pessoal</Text> dos pacientes são exibidas para acompanhamento clínico.
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>💬</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center' }}>
            Nenhum diário registrado ainda.{'\n'}Os registros dos pacientes aparecerão aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          ListFooterComponent={<Text style={styles.signature}>Projeto por Caio César · @CaioANQ</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.entryCard, !item.isReadByAdmin && styles.entryCardUnread]}
              onPress={() => setSelected(item)}
            >
              <View style={styles.entryTop}>
                <View style={[styles.avatar, { backgroundColor: item.patientBg }]}>
                  <Text style={[styles.avatarText, { color: item.patientColor }]}>{item.patientInitials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.entryNameRow}>
                    <Text style={styles.entryName}>{item.patientName}</Text>
                    {!item.isReadByAdmin && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>NOVO</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 20 }}>{item.moodEmoji ?? ''}</Text>
                  </View>
                  <Text style={styles.entryDate}>
                    {new Date(item.entryDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.entryPreview} numberOfLines={2}>{item.text}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerNotice: {
    backgroundColor: '#FDF3E0', borderBottomWidth: 0.5, borderBottomColor: 'rgba(201,150,58,0.3)',
    padding: 12, paddingHorizontal: 16,
  },
  headerNoticeText: { fontSize: 12, color: '#633806', lineHeight: 18 },
  entryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#E5E7EB',
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  entryCardUnread: { borderLeftColor: SAGE },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryName: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  entryDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  unreadBadge: { backgroundColor: '#E8F5EE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  unreadBadgeText: { fontSize: 9, color: SAGE, fontWeight: '700' },
  entryPreview: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  // Detail
  detailContainer: { flex: 1, backgroundColor: '#F2EFE9', padding: 16 },
  backBtn: { marginBottom: 14 },
  backText: { fontSize: 14, color: GREEN, fontWeight: '600' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  avatarLg: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarTextLg: { fontSize: 15, fontWeight: '700' },
  detailPatientName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  detailDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  diaryNotice: {
    backgroundColor: '#E8F5EE', borderRadius: 8, padding: 10, marginBottom: 12,
    borderWidth: 0.5, borderColor: 'rgba(61,107,82,0.2)',
  },
  diaryNoticeText: { fontSize: 12, color: SAGE, lineHeight: 18 },
  diaryTextBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: '#E5E7EB' },
  diaryText: { fontSize: 14, color: '#111827', lineHeight: 22 },
  replyLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  replyInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
    padding: 12, fontSize: 14, color: '#111827', minHeight: 100, lineHeight: 20, marginBottom: 12,
  },
  sendBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  signature: { marginTop: 14, textAlign: 'center', fontSize: 11, color: '#9CA3AF' },
});

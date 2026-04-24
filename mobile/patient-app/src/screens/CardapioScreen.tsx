// mobile/patient-app/src/screens/CardapioScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const GREEN = '#0A2E20';
const SAGE = '#3D6B52';

interface MealPlanItem {
  id: string;
  mealName: string;
  quantityG: number;
  tacoFood: {
    name: string;
    kcalPer100g: number;
    carbsPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    fiberPer100g: number;
  };
}

interface TodayData {
  mealPlanItems: MealPlanItem[];
  checkedFoodIds: number[];
  waterConsumedMl: number;
  targetKcal: number;
  waterTargetMl: number;
}

function calcMacros(items: MealPlanItem[], checkedIds: number[]) {
  const checked = items.filter((i) => checkedIds.includes(parseInt(i.id)));
  return checked.reduce(
    (acc, item) => {
      const scale = item.quantityG / 100;
      acc.kcal += item.tacoFood.kcalPer100g * scale;
      acc.carbs += item.tacoFood.carbsPer100g * scale;
      acc.protein += item.tacoFood.proteinPer100g * scale;
      acc.fat += item.tacoFood.fatPer100g * scale;
      acc.fiber += item.tacoFood.fiberPer100g * scale;
      return acc;
    },
    { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 },
  );
}

export function CardapioScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const today = await apiGet<TodayData>('/diary/today-cardapio');
      setData(today);
      setCheckedIds(today.checkedFoodIds ?? []);
      setWaterMl(today.waterConsumedMl ?? 0);
    } catch {
      // Se não houver plano, mostrar vazio
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleFood = async (itemId: number) => {
    const newIds = checkedIds.includes(itemId)
      ? checkedIds.filter((id) => id !== itemId)
      : [...checkedIds, itemId];
    setCheckedIds(newIds);
    try {
      await apiPost('/diary/check', { checkedFoodIds: newIds, waterConsumedMl: waterMl });
    } catch { /* silently fail, state will revert on next load */ }
  };

  const addWater = async (glasses: number) => {
    const ml = glasses * 250;
    setWaterMl(ml);
    try {
      await apiPost('/diary/check', { checkedFoodIds: checkedIds, waterConsumedMl: ml });
    } catch {}
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={GREEN} size="large" /></View>;
  }

  const targetKcal = data?.targetKcal ?? user?.profile?.targetKcal ?? 1800;
  const waterTarget = data?.waterTargetMl ?? 2000;
  const items = data?.mealPlanItems ?? [];
  const macros = calcMacros(items, checkedIds);
  const kcalPct = Math.min(1, macros.kcal / targetKcal);
  const waterGlasses = Math.round(waterMl / 250);
  const waterTargetGlasses = Math.round(waterTarget / 250);
  const meals = [...new Set(items.map((i) => i.mealName))];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={GREEN} />}
    >
      {/* Hero calórico */}
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroGreet}>Olá, {user?.profile?.name?.split(' ')[0]} 🌿</Text>
          <Text style={styles.heroKcal}>
            {Math.round(macros.kcal)}{' '}
            <Text style={styles.heroKcalSub}>/ {targetKcal} kcal</Text>
          </Text>
          <Text style={styles.heroSub}>CONSUMIDO HOJE</Text>
        </View>
        {/* Anel de progresso simples */}
        <View style={styles.ringWrap}>
          <View style={[styles.ring, { borderColor: '#B8DECA' }]}>
            <Text style={styles.ringPct}>{Math.round(kcalPct * 100)}%</Text>
            <Text style={styles.ringLbl}>da meta</Text>
          </View>
        </View>
      </View>

      {/* Macros strip */}
      <View style={styles.macroStrip}>
        {[
          { label: 'Carbos', value: Math.round(macros.carbs) + 'g', color: '#C9963A' },
          { label: 'Proteína', value: Math.round(macros.protein) + 'g', color: '#B85C38' },
          { label: 'Lipídios', value: Math.round(macros.fat) + 'g', color: '#185FA5' },
          { label: 'Fibras', value: Math.round(macros.fiber) + 'g', color: SAGE },
        ].map((m) => (
          <View key={m.label} style={styles.macroChip}>
            <Text style={[styles.macroVal, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.macroLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Água */}
      <View style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <Text style={styles.waterTitle}>💧 Hidratação</Text>
          <Text style={styles.waterCount}>{waterGlasses}/{waterTargetGlasses} copos · {waterMl}ml</Text>
        </View>
        <View style={styles.glassesRow}>
          {Array.from({ length: waterTargetGlasses }, (_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => addWater(i < waterGlasses ? i : i + 1)}
              style={[styles.glass, i < waterGlasses && styles.glassFilled]}
              accessibilityLabel={`Copo ${i + 1} de água`}
            >
              <Ionicons
                name={i < waterGlasses ? 'water' : 'water-outline'}
                size={16}
                color={i < waterGlasses ? '#185FA5' : '#9CA3AF'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Refeições */}
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Nenhum plano alimentar ativo.{'\n'}Entre em contato com sua nutricionista.
          </Text>
        </View>
      ) : (
        meals.map((meal) => {
          const mealItems = items.filter((i) => i.mealName === meal);
          const mealKcal = mealItems
            .filter((i) => checkedIds.includes(parseInt(i.id)))
            .reduce((s, i) => s + (i.tacoFood.kcalPer100g * i.quantityG) / 100, 0);
          return (
            <View key={meal} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealTitle}>{meal}</Text>
                {mealKcal > 0 && (
                  <Text style={styles.mealKcal}>{Math.round(mealKcal)} kcal</Text>
                )}
              </View>
              {mealItems.map((item) => {
                const id = parseInt(item.id);
                const isChecked = checkedIds.includes(id);
                const kcal = Math.round((item.tacoFood.kcalPer100g * item.quantityG) / 100);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.foodRow}
                    onPress={() => toggleFood(id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxOn]}>
                      {isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <View style={styles.foodInfo}>
                      <Text style={styles.foodName}>{item.tacoFood.name}</Text>
                      <Text style={styles.foodQty}>{item.quantityG}g</Text>
                    </View>
                    <Text style={styles.foodKcal}>{kcal} kcal</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })
      )}
      <Text style={styles.signature}>Projeto por Caio César · @CaioANQ</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2EFE9', padding: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    backgroundColor: GREEN, borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroGreet: { fontSize: 11, color: '#B8DECA', marginBottom: 4 },
  heroKcal: { fontSize: 28, fontWeight: '600', color: '#fff', lineHeight: 32 },
  heroKcalSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '400' },
  heroSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: 0.5 },
  ringWrap: { width: 70, height: 70, justifyContent: 'center', alignItems: 'center' },
  ring: {
    width: 66, height: 66, borderRadius: 33, borderWidth: 5,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  ringPct: { fontSize: 14, fontWeight: '700', color: '#fff' },
  ringLbl: { fontSize: 9, color: '#B8DECA' },
  macroStrip: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  macroChip: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#E5E7EB',
  },
  macroVal: { fontSize: 15, fontWeight: '600' },
  macroLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 2 },
  waterCard: {
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 0.5, borderColor: '#BFDBFE',
  },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  waterTitle: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  waterCount: { fontSize: 11, color: '#3B82F6' },
  glassesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  glass: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1.5,
    borderColor: '#BFDBFE', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  glassFilled: { backgroundColor: '#DBEAFE', borderColor: '#2563EB' },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#E5E7EB',
  },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  mealCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#E5E7EB',
  },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  mealTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  mealKcal: { fontSize: 11, color: SAGE, fontWeight: '500', backgroundColor: '#E8F5EE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F9FAFB' },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: '#B8DECA', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: GREEN, borderColor: GREEN },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 13, color: '#111827', fontWeight: '400' },
  foodQty: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  foodKcal: { fontSize: 12, fontWeight: '600', color: SAGE },
  signature: { marginTop: 12, textAlign: 'center', fontSize: 11, color: '#9CA3AF' },
});

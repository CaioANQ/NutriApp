// mobile/patient-app/src/navigation/AppNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { CardapioScreen } from '../screens/CardapioScreen';
import { ComprasScreen } from '../screens/ComprasScreen';
import { InfoScreen } from '../screens/InfoScreen';
import { DiarioScreen } from '../screens/DiarioScreen';
import { ExerciciosScreen } from '../screens/ExerciciosScreen';
import { SplashScreen } from '../screens/SplashScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const GREEN = '#0A2E20';
const MINT = '#B8DECA';

function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            Cardápio: focused ? 'restaurant' : 'restaurant-outline',
            Compras: focused ? 'cart' : 'cart-outline',
            Informativa: focused ? 'document-text' : 'document-text-outline',
            Diário: focused ? 'journal' : 'journal-outline',
            Exercícios: focused ? 'barbell' : 'barbell-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E5E7EB',
          paddingBottom: 8,
          paddingTop: 4,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        headerStyle: { backgroundColor: GREEN },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Cardápio" component={CardapioScreen} />
      <Tab.Screen name="Compras" component={ComprasScreen} />
      <Tab.Screen name="Informativa" component={InfoScreen} />
      <Tab.Screen name="Diário" component={DiarioScreen} />
      <Tab.Screen name="Exercícios" component={ExerciciosScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="PatientApp" component={PatientTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

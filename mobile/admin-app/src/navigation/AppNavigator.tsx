// mobile/admin-app/src/navigation/AppNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PatientsListScreen } from '../screens/PatientsListScreen';
import { PatientDetailScreen } from '../screens/PatientDetailScreen';
import { MealPlanBuilderScreen } from '../screens/MealPlanBuilderScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { AIConsultorScreen } from '../screens/AIConsultorScreen';
import { SplashScreen } from '../screens/SplashScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();

const GREEN = '#0A2E20';

function PatientsStack() {
  return (
    <PatientStack.Navigator screenOptions={{ headerStyle: { backgroundColor: GREEN }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '600' } }}>
      <PatientStack.Screen name="PacientesList" component={PatientsListScreen} options={{ title: 'Pacientes' }} />
      <PatientStack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: 'Detalhes do Paciente' }} />
      <PatientStack.Screen name="MealPlanBuilder" component={MealPlanBuilderScreen} options={{ title: 'Plano Alimentar' }} />
    </PatientStack.Navigator>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Pacientes: focused ? 'people' : 'people-outline',
            Feedback: focused ? 'chatbubbles' : 'chatbubbles-outline',
            Relatórios: focused ? 'bar-chart' : 'bar-chart-outline',
            'IA Clínica': focused ? 'sparkles' : 'sparkles-outline',
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB', paddingBottom: 8, paddingTop: 4, height: 64 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        headerStyle: { backgroundColor: GREEN },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Pacientes" component={PatientsStack} options={{ headerShown: false }} />
      <Tab.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ tabBarBadge: undefined }} // badge dinâmico via context
      />
      <Tab.Screen name="Relatórios" component={ReportsScreen} />
      <Tab.Screen name="IA Clínica" component={AIConsultorScreen} />
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
          <Stack.Screen name="AdminApp" component={AdminTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

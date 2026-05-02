import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Camera, Users, Settings } from 'lucide-react-native';

import HomeScreen from '../screens/HomeScreen';
import GuestListScreen from '../screens/GuestListScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
            letterSpacing: 1,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: 5,
            paddingTop: 5,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tab.Screen 
          name="Scan" 
          component={HomeScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
            headerTitle: 'RSVP Scanner'
          }}
        />
        <Tab.Screen 
          name="Guests" 
          component={GuestListScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
            headerTitle: 'Guest List'
          }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
            headerTitle: 'Settings'
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

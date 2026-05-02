import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useAppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import { Save } from 'lucide-react-native';

export default function SettingsScreen() {
  const { eventId, setEventId, serverUrl, setServerUrl } = useAppContext();
  const [localEventId, setLocalEventId] = useState(eventId);
  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);

  const handleSave = async () => {
    try {
      await setEventId(localEventId);
      await setServerUrl(localServerUrl);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Image 
          source={require('../../assets/images/ap-nav.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>App Configuration</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={localServerUrl}
            onChangeText={setLocalServerUrl}
            placeholder="https://aurapixel.live/rsvp"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.helperText}>Your hosted RSVP backend URL</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Event ID</Text>
          <TextInput
            style={styles.input}
            value={localEventId}
            onChangeText={setLocalEventId}
            placeholder="Enter Event ID"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>Enter the Event ID to load guests and verify QR codes</Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save color="#fff" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    height: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  form: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

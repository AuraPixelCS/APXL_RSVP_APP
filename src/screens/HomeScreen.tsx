import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import axios from 'axios';
import { CheckCircle, XCircle, Camera as CameraIcon } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAppContext } from '../context/AppContext';
import { useIsFocused } from '@react-navigation/native';

type VerificationStatus = 'idle' | 'loading' | 'success' | 'error';

export default function HomeScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  const { serverUrl, eventId } = useAppContext();
  
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [resultData, setResultData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const onObjectsScanned = useCallback(async (objects: any[]) => {
    if (status !== 'idle' || !eventId) return;
    
    const qrCode = objects.find((obj) => obj.format === 'qr-code' && obj.value);
    if (!qrCode) return;

    const qrToken = qrCode.value;

    setStatus('loading');
    
    try {
      const response = await axios.post(`${serverUrl}/api/qr/verify`, { qrToken, eventId });
      
      if (response.data.success) {
        setResultData(response.data);
        setStatus('success');
      } else {
        setErrorMessage(response.data.error || 'Validation failed');
        setStatus('error');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.response?.data?.error || err.message || 'Network error');
      setStatus('error');
    }
  }, [status, serverUrl, eventId]);

  const objectOutput = useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: onObjectsScanned,
  });

  const resetScanner = () => {
    setStatus('idle');
    setResultData(null);
    setErrorMessage('');
  };

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>No Camera found on this device</Text>
      </View>
    );
  }

  if (!eventId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>Please configure an Event ID in Settings</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        {isFocused && (status === 'idle' || status === 'loading') && (
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={status === 'idle' && isFocused}
            outputs={[objectOutput]}
          />
        )}
        
        {/* Loading Overlay */}
        {status === 'loading' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Verifying RSVP...</Text>
          </View>
        )}
        
        {/* Scanner Target Overlay */}
        {status === 'idle' && (
          <View style={styles.scannerTarget}>
            <View style={styles.scannerCutout} />
            <Text style={styles.scannerPrompt}>Scan QR Code</Text>
          </View>
        )}
      </View>

      {/* Result Bottom Sheet */}
      {(status === 'success' || status === 'error') && (
        <View style={styles.resultContainer}>
          {status === 'success' && resultData && (
            <View style={styles.resultContent}>
              <CheckCircle color={colors.success} size={64} style={styles.resultIcon} />
              <Text style={styles.successTitle}>Access Granted</Text>
              
              <View style={styles.cardInfo}>
                <Text style={styles.label}>ATTENDEE</Text>
                <Text style={styles.value}>{resultData.rsvp?.name || resultData.guest?.name}</Text>
                
                <Text style={styles.label}>SEAT NUMBER</Text>
                <Text style={styles.highlightValue}>Seat {resultData.rsvp?.seatNumber || resultData.guest?.seatNumber || 'N/A'}</Text>
                
                <Text style={styles.label}>EVENT</Text>
                <Text style={styles.value}>{resultData.event?.title || 'Unknown Event'}</Text>
              </View>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.resultContent}>
              <XCircle color={colors.error} size={64} style={styles.resultIcon} />
              <Text style={styles.errorTitle}>Access Denied</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={resetScanner}>
            <CameraIcon color="#fff" size={20} style={{marginRight: 8}} />
            <Text style={styles.resetButtonText}>Scan Next Code</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  scannerTarget: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scannerCutout: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scannerPrompt: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.primary,
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  resultContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultContent: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resultIcon: {
    marginBottom: 16,
  },
  successTitle: {
    color: colors.success,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  errorTitle: {
    color: colors.error,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorMessage: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  cardInfo: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 16,
  },
  highlightValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import axios from 'axios';
import {
  CheckCircle,
  XCircle,
  Camera as CameraIcon,
  ScanLine,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAppContext } from '../context/AppContext';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';

type ScanState = 'idle' | 'loading' | 'success' | 'error';

interface CheckInEntry {
  rsvpId: string;
  name: string;
  seatNumber: string | number | null;
  seatLabel?: string | null;
  checkedInAt: number;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOX_SIZE = Math.min(SCREEN_W * 0.82, 360);
const TOP_SPACER = SCREEN_H * 0.08;
const BARCODE_FORMATS: any = ['qr-code'];

export default function HomeScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const isFocused = useIsFocused();
  const { serverUrl, eventId } = useAppContext();

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [resultBadge, setResultBadge] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (scanState !== 'success' && scanState !== 'error') return;
    const delay = scanState === 'success' ? 1500 : 2500;
    const t = setTimeout(() => {
      setScanState('idle');
      setResultBadge(null);
    }, delay);
    return () => clearTimeout(t);
  }, [scanState]);

  const fetchCheckIns = useCallback(async () => {
    if (!eventId) {
      setCheckIns([]);
      return;
    }
    try {
      const res = await axios.get(`${serverUrl}/api/scanner/guests?eventId=${eventId}`);
      if (res.data?.success) {
        const checked: CheckInEntry[] = (res.data.guests as any[])
          .filter((g) => g.status === 'checked_in')
          .map((g) => ({
            rsvpId: g.id,
            name: g.name || 'Guest',
            seatNumber: g.seatNumber ?? null,
            seatLabel: g.seatLabel ?? null,
            checkedInAt: g.checkInTime ? new Date(g.checkInTime).getTime() : 0,
          }))
          .sort((a, b) => b.checkedInAt - a.checkedInAt);
        setCheckIns(checked);
      }
    } catch (err) {
      console.warn('[fetchCheckIns]', err);
    }
  }, [eventId, serverUrl]);

  useFocusEffect(
    useCallback(() => {
      fetchCheckIns();
    }, [fetchCheckIns]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCheckIns();
    setRefreshing(false);
  }, [fetchCheckIns]);

  const onObjectsScanned = useCallback(
    async (objects: any[]) => {
      if (scanState !== 'idle' || !eventId) return;
      const qrCode = objects.find((obj) => obj.format === 'qr-code' && obj.rawValue);
      if (!qrCode) return;
      const qrToken = qrCode.rawValue as string;

      setScanState('loading');
      try {
        const verifyRes = await axios.post(`${serverUrl}/api/qr/verify`, { qrToken, eventId });
        if (!verifyRes.data?.success) {
          throw new Error(verifyRes.data?.error || 'Verification failed');
        }
        const rsvp = verifyRes.data.rsvp;
        const guestName = rsvp?.name || 'Guest';

        try {
          await axios.post(`${serverUrl}/api/scanner/checkin`, {
            eventId,
            rsvpId: rsvp.id,
          });
        } catch (checkinErr: any) {
          const msg =
            checkinErr.response?.data?.error || checkinErr.message || 'Check-in failed';
          setResultBadge({ ok: false, text: msg });
          setScanState('error');
          return;
        }

        setResultBadge({ ok: true, text: `Checked in: ${guestName}` });
        setScanState('success');
        fetchCheckIns();
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Network error';
        setResultBadge({ ok: false, text: msg });
        setScanState('error');
      }
    },
    [scanState, serverUrl, eventId, fetchCheckIns],
  );

  const objectOutput = useBarcodeScannerOutput({
    barcodeFormats: BARCODE_FORMATS,
    onBarcodeScanned: onObjectsScanned,
    onError: (err) => {
      console.warn('[Scanner error]', err);
    },
  });

  const cameraReady = hasPermission && device != null && !!eventId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ height: TOP_SPACER }} />

      <View style={styles.boxWrapper}>
        <View style={styles.box}>
          {!hasPermission && (
            <View style={styles.boxFallback}>
              <CameraIcon color={colors.primary} size={48} />
              <Text style={styles.boxFallbackTitle}>Camera Access Needed</Text>
              <Text style={styles.boxFallbackSub}>Grant permission to scan QR codes</Text>
              <TouchableOpacity style={styles.boxButton} onPress={requestPermission}>
                <Text style={styles.boxButtonText}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasPermission && device == null && (
            <View style={styles.boxFallback}>
              <XCircle color={colors.error} size={48} />
              <Text style={styles.boxFallbackTitle}>No Camera Found</Text>
            </View>
          )}

          {hasPermission && device != null && !eventId && (
            <View style={styles.boxFallback}>
              <SettingsIcon color={colors.primary} size={48} />
              <Text style={styles.boxFallbackTitle}>Configure Event ID</Text>
              <Text style={styles.boxFallbackSub}>Set Event ID in Settings to scan</Text>
            </View>
          )}

          {cameraReady && isFocused && (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={scanState !== 'loading' && isFocused}
              outputs={[objectOutput]}
            />
          )}

          {scanState === 'loading' && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {resultBadge && (
            <View
              style={[styles.badge, resultBadge.ok ? styles.badgeOk : styles.badgeErr]}
            >
              {resultBadge.ok ? (
                <CheckCircle color="#fff" size={16} />
              ) : (
                <XCircle color="#fff" size={16} />
              )}
              <Text style={styles.badgeText} numberOfLines={2}>
                {resultBadge.text}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionHeader}>
          Checked-in Guests {checkIns.length > 0 ? `(${checkIns.length})` : ''}
        </Text>
        {checkIns.length === 0 ? (
          <View style={styles.emptyState}>
            <ScanLine color={colors.textMuted} size={32} />
            <Text style={styles.emptyText}>Waiting to be checked in</Text>
          </View>
        ) : (
          <FlatList
            data={checkIns}
            keyExtractor={(item, idx) => `${item.rsvpId}-${item.checkedInAt}-${idx}`}
            renderItem={({ item }) => <CheckInRow item={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function CheckInRow({ item }: { item: CheckInEntry }) {
  const initial = (item.name || '?').trim().charAt(0).toUpperCase();
  const time = new Date(item.checkedInAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowSub}>
          {item.seatLabel ?? (item.seatNumber != null ? `Seat ${item.seatNumber}` : 'No seat')} · {time}
        </Text>
      </View>
      <CheckCircle color={colors.success} size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  boxWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxFallback: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFallbackTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  boxFallbackSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  boxButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  boxButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  badgeOk: {
    backgroundColor: colors.success,
  },
  badgeErr: {
    backgroundColor: colors.error,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  listSection: {
    flex: 1,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + '22',
    borderWidth: 1,
    borderColor: colors.success + '44',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 16,
  },
  rowMeta: {
    flex: 1,
  },
  rowName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});

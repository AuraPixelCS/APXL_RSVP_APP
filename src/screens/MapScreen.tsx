import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  useWindowDimensions,
  Alert,
} from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { X, CheckCircle, MapPin } from 'lucide-react-native';
import axios from 'axios';
import { useAppContext } from '../context/AppContext';
import { colors } from '../theme/colors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  status: string; // pending | allocated | checked_in | not_attending
  seatNumber?: number | null;
  seatLabel?: string | null;
  partOf?: string;
}

interface VipTable {
  id?: string;
  label?: string;
  seats: number;
}

interface Seating {
  style: string | null;
  totalSeats: number;
  seatsPerTable: number;
  tablesPerSide: number | null;
  frontRowTablesPerSide: number | null;
  vipTables: VipTable[];
}

interface SeatCell {
  seatNumber: number;
  seatInTable: number;
  guest: Guest | null;
}

interface TableModel {
  key: string;
  label: string; // "T4" / "V1"
  longLabel: string; // "Table 4" / "VIP Table 1"
  variant: 'standard' | 'vip';
  capacity: number;
  seats: SeatCell[];
  occupied: number;
  checkedIn: number;
}

// ─── Seat / table colouring ──────────────────────────────────────────────────

function seatFill(cell: SeatCell): string {
  if (!cell.guest) return colors.surfaceLight;
  if (cell.guest.status === 'checked_in') return colors.success;
  return colors.primary;
}
function seatStroke(cell: SeatCell): string {
  if (!cell.guest) return colors.border;
  if (cell.guest.status === 'checked_in') return colors.success;
  return colors.primary;
}

// ─── Single table (SVG circle + seat dots) ───────────────────────────────────

const TABLE_R = 28;
const SEAT_R = 6;
const ORBIT_R = TABLE_R + SEAT_R + 5;
const SVG_SIZE = (ORBIT_R + SEAT_R + 3) * 2;

function TableCircle({ table }: { table: TableModel }) {
  const c = SVG_SIZE / 2;
  const isVip = table.variant === 'vip';
  return (
    <Svg width={SVG_SIZE} height={SVG_SIZE}>
      <Circle
        cx={c}
        cy={c}
        r={TABLE_R}
        fill={colors.surface}
        stroke={isVip ? '#d4af37' : colors.border}
        strokeWidth={1.5}
      />
      <SvgText
        x={c}
        y={c + 4}
        fontSize={13}
        fontWeight="bold"
        fill={isVip ? '#d4af37' : colors.textMuted}
        textAnchor="middle"
      >
        {table.label}
      </SvgText>
      {table.seats.map((cell, i) => {
        const angle = (i / table.capacity) * Math.PI * 2 - Math.PI / 2;
        return (
          <Circle
            key={cell.seatNumber}
            cx={c + Math.cos(angle) * ORBIT_R}
            cy={c + Math.sin(angle) * ORBIT_R}
            r={SEAT_R}
            fill={seatFill(cell)}
            stroke={seatStroke(cell)}
            strokeWidth={1.25}
          />
        );
      })}
    </Svg>
  );
}

// ─── Table card (pressable) ──────────────────────────────────────────────────

function TableCard({
  table,
  width,
  onPress,
}: {
  table: TableModel;
  width: number;
  onPress: () => void;
}) {
  const full = table.occupied >= table.capacity && table.capacity > 0;
  const countColor =
    table.occupied === 0 ? colors.textMuted : full ? colors.success : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      style={({ pressed }) => [
        styles.card,
        { width },
        pressed && { borderColor: colors.primary, opacity: 0.9 },
      ]}
    >
      <TableCircle table={table} />
      <Text style={styles.cardLabel} numberOfLines={1}>
        {table.longLabel}
      </Text>
      <Text style={[styles.cardCount, { color: countColor }]}>
        {table.occupied}/{table.capacity} seated
      </Text>
      {table.checkedIn > 0 && (
        <Text style={styles.cardChecked}>{table.checkedIn} checked in</Text>
      )}
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { eventId, serverUrl } = useAppContext();
  const { width } = useWindowDimensions();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [seating, setSeating] = useState<Seating | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<TableModel | null>(null);

  const fetchData = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    const url = `${serverUrl}/api/scanner/guests?eventId=${eventId}`;
    try {
      const res = await axios.get(url);
      if (res.data.success) {
        setGuests(res.data.guests || []);
        setSeating(res.data.seating || null);
      }
    } catch (err) {
      const e = err as any;
      console.error('Failed to fetch seating map', { url, code: e?.code, message: e?.message });
      Alert.alert('Error', `Failed to load seating map\n\n${e?.message ?? ''}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, serverUrl]);

  // Refresh whenever the tab gains focus, so check-ins made on the Scan tab
  // are reflected here without a manual pull.
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Build the table models from the seating config + guest assignments.
  const tables = useMemo<TableModel[]>(() => {
    if (!seating || !seating.totalSeats) return [];
    const spt = seating.seatsPerTable || 10;
    const total = seating.totalSeats;

    const guestBySeat = new Map<number, Guest>();
    for (const g of guests) {
      if (typeof g.seatNumber === 'number') guestBySeat.set(g.seatNumber, g);
    }

    const makeTable = (
      key: string,
      label: string,
      longLabel: string,
      variant: 'standard' | 'vip',
      startSeat: number,
      capacity: number,
    ): TableModel => {
      const seats: SeatCell[] = [];
      let occupied = 0;
      let checkedIn = 0;
      for (let s = 0; s < capacity; s++) {
        const seatNumber = startSeat + s;
        const guest = guestBySeat.get(seatNumber) ?? null;
        if (guest) {
          occupied++;
          if (guest.status === 'checked_in') checkedIn++;
        }
        seats.push({ seatNumber, seatInTable: s + 1, guest });
      }
      return { key, label, longLabel, variant, capacity, seats, occupied, checkedIn };
    };

    const result: TableModel[] = [];

    // VIP tables first (they sit nearest the stage), seat-numbered above total.
    let vipCursor = total + 1;
    (seating.vipTables || []).forEach((v, i) => {
      const cap = v.seats > 0 ? v.seats : 0;
      if (cap <= 0) return;
      result.push(makeTable(`vip-${i}`, `V${i + 1}`, `VIP Table ${i + 1}`, 'vip', vipCursor, cap));
      vipCursor += cap;
    });

    // Standard tables.
    const tableCount = Math.ceil(total / spt);
    for (let i = 0; i < tableCount; i++) {
      const startSeat = i * spt + 1;
      const cap = Math.min(spt, total - i * spt);
      result.push(makeTable(`t-${i}`, `T${i + 1}`, `Table ${i + 1}`, 'standard', startSeat, cap));
    }

    return result;
  }, [seating, guests]);

  const summary = useMemo(() => {
    let occupied = 0;
    let checkedIn = 0;
    for (const t of tables) {
      occupied += t.occupied;
      checkedIn += t.checkedIn;
    }
    return { tables: tables.length, occupied, checkedIn };
  }, [tables]);

  // Responsive columns: keep cards legible (~150px min), 2 on phones up to ~6.
  const H_PAD = 16;
  const GAP = 12;
  const minCard = 150;
  const cols = Math.max(2, Math.min(6, Math.floor((width - H_PAD * 2 + GAP) / (minCard + GAP))));
  const cardWidth = Math.floor((width - H_PAD * 2 - GAP * (cols - 1)) / cols);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!eventId) {
    return (
      <View style={styles.center}>
        <MapPin color={colors.textMuted} size={40} />
        <Text style={styles.emptyTitle}>No event selected</Text>
        <Text style={styles.emptyText}>Set an Event ID in Settings to view the seating map.</Text>
      </View>
    );
  }

  if (tables.length === 0) {
    return (
      <View style={styles.center}>
        <MapPin color={colors.textMuted} size={40} />
        <Text style={styles.emptyTitle}>No seating map</Text>
        <Text style={styles.emptyText}>This event has no seating configured yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: H_PAD, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Summary */}
        <View style={styles.summaryRow}>
          <Stat label="Tables" value={String(summary.tables)} color={colors.text} />
          <Stat label="Seated" value={String(summary.occupied)} color={colors.primary} />
          <Stat label="Checked in" value={String(summary.checkedIn)} color={colors.success} />
        </View>

        {/* Stage */}
        <View style={styles.stage}>
          <Text style={styles.stageText}>STAGE</Text>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendDot color={colors.success} label="Checked in" />
          <LegendDot color={colors.primary} label="Seated" />
          <LegendDot color={colors.surfaceLight} stroke={colors.border} label="Empty" />
        </View>

        {/* Tables grid */}
        <View style={[styles.grid, { gap: GAP }]}>
          {tables.map((t) => (
            <TableCard key={t.key} table={t} width={cardWidth} onPress={() => setSelected(t)} />
          ))}
        </View>
      </ScrollView>

      {/* Occupant sheet */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          {/* Full-screen tap-to-close layer BEHIND the sheet — keeps the sheet a
              plain View so the occupant ScrollView can scroll (a Pressable
              ancestor would swallow the drag gesture). */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={styles.sheet}>
            {selected && (
              <>
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetTitle}>{selected.longLabel}</Text>
                    <Text style={styles.sheetSub}>
                      {selected.occupied}/{selected.capacity} seated · {selected.checkedIn} checked in
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelected(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <X color={colors.textMuted} size={24} />
                  </Pressable>
                </View>

                <ScrollView
                  style={{ maxHeight: 380 }}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {selected.seats.filter((s) => s.guest).length === 0 ? (
                    <Text style={styles.emptySeat}>No guests assigned to this table yet.</Text>
                  ) : (
                    selected.seats
                      .filter((s) => s.guest)
                      .map((s) => {
                        const g = s.guest!;
                        const isIn = g.status === 'checked_in';
                        return (
                          <View key={s.seatNumber} style={styles.occRow}>
                            <View style={styles.seatNum}>
                              <Text style={styles.seatNumText}>{s.seatInTable}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.occName} numberOfLines={1}>
                                {g.name}
                              </Text>
                              {!!(g.company || g.jobTitle) && (
                                <Text style={styles.occMeta} numberOfLines={1}>
                                  {[g.jobTitle, g.company].filter(Boolean).join(' · ')}
                                </Text>
                              )}
                            </View>
                            {isIn ? (
                              <View style={styles.inBadge}>
                                <CheckCircle color={colors.success} size={13} />
                                <Text style={styles.inText}>In</Text>
                              </View>
                            ) : (
                              <View style={styles.pendBadge}>
                                <Text style={styles.pendText}>Not in</Text>
                              </View>
                            )}
                          </View>
                        );
                      })
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, stroke, label }: { color: string; stroke?: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          { backgroundColor: color, borderColor: stroke ?? color, borderWidth: stroke ? 1 : 0 },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 0.5 },

  stage: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageText: { color: colors.textMuted, fontSize: 12, letterSpacing: 3, fontWeight: '700' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: colors.textMuted, fontSize: 11 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  cardLabel: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 6 },
  cardCount: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardChecked: { color: colors.success, fontSize: 10, marginTop: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  emptySeat: { color: colors.textMuted, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  occRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  seatNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNumText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  occName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  occMeta: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  inBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  pendBadge: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendText: { color: colors.textMuted, fontSize: 11 },
});

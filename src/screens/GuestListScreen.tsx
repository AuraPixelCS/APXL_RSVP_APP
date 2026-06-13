import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useAppContext } from '../context/AppContext';
import { colors } from '../theme/colors';
import axios from 'axios';
import { Search, CheckCircle, UserCheck, Info, X, User, Mail, Phone, Briefcase, Building2, Utensils, MessageSquare, Users, Hash } from 'lucide-react-native';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  seatNumber?: string | number;
  seatLabel?: string | null;
  attending?: boolean;
  plusOne?: boolean;
  plusOneName?: string;
  dietaryRestrictions?: string;
  message?: string;
  partOf?: string;
  company?: string;
  jobTitle?: string;
  industry?: string;
  submittedAt?: string;
  checkInTime?: string;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | boolean | null;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  if (!value && value !== false) return null;
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconWrap}>{icon}</View>
      <View style={detailStyles.textWrap}>
        <Text style={detailStyles.label}>{label}</Text>
        <Text style={detailStyles.value}>{displayValue}</Text>
      </View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 36,
    alignItems: 'center',
    paddingTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});

function getStatusColor(status: string) {
  switch (status) {
    case 'checked_in': return colors.success;
    case 'allocated': return colors.primary;
    case 'pending': return '#F59E0B';
    case 'not_attending': return colors.error;
    default: return colors.textMuted;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'checked_in': return 'Checked In';
    case 'allocated': return 'Allocated';
    case 'pending': return 'Pending';
    case 'not_attending': return 'Not Attending';
    default: return status.replace('_', ' ').toUpperCase();
  }
}

export default function GuestListScreen() {
  const { eventId, serverUrl } = useAppContext();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  const fetchGuests = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    const url = `${serverUrl}/api/scanner/guests?eventId=${eventId}`;
    try {
      const response = await axios.get(url);
      if (response.data.success) {
        setGuests(response.data.guests);
        setFilteredGuests(response.data.guests);
      }
    } catch (err) {
      const e = err as any;
      const detail = {
        url,
        code: e?.code,
        message: e?.message,
        status: e?.response?.status,
      };
      console.error('Failed to fetch guests', detail);
      Alert.alert(
        'Error',
        `Failed to load guest list\n\nURL: ${url}\nCode: ${e?.code ?? '-'}\nStatus: ${e?.response?.status ?? '-'}\n${e?.message ?? ''}`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, serverUrl]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGuests();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text) {
      setFilteredGuests(guests);
      return;
    }
    const q = text.toLowerCase();
    setFilteredGuests(guests.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      (g.seatNumber && g.seatNumber.toString().includes(q)) ||
      (g.seatLabel && g.seatLabel.toLowerCase().includes(q)) ||
      (g.company && g.company.toLowerCase().includes(q))
    ));
  };

  const handleCheckIn = async (guestId: string) => {
    if (!eventId) return;
    setCheckingIn(guestId);
    try {
      const response = await axios.post(`${serverUrl}/api/scanner/checkin`, { eventId, rsvpId: guestId });
      if (response.data.success) {
        const updateList = (list: Guest[]) =>
          list.map(g => g.id === guestId ? { ...g, status: 'checked_in' } : g);
        setGuests(updateList);
        setFilteredGuests(updateList);
        if (selectedGuest?.id === guestId) {
          setSelectedGuest(prev => prev ? { ...prev, status: 'checked_in' } : null);
        }
        Alert.alert('✅ Checked In', 'Guest checked in successfully');
      } else {
        Alert.alert('Error', response.data.error || 'Failed to check in guest');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Network error occurred');
    } finally {
      setCheckingIn(null);
    }
  };

  const renderGuestItem = ({ item }: { item: Guest }) => {
    const isCheckedIn = item.status === 'checked_in';
    const canCheckIn = item.status === 'allocated' || item.status === 'attending' || item.status === 'pending';
    const statusColor = getStatusColor(item.status);

    return (
      <View style={styles.guestCard}>
        {/* Left: Avatar initial */}
        <View style={[styles.avatar, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
          <Text style={[styles.avatarText, { color: statusColor }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Middle: Info */}
        <View style={styles.guestInfo}>
          <Text style={styles.guestName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.guestEmail} numberOfLines={1}>{item.email}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
            {item.seatNumber ? (
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>{item.seatLabel ?? `Seat ${item.seatNumber}`}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right: Action buttons */}
        <View style={styles.actions}>
          {/* Info button */}
          <TouchableOpacity style={styles.infoButton} onPress={() => setSelectedGuest(item)}>
            <Info size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* Check-in button */}
          {isCheckedIn ? (
            <View style={styles.checkedMark}>
              <CheckCircle size={22} color={colors.success} />
            </View>
          ) : canCheckIn ? (
            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() => handleCheckIn(item.id)}
              disabled={checkingIn === item.id}
            >
              {checkingIn === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <UserCheck size={18} color="#fff" />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // Guest Detail Modal
  const renderGuestModal = () => {
    if (!selectedGuest) return null;
    const statusColor = getStatusColor(selectedGuest.status);
    const isCheckedIn = selectedGuest.status === 'checked_in';
    const canCheckIn = selectedGuest.status === 'allocated' || selectedGuest.status === 'attending' || selectedGuest.status === 'pending';

    return (
      <Modal
        visible={!!selectedGuest}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedGuest(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedGuest(null)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalAvatar, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
                <Text style={[styles.modalAvatarText, { color: statusColor }]}>
                  {selectedGuest.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalName}>{selectedGuest.name}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + '22', alignSelf: 'flex-start', marginTop: 4 }]}>
                  <View style={[styles.dot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.badgeText, { color: statusColor }]}>{getStatusLabel(selectedGuest.status)}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedGuest(null)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Seat badge if allocated */}
            {selectedGuest.seatNumber ? (
              <View style={styles.seatBadge}>
                <Hash size={14} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.seatBadgeText}>{selectedGuest.seatLabel ?? `Seat ${selectedGuest.seatNumber}`}</Text>
              </View>
            ) : null}

            {/* Details */}
            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionHeader}>CONTACT</Text>
              <View style={styles.detailCard}>
                <DetailRow icon={<Mail size={16} color={colors.primary} />} label="Email" value={selectedGuest.email} />
                <DetailRow icon={<Phone size={16} color={colors.primary} />} label="Phone" value={selectedGuest.phone} />
              </View>

              <Text style={styles.sectionHeader}>PROFESSIONAL</Text>
              <View style={styles.detailCard}>
                <DetailRow icon={<Briefcase size={16} color={colors.primary} />} label="Job Title" value={selectedGuest.jobTitle} />
                <DetailRow icon={<Building2 size={16} color={colors.primary} />} label="Company" value={selectedGuest.company} />
                <DetailRow icon={<Building2 size={16} color={colors.primary} />} label="Industry" value={selectedGuest.industry} />
                <DetailRow icon={<Users size={16} color={colors.primary} />} label="Part Of" value={selectedGuest.partOf} />
              </View>

              <Text style={styles.sectionHeader}>ATTENDANCE</Text>
              <View style={styles.detailCard}>
                <DetailRow icon={<User size={16} color={colors.primary} />} label="Plus One" value={selectedGuest.plusOne} />
                {selectedGuest.plusOne && (
                  <DetailRow icon={<User size={16} color={colors.primary} />} label="Plus One Name" value={selectedGuest.plusOneName} />
                )}
                <DetailRow icon={<Utensils size={16} color={colors.primary} />} label="Dietary Requirements" value={selectedGuest.dietaryRestrictions} />
                <DetailRow icon={<MessageSquare size={16} color={colors.primary} />} label="Message" value={selectedGuest.message} />
              </View>

              {selectedGuest.submittedAt ? (
                <>
                  <Text style={styles.sectionHeader}>SUBMISSION</Text>
                  <View style={styles.detailCard}>
                    <DetailRow
                      icon={<Hash size={16} color={colors.primary} />}
                      label="Submitted At"
                      value={new Date(selectedGuest.submittedAt).toLocaleString()}
                    />
                    {selectedGuest.checkInTime ? (
                      <DetailRow
                        icon={<CheckCircle size={16} color={colors.success} />}
                        label="Checked In At"
                        value={new Date(selectedGuest.checkInTime).toLocaleString()}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Check-in CTA at bottom */}
            {!isCheckedIn && canCheckIn && (
              <TouchableOpacity
                style={styles.modalCheckInButton}
                onPress={() => handleCheckIn(selectedGuest.id)}
                disabled={checkingIn === selectedGuest.id}
              >
                {checkingIn === selectedGuest.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <UserCheck size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.modalCheckInText}>Check In Guest</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isCheckedIn && (
              <View style={styles.alreadyCheckedIn}>
                <CheckCircle size={18} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={styles.alreadyCheckedInText}>Guest has been checked in</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  if (!eventId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>Please configure an Event ID in Settings</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Search color={colors.textMuted} size={18} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, company..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Count */}
      {!loading && (
        <Text style={styles.countText}>
          {filteredGuests.length} of {guests.length} guests
        </Text>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredGuests}
          keyExtractor={(item) => item.id}
          renderItem={renderGuestItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No guests match your search.' : 'No guests found for this event.'}
              </Text>
            </View>
          }
        />
      )}

      {renderGuestModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  countText: {
    color: colors.textMuted,
    fontSize: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContainer: {
    padding: 16,
    paddingTop: 4,
  },
  guestCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  guestInfo: {
    flex: 1,
    minWidth: 0,
  },
  guestName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  guestEmail: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedMark: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modalAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  seatBadgeText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailsScroll: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },
  detailCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCheckInButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  modalCheckInText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  alreadyCheckedIn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.success + '15',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  alreadyCheckedInText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 15,
  },
});

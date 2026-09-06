import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';
import { toLocalDateId } from '@/lib/tickets';

type Props = {
  visible: boolean;
  selectedDate: string | null;
  /** Days outside [minDateId, maxDateId] are shown but not selectable. */
  minDateId?: string;
  maxDateId?: string;
  onSelect: (dateId: string) => void;
  onClose: () => void;
};

export function SingleDateCalendarModal({ visible, selectedDate, minDateId, maxDateId, onSelect, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (selectedDate) {
      const [year, month] = selectedDate.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date();
  });

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const locale = language === 'sv' ? 'sv-SE' : 'en-GB';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarMonth);
  const weekdayLabels = language === 'sv' ? ['M', 'T', 'O', 'T', 'F', 'L', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: startWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [year, month]);

  const todayId = toLocalDateId(new Date());

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Stäng" onPress={onClose} style={styles.backdropPressable} />
        <ThemedView type="backgroundElement" style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Pressable onPress={() => setCalendarMonth(new Date(year, month - 1, 1))} style={styles.navButton}>
              <ThemedText style={styles.navIcon}>‹</ThemedText>
            </Pressable>
            <ThemedText style={styles.title}>{monthLabel}</ThemedText>
            <Pressable onPress={() => setCalendarMonth(new Date(year, month + 1, 1))} style={styles.navButton}>
              <ThemedText style={styles.navIcon}>›</ThemedText>
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {weekdayLabels.map((label, index) => (
              <ThemedText key={index} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
                {label}
              </ThemedText>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (day === null) return <View key={dayIndex} style={styles.dayCell} />;

                const dayId = toLocalDateId(new Date(year, month, day));
                const active = selectedDate === dayId;
                const isToday = dayId === todayId;
                const disabled = (!!minDateId && dayId < minDateId) || (!!maxDateId && dayId > maxDateId);

                return (
                  <View key={dayIndex} style={styles.dayCell}>
                    <Pressable
                      disabled={disabled}
                      onPress={() => {
                        onSelect(dayId);
                        onClose();
                      }}
                      style={[
                        styles.dayButton,
                        {
                          backgroundColor: active ? '#FFC8A5' : 'transparent',
                          borderColor: active ? '#E39E7273' : isToday ? '#9F6A49' : 'transparent',
                          opacity: disabled ? 0.3 : 1,
                        },
                      ]}>
                      <ThemedText
                        style={[
                          styles.dayText,
                          (active || isToday) && styles.dayTextActive,
                          { color: active ? '#1D2430' : isToday ? '#9F6A49' : theme.text },
                        ]}>
                        {day}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(29,36,48,0.24)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D5DAE2',
    borderRadius: 999,
    height: 4,
    marginBottom: Spacing.one,
    width: 36,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  navButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  navIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.one,
  },
  weekdayLabel: {
    flex: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    flex: 1,
    justifyContent: 'center',
  },
  dayButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: '82%',
    justifyContent: 'center',
    width: '82%',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dayTextActive: {
    fontWeight: '800',
  },
});

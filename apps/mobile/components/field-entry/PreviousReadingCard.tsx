/**
 * Previous Reading Card Component
 * Collapsible header, calendar date picker, reading carousel (mobile swipeable + desktop arrows), navigation controls
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFieldEntry } from './FieldEntryContext';

export function PreviousReadingCard() {
  const {
    wellName,
    editingEntryId,
    previousReading,
    readingsForSelectedDate,
    currentReadingIndex,
    isReadingCardCollapsed,
    showDatePicker,
    setIsReadingCardCollapsed,
    setShowDatePicker,
    handlePreviousReading,
    handleNextReading,
    handleEditReading,
    handleDateSelect,
    getCalendarMonth,
    dateHasReadings,
    isDateSelected,
  } = useFieldEntry();

  const flatListRef = useRef<FlatList>(null);

  // FlatList viewability configuration for tracking current reading
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    minimumViewTime: 100,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
  ).current;

  // Don't render if no well selected or in edit mode
  if (!wellName || editingEntryId) {
    return null;
  }

  return (
    <View style={styles.previousReadingCard}>
      <TouchableOpacity
        style={styles.previousReadingHeader}
        onPress={() => setIsReadingCardCollapsed(!isReadingCardCollapsed)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.previousReadingTitle}>
              {readingsForSelectedDate.length > 0
                ? '📊 Previous Readings'
                : '📊 No Previous Readings'}
            </Text>
            {readingsForSelectedDate.length > 0 && (
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowDatePicker(!showDatePicker);
                }}
              >
                <Text style={styles.datePickerButtonText}>
                  📅 {showDatePicker ? 'Hide' : 'Dates'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {readingsForSelectedDate.length > 0 && (
            <Text style={styles.previousReadingDate}>
              {new Date(
                readingsForSelectedDate[currentReadingIndex]?.createdAt ||
                  readingsForSelectedDate[0]?.createdAt,
              ).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}{' '}
              ({readingsForSelectedDate.length})
            </Text>
          )}
        </View>
        <Text style={styles.collapseIcon}>{isReadingCardCollapsed ? '▶' : '▼'}</Text>
      </TouchableOpacity>

      {/* Custom Calendar Date Picker */}
      {!isReadingCardCollapsed && showDatePicker && readingsForSelectedDate.length > 0 && (
        <View style={styles.calendarContainer}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>

          {/* Day Names */}
          <View style={styles.calendarDayNames}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <View key={day} style={styles.calendarDayNameCell}>
                <Text style={styles.calendarDayName}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {getCalendarMonth().map((date, index) => {
              const hasReadings = dateHasReadings(date);
              const isSelected = isDateSelected(date);
              const isToday = date && date.toDateString() === new Date().toDateString();

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.calendarDay,
                    hasReadings && styles.calendarDayWithReadings,
                    isSelected && styles.calendarDaySelected,
                    isToday && !isSelected && styles.calendarDayToday,
                  ]}
                  onPress={async () => {
                    if (date && hasReadings) {
                      if (Platform.OS !== 'web') {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      handleDateSelect(date.toDateString());
                    }
                  }}
                  disabled={!hasReadings}
                >
                  {date && (
                    <Text
                      style={[
                        styles.calendarDayText,
                        !hasReadings && styles.calendarDayTextDisabled,
                        isSelected && styles.calendarDayTextSelected,
                        isToday && !isSelected && styles.calendarDayTextToday,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Content - only show when not collapsed */}
      {!isReadingCardCollapsed && (
        <>
          {readingsForSelectedDate.length === 0 ? (
            <View style={styles.noPreviousReadings}>
              <Text style={styles.noPreviousReadingsText}>
                No previous readings found for this well.
              </Text>
              <Text style={styles.noPreviousReadingsSubtext}>
                Your first entry will appear here after you save it.
              </Text>
            </View>
          ) : (
            <>
              {/* Desktop Slideshow - Side Arrow Navigation */}
              {Platform.OS === 'web' && readingsForSelectedDate.length > 1 ? (
                <View style={styles.desktopSlideshowContainer}>
                  {/* Left Arrow */}
                  <TouchableOpacity
                    style={[
                      styles.desktopArrowButton,
                      styles.desktopArrowLeft,
                      currentReadingIndex === 0 && styles.desktopArrowDisabled,
                    ]}
                    onPress={handlePreviousReading}
                    disabled={currentReadingIndex === 0}
                  >
                    <Text
                      style={[
                        styles.desktopArrowIcon,
                        currentReadingIndex === 0 && styles.desktopArrowIconDisabled,
                      ]}
                    >
                      ‹
                    </Text>
                  </TouchableOpacity>

                  {/* Reading Content */}
                  <View style={styles.previousReadingData}>
                    <View style={styles.previousReadingRow}>
                      <Text style={styles.previousReadingLabel}>Oil Production:</Text>
                      <Text style={styles.previousReadingValue}>
                        {previousReading?.productionVolume} bbl
                      </Text>
                    </View>
                    {previousReading?.gasVolume && (
                      <View style={styles.previousReadingRow}>
                        <Text style={styles.previousReadingLabel}>Gas Volume:</Text>
                        <Text style={styles.previousReadingValue}>
                          {previousReading.gasVolume} mcf
                        </Text>
                      </View>
                    )}
                    {previousReading?.pressure && (
                      <View style={styles.previousReadingRow}>
                        <Text style={styles.previousReadingLabel}>Pressure:</Text>
                        <Text style={styles.previousReadingValue}>
                          {previousReading.pressure} psi
                        </Text>
                      </View>
                    )}
                    {previousReading?.temperature && (
                      <View style={styles.previousReadingRow}>
                        <Text style={styles.previousReadingLabel}>Temperature:</Text>
                        <Text style={styles.previousReadingValue}>
                          {previousReading.temperature}°F
                        </Text>
                      </View>
                    )}
                    {previousReading?.waterCut && (
                      <View style={styles.previousReadingRow}>
                        <Text style={styles.previousReadingLabel}>Water Cut:</Text>
                        <Text style={styles.previousReadingValue}>{previousReading.waterCut}%</Text>
                      </View>
                    )}
                  </View>

                  {/* Right Arrow */}
                  <TouchableOpacity
                    style={[
                      styles.desktopArrowButton,
                      styles.desktopArrowRight,
                      currentReadingIndex === readingsForSelectedDate.length - 1 &&
                        styles.desktopArrowDisabled,
                    ]}
                    onPress={handleNextReading}
                    disabled={currentReadingIndex === readingsForSelectedDate.length - 1}
                  >
                    <Text
                      style={[
                        styles.desktopArrowIcon,
                        currentReadingIndex === readingsForSelectedDate.length - 1 &&
                          styles.desktopArrowIconDisabled,
                      ]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Mobile View - FlatList with horizontal paging */
                <View style={styles.mobileSwipeableWrapper}>
                  {/* Horizontal Swipeable FlatList */}
                  <FlatList
                    ref={flatListRef}
                    data={readingsForSelectedDate}
                    horizontal
                    snapToInterval={Dimensions.get('window').width - 64}
                    decelerationRate="fast"
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => `reading-${item.id || index}`}
                    viewabilityConfig={viewabilityConfig}
                    onViewableItemsChanged={onViewableItemsChanged}
                    getItemLayout={(data, index) => ({
                      length: Dimensions.get('window').width - 64,
                      offset: (Dimensions.get('window').width - 64) * index,
                      index,
                    })}
                    style={styles.swipeableContainer}
                    renderItem={({ item: reading }) => (
                      <View style={styles.swipeableReadingItem}>
                        <View style={styles.previousReadingData}>
                          <View style={styles.previousReadingRow}>
                            <Text style={styles.previousReadingLabel}>Oil Production:</Text>
                            <Text style={styles.previousReadingValue}>
                              {reading.productionVolume} bbl
                            </Text>
                          </View>
                          {reading.gasVolume && (
                            <View style={styles.previousReadingRow}>
                              <Text style={styles.previousReadingLabel}>Gas Volume:</Text>
                              <Text style={styles.previousReadingValue}>
                                {reading.gasVolume} mcf
                              </Text>
                            </View>
                          )}
                          {reading.pressure && (
                            <View style={styles.previousReadingRow}>
                              <Text style={styles.previousReadingLabel}>Pressure:</Text>
                              <Text style={styles.previousReadingValue}>
                                {reading.pressure} psi
                              </Text>
                            </View>
                          )}
                          {reading.temperature && (
                            <View style={styles.previousReadingRow}>
                              <Text style={styles.previousReadingLabel}>Temperature:</Text>
                              <Text style={styles.previousReadingValue}>
                                {reading.temperature}°F
                              </Text>
                            </View>
                          )}
                          {reading.waterCut && (
                            <View style={styles.previousReadingRow}>
                              <Text style={styles.previousReadingLabel}>Water Cut:</Text>
                              <Text style={styles.previousReadingValue}>{reading.waterCut}%</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.editReadingButton}
                            onPress={() => handleEditReading(reading)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.editReadingButtonText}>✏️ Edit Reading</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  />
                </View>
              )}

              {/* Navigation Controls - Show if multiple readings on this date */}
              {readingsForSelectedDate.length > 1 && (
                <View style={styles.slideshowContainer}>
                  <View style={styles.carouselControls}>
                    <TouchableOpacity
                      style={[
                        styles.carouselButton,
                        currentReadingIndex === 0 && styles.carouselButtonDisabled,
                      ]}
                      onPress={handlePreviousReading}
                      disabled={currentReadingIndex === 0}
                    >
                      <Text
                        style={[
                          styles.carouselButtonText,
                          currentReadingIndex === 0 && styles.carouselButtonTextDisabled,
                        ]}
                      >
                        ◀ Previous
                      </Text>
                    </TouchableOpacity>

                    {/* Counter between buttons */}
                    <View style={styles.carouselCounter}>
                      <Text style={styles.carouselCounterText}>
                        {currentReadingIndex + 1} of {readingsForSelectedDate.length}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.carouselButton,
                        currentReadingIndex === readingsForSelectedDate.length - 1 &&
                          styles.carouselButtonDisabled,
                      ]}
                      onPress={handleNextReading}
                      disabled={currentReadingIndex === readingsForSelectedDate.length - 1}
                    >
                      <Text
                        style={[
                          styles.carouselButtonText,
                          currentReadingIndex === readingsForSelectedDate.length - 1 &&
                            styles.carouselButtonTextDisabled,
                        ]}
                      >
                        Next ▶
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  previousReadingCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  previousReadingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  previousReadingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0C4A6E',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#0369A1',
  },
  previousReadingDate: {
    fontSize: 13,
    color: '#0369A1',
    fontStyle: 'italic',
  },
  datePickerButton: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7DD3FC',
  },
  datePickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
    padding: 12,
  },
  calendarHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0F2FE',
    marginBottom: 12,
  },
  calendarMonth: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0C4A6E',
  },
  calendarDayNames: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarDayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#075985',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  calendarDayWithReadings: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
  },
  calendarDaySelected: {
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  calendarDayTextDisabled: {
    color: '#D1D5DB',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    color: '#0EA5E9',
    fontWeight: 'bold',
  },
  noPreviousReadings: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noPreviousReadingsText: {
    fontSize: 14,
    color: '#0369A1',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  noPreviousReadingsSubtext: {
    fontSize: 13,
    color: '#075985',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  previousReadingData: {
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  previousReadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  previousReadingLabel: {
    fontSize: 14,
    color: '#075985',
    fontWeight: '500',
  },
  previousReadingValue: {
    fontSize: 14,
    color: '#0C4A6E',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  desktopSlideshowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  desktopArrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  desktopArrowLeft: {
    marginRight: 8,
  },
  desktopArrowRight: {
    marginLeft: 8,
  },
  desktopArrowDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  desktopArrowIcon: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  desktopArrowIconDisabled: {
    color: '#9CA3AF',
  },
  mobileSwipeableWrapper: {
    position: 'relative',
  },
  swipeableContainer: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  swipeableReadingItem: {
    width: Dimensions.get('window').width - 64,
  },
  editReadingButton: {
    marginTop: 12,
    backgroundColor: '#0EA5E9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editReadingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  slideshowContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
  },
  carouselControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  carouselButton: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    minWidth: 100,
    alignItems: 'center',
  },
  carouselButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  carouselButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369A1',
  },
  carouselButtonTextDisabled: {
    color: '#9CA3AF',
  },
  carouselCounter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  carouselCounterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    textAlign: 'center',
  },
});

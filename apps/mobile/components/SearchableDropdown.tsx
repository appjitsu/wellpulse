/**
 * Searchable Dropdown Component
 * Allows user to search and select from a list of items
 */

import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';

export interface DropdownItem {
  label: string;
  value: string;
}

interface SearchableDropdownProps {
  items: DropdownItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  disabled?: boolean;
}

export default function SearchableDropdown({
  items,
  value,
  onChange,
  placeholder = 'Search...',
  inputRef,
  returnKeyType = 'next',
  onSubmitEditing,
  disabled = false,
}: SearchableDropdownProps) {
  const [searchText, setSearchText] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredItems, setFilteredItems] = useState<DropdownItem[]>(items);

  // Update search text when value changes externally
  useEffect(() => {
    setSearchText(value);
  }, [value]);

  // Filter items based on search text
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredItems(items);
    } else {
      const filtered = items.filter((item) =>
        item.label.toLowerCase().includes(searchText.toLowerCase()),
      );
      setFilteredItems(filtered);
    }
  }, [searchText, items]);

  const handleTextChange = (text: string) => {
    setSearchText(text);
    onChange(text);
    if (!showDropdown && text.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleSelectItem = (item: DropdownItem) => {
    setSearchText(item.label);
    onChange(item.label);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    if (filteredItems.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow item selection (longer delay for web)
    setTimeout(() => setShowDropdown(false), 300);
  };

  const handleClear = () => {
    setSearchText('');
    onChange('');
    setShowDropdown(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            searchText.length > 0 && styles.inputWithClear,
            disabled && styles.inputDisabled,
          ]}
          placeholder={placeholder}
          value={searchText}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={!disabled}
        />
        {searchText.length > 0 && !disabled && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && filteredItems.length > 0 && !disabled && (
        <View
          style={styles.dropdown}
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => {
            // Prevent input blur when clicking dropdown on web
          }}
        >
          <ScrollView
            style={styles.dropdownList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredItems.map((item, index) => (
              <TouchableOpacity
                key={`${item.value}-${index}`}
                style={styles.dropdownItem}
                onPress={() => handleSelectItem(item)}
              >
                <Text style={styles.dropdownItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 9999,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    zIndex: 1,
  },
  inputWithClear: {
    paddingRight: 44,
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 999999,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
  },
});

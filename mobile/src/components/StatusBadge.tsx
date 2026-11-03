import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

interface StatusBadgeProps {
  label: string;
  type?: 'success' | 'warning' | 'error' | 'info';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, type = 'info' }) => {
  const getBadgeStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: theme.colors.successSubtle,
          color: theme.colors.success,
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warningSubtle,
          color: theme.colors.warning,
        };
      case 'error':
        return {
          backgroundColor: theme.colors.errorSubtle,
          color: theme.colors.error,
        };
      default:
        return {
          backgroundColor: theme.colors.infoSubtle,
          color: theme.colors.accentCyan,
        };
    }
  };

  const scheme = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: scheme.backgroundColor }]}>
      <Text style={[styles.text, { color: scheme.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.pill,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
});
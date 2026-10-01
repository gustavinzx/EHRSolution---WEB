import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useConnection } from '../hooks/useConnection';
import { theme } from '../theme/theme';

export const ConnectionStatus: React.FC = () => {
  const { isOnline, toggleConnection } = useConnection();

  return (
    <TouchableOpacity
      style={[
        styles.bar,
        { backgroundColor: isOnline ? theme.colors.success : theme.colors.warning },
      ]}
      onPress={toggleConnection}
      activeOpacity={0.9}
    >
      <Text style={styles.text}>
        Modo: {isOnline ? 'ONLINE (Nuvem / API)' : 'OFFLINE (Contingência BLE)'} — Toque para
        alternar
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  text: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
});
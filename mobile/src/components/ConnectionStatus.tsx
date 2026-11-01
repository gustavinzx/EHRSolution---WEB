import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useConnection } from '../hooks/useConnection';
import { theme } from '../theme/theme';

export const CONNECTION_LABELS = {
  online: 'Online',
  offline: 'Sem internet',
  server_unavailable: 'Servidor indisponível',
} as const;

interface ConnectionStatusProps {
  /** Use em telas sem cabeçalho para não ficar sob a barra de status. */
  respectTopInset?: boolean;
}

/**
 * Faixa discreta e apenas informativa. Some quando está online e nunca
 * captura toques (pointerEvents="none"), então não bloqueia nenhum fluxo.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ respectTopInset = false }) => {
  const { status } = useConnection();
  // Lido via contexto (e não useSafeAreaInsets) para não exigir Provider.
  const insets = useContext(SafeAreaInsetsContext);

  if (status === 'online') return null;

  const isOffline = status === 'offline';
  const topPadding = respectTopInset ? (insets?.top ?? 0) + theme.spacing.xs : theme.spacing.xs;

  return (
    <View
      testID="connection-status"
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        { paddingTop: topPadding },
        { backgroundColor: isOffline ? theme.colors.textSecondary : theme.colors.warning },
      ]}
    >
      <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>
        {CONNECTION_LABELS[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
});

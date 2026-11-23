import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as apiMod from '../services/api/apiClient';
import { theme } from '../theme/theme';

const HEALTH_TIMEOUT_MS = 5000;

export const ServidorLocalConfig: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState<string>(() => {
    if (typeof apiMod.getServerOverride === 'function' && apiMod.getServerOverride()) {
      return apiMod.getServerOverride()!;
    }
    if (typeof apiMod.getBaseUrl === 'function') {
      try {
        return apiMod.getBaseUrl();
      } catch {
        return '';
      }
    }
    return '';
  });
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    if (typeof apiMod.loadServerOverride === 'function') {
      Promise.resolve(apiMod.loadServerOverride())
        .then((saved) => {
          if (!mounted) return;
          if (saved) {
            setActiveUrl(saved);
            setInputUrl(saved);
          } else if (typeof apiMod.getBaseUrl === 'function') {
            try {
              const base = apiMod.getBaseUrl();
              setActiveUrl(base);
              setInputUrl(base);
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, []);

  const salvarETestar = async () => {
    if (testing) return;
    setTesting(true);
    setStatusMsg(null);
    setStatusOk(null);

    try {
      const normalized =
        typeof apiMod.normalizeServerUrl === 'function'
          ? apiMod.normalizeServerUrl(inputUrl)
          : inputUrl.trim();

      if (typeof apiMod.saveServerOverride === 'function') {
        await apiMod.saveServerOverride(normalized || null);
      }

      const targetUrl =
        normalized ||
        (typeof apiMod.getBaseUrl === 'function' ? apiMod.getBaseUrl() : '');
      setActiveUrl(targetUrl);
      setInputUrl(targetUrl);

      if (!targetUrl) {
        setStatusOk(false);
        setStatusMsg('Sem resposta. Confira o endereço, o Wi-Fi e se o servidor está ligado no computador.');
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      try {
        const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (res.ok) {
          setStatusOk(true);
          setStatusMsg('Servidor respondeu. Pode entrar.');
        } else {
          setStatusOk(false);
          setStatusMsg(`O servidor respondeu HTTP ${res.status}`);
        }
      } catch {
        setStatusOk(false);
        setStatusMsg('Sem resposta. Confira o endereço, o Wi-Fi e se o servidor está ligado no computador.');
      } finally {
        clearTimeout(timer);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.wrapper} testID="servidor-local-config">
      <View style={styles.summaryRow}>
        <Text style={styles.serverLabel} numberOfLines={1} ellipsizeMode="tail">
          Servidor: {activeUrl || 'não definido'}
        </Text>
        <TouchableOpacity
          testID="alterar-servidor-btn"
          onPress={() => {
            setOpen((prev) => !prev);
            setStatusMsg(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Fechar' : 'Alterar servidor'}
        >
          <Text style={styles.toggleLink}>{open ? 'Fechar' : 'Alterar servidor'}</Text>
        </TouchableOpacity>
      </View>

      {open && (
        <View style={styles.editorBox}>
          <TextInput
            testID="servidor-url-input"
            style={styles.input}
            placeholder="http://192.168.0.10:3001/api"
            placeholderTextColor={theme.colors.textDarkMuted}
            value={inputUrl}
            onChangeText={setInputUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            testID="salvar-e-testar-btn"
            style={styles.saveBtn}
            onPress={salvarETestar}
            disabled={testing}
            accessibilityRole="button"
            accessibilityLabel="Salvar e testar"
          >
            <Text style={styles.saveBtnText}>Salvar e testar</Text>
          </TouchableOpacity>

          {statusMsg && (
            <Text
              testID="servidor-status-msg"
              style={[
                styles.statusText,
                statusOk ? styles.statusSuccess : styles.statusError,
              ]}
            >
              {statusMsg}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: theme.spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  serverLabel: {
    color: theme.colors.textDarkMuted,
    fontSize: theme.typography.fontSize.xs,
    maxWidth: 230,
  },
  toggleLink: {
    color: theme.colors.accentCyan,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  editorBox: {
    marginTop: theme.spacing.sm,
    width: '100%',
    backgroundColor: theme.colors.surfaceDark,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.bgDark,
    color: theme.colors.white,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.typography.fontSize.xs,
    minHeight: 40,
  },
  saveBtn: {
    backgroundColor: theme.colors.accentCyan,
    borderRadius: theme.borderRadius.sm,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
  },
  saveBtnText: {
    color: theme.colors.bgDark,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
    marginTop: 2,
  },
  statusSuccess: {
    color: theme.colors.success,
  },
  statusError: {
    color: theme.colors.error,
  },
});

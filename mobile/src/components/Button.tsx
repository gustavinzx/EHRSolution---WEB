import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  testID,
  ...rest
}) => {
  const getButtonStyles = (): { container: ViewStyle; text: TextStyle; spinnerColor: string } => {
    if (disabled) {
      return {
        container: {
          backgroundColor: '#E2E8F0',
          borderColor: '#CBD5E1',
          borderWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
        text: {
          color: '#94A3B8',
          fontWeight: '700',
        },
        spinnerColor: '#94A3B8',
      };
    }

    switch (variant) {
      case 'secondary':
      case 'outline':
        return {
          container: {
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
            borderWidth: 1.5,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 1,
          },
          text: {
            color: '#0F172A',
            fontWeight: '700',
          },
          spinnerColor: '#0F172A',
        };

      case 'danger':
        return {
          container: {
            backgroundColor: '#EF4444',
            borderColor: '#DC2626',
            borderWidth: 1,
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          },
          text: {
            color: '#FFFFFF',
            fontWeight: '700',
          },
          spinnerColor: '#FFFFFF',
        };

      case 'success':
        return {
          container: {
            backgroundColor: '#10B981',
            borderColor: '#059669',
            borderWidth: 1,
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          },
          text: {
            color: '#FFFFFF',
            fontWeight: '700',
          },
          spinnerColor: '#FFFFFF',
        };

      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          text: {
            color: '#64748B',
            fontWeight: '600',
          },
          spinnerColor: '#64748B',
        };

      case 'primary':
      default:
        return {
          container: {
            backgroundColor: '#00C4D0',
            borderColor: '#00B4C0',
            borderWidth: 1,
            shadowColor: '#00C4D0',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 4,
          },
          text: {
            color: '#FFFFFF',
            fontWeight: '800',
          },
          spinnerColor: '#FFFFFF',
        };
    }
  };

  const scheme = getButtonStyles();

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.base,
        scheme.container,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.82}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={scheme.spinnerColor} />
      ) : (
        <Text style={[styles.baseText, scheme.text]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 6,
  },
  baseText: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
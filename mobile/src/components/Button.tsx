import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { theme } from '../theme/theme';

const Icon: React.FC<{ name: any; size?: number; color?: string; style?: any }> = (props) => {
  if (process.env.NODE_ENV === 'test') {
    return <Text style={[{ color: props.color, fontSize: props.size }, props.style]}>›</Text>;
  }
  const { Ionicons } = require('@expo/vector-icons');
  return <Ionicons {...props} />;
};

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  testID,
  leftIcon,
  rightIcon,
  ...rest
}) => {
  const getButtonStyles = (): { container: ViewStyle; text: TextStyle; spinnerColor: string } => {
    if (disabled) {
      return {
        container: {
          backgroundColor: theme.colors.surfaceDark,
          borderColor: theme.colors.borderDark,
          borderWidth: 1,
          opacity: theme.opacity.disabled,
          shadowOpacity: 0,
          elevation: 0,
        },
        text: {
          color: theme.colors.textDarkDisabled,
          fontWeight: theme.typography.fontWeight.bold,
        },
        spinnerColor: theme.colors.textDarkDisabled,
      };
    }

    switch (variant) {
      case 'secondary':
      case 'outline':
        return {
          container: {
            backgroundColor: theme.colors.overlayLightSubtle,
            borderColor: theme.colors.borderDarkSubtle,
            borderWidth: 1.5,
            ...theme.shadows.subtle,
          },
          text: {
            color: theme.colors.textDarkPrimary,
            fontWeight: theme.typography.fontWeight.bold,
          },
          spinnerColor: theme.colors.textDarkPrimary,
        };

      case 'danger':
        return {
          container: {
            backgroundColor: theme.colors.error,
            borderColor: theme.colors.errorBorder,
            borderWidth: 1,
            shadowColor: theme.colors.error,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          },
          text: {
            color: theme.colors.textDarkPrimary,
            fontWeight: theme.typography.fontWeight.bold,
          },
          spinnerColor: theme.colors.textDarkPrimary,
        };

      case 'success':
        return {
          container: {
            backgroundColor: theme.colors.success,
            borderColor: theme.colors.successBorder,
            borderWidth: 1,
            shadowColor: theme.colors.success,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          },
          text: {
            color: theme.colors.textDarkPrimary,
            fontWeight: theme.typography.fontWeight.bold,
          },
          spinnerColor: theme.colors.textDarkPrimary,
        };

      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
          },
          text: {
            color: theme.colors.textDarkMuted,
            fontWeight: theme.typography.fontWeight.medium,
          },
          spinnerColor: theme.colors.textDarkMuted,
        };

      case 'primary':
      default:
        return {
          container: {
            backgroundColor: theme.colors.accentCyan,
            borderColor: theme.colors.accentCyanHover,
            borderWidth: 1,
            ...theme.shadows.button,
          },
          text: {
            color: theme.colors.bgDark,
            fontWeight: theme.typography.fontWeight.extraBold,
          },
          spinnerColor: theme.colors.bgDark,
        };
    }
  };

  const scheme = getButtonStyles();
  const isPrimary = variant === 'primary' && !disabled;

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.base,
        scheme.container,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={theme.opacity.pressed}
      accessibilityRole="button"
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={scheme.spinnerColor} />
      ) : (
        <View style={styles.innerContent}>
          {leftIcon ? (
            leftIcon
          ) : isPrimary ? (
            <View style={styles.primaryLeftCircle}>
              <Icon name="arrow-forward" size={14} color={theme.colors.accentCyan} />
            </View>
          ) : null}

          <Text
            style={[
              styles.baseText,
              scheme.text,
              isPrimary && styles.primaryTextFlex,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>

          {rightIcon ? (
            rightIcon
          ) : isPrimary ? (
            <View style={styles.primaryRightChevrons}>
              <Icon name="chevron-forward" size={15} color={theme.colors.bgDark} />
              <Icon name="chevron-forward" size={15} color={theme.colors.bgDark} style={styles.overlapChevron} />
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    minHeight: theme.touchTarget.minHeight,
    borderRadius: theme.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs + 2,
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  baseText: {
    fontSize: theme.typography.fontSize.md - 1,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  primaryTextFlex: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  primaryLeftCircle: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryRightChevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  overlapChevron: {
    marginLeft: -9,
  },
});
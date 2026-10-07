export const theme = {
  colors: {
    primary: '#1E293B',
    secondary: '#2563EB',
    success: '#16A34A',
    warning: '#D97706',
    error: '#DC2626',
    background: '#F8FAFC',
    white: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    cardBg: '#FFFFFF',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  typography: {
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
    },
    fontWeight: {
      regular: '400' as const,
      medium: '600' as const,
      bold: '700' as const,
    },
  },
};
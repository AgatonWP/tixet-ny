import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

/**
 * Landing screen for links Supabase sends by email (signup confirmation,
 * password reset). Expo Router doesn't reliably match a deep link that
 * points at the bare app root, so auth emails are pointed here instead —
 * a real, explicitly registered route — which then just forwards into
 * the app itself.
 */
export default function AuthRedirectScreen() {
  useEffect(() => {
    router.replace('/');
  }, []);

  const theme = useTheme();

  return (
    <ThemedView style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator color={theme.textSecondary} size="small" />
    </ThemedView>
  );
}

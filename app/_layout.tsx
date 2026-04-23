import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getProfile } from '../src/db/profiles';
import { useNotifications } from '../src/hooks/useNotifications';

export default function RootLayout() {
  const { setSession, setProfile } = useAuthStore();
  useNotifications();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (!session) {
          setProfile(null);
          router.replace('/(auth)/login');
          return;
        }
        const profile = await getProfile(session.user.id);
        setProfile(profile);
        if (!profile) {
          router.replace('/onboarding/subjects');
        } else if (!profile.mess_id) {
          router.replace('/onboarding/mess');
        } else {
          router.replace('/(tabs)');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="timetable" />
      <Stack.Screen name="feed" />
      <Stack.Screen name="wall" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="mess" />
      <Stack.Screen name="gym" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}

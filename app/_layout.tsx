import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { getDb } from '../src/db';
import { getSettings } from '../src/db/settings';
import { requestPermissions } from '../src/engine/notifications';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDb(); // initialize tables
    requestPermissions();
    const settings = getSettings();
    if (!settings) {
      router.replace('/onboarding');
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="subject/[id]" options={{ headerShown: true, title: '' }} />
    </Stack>
  );
}

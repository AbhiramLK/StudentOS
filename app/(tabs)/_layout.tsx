import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(focused: boolean, on: IconName, off: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={focused ? on : off} size={size} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3b82f6' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'home', 'home-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: 'Timetable',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'calendar', 'calendar-outline')({ color, size }),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused, color, size }) =>
            icon(focused, 'checkmark-circle', 'checkmark-circle-outline')({ color, size }),
        }}
      />
    </Tabs>
  );
}

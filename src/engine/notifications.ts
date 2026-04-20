import * as Notifications from 'expo-notifications';
import { getAllSubjects } from '../db/subjects';
import { getSlotsForDay, countFutureSlots } from '../db/timetable';
import { getRecordsForSubject } from '../db/attendance';
import { getSettings } from '../db/settings';
import { predict } from './predictionEngine';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNotification(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const settings = getSettings();
  if (!settings) return;

  const today = new Date();
  // Convert JS day (0=Sun) to app day (0=Mon)
  const dayOfWeek = (today.getDay() + 6) % 7;
  const todaySlots = getSlotsForDay(dayOfWeek);
  if (todaySlots.length === 0) return;

  const subjects = getAllSubjects();
  const todayStr = today.toISOString().split('T')[0];

  const parts = subjects
    .filter(s => todaySlots.some(slot => slot.subject_id === s.id))
    .map(subject => {
      const records = getRecordsForSubject(subject.id);
      const futureSlotsCount = countFutureSlots(subject.id, todayStr, settings.semester_end_date);
      const result = predict(subject, records, futureSlotsCount);
      const icon = result.verdict === 'safe' ? '✅' : result.verdict === 'warning' ? '⚠️' : '🚫';
      return `${subject.name} ${icon}`;
    });

  if (parts.length === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's Classes",
      body: parts.join('  ·  '),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 7,
      minute: 30,
    },
  });
}

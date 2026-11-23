import { AgendaItem } from '../types/agenda';
import { playExecutiveChime } from './audioAlarm';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export function sendDesktopNotification(agenda: AgendaItem): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const title = `🚨 Pengingat Agenda: ${agenda.title}`;
    const options: NotificationOptions = {
      body: `Pukul ${agenda.startTime} - ${agenda.endTime} WIB di ${agenda.location}\nPimpinan: ${agenda.leader} (${agenda.leaderName})`,
      icon: '/favicon.ico',
      tag: `agenda-${agenda.id}`,
      requireInteraction: true
    };

    new Notification(title, options);
  } catch (err) {
    console.warn('Could not display Notification:', err);
  }
}

export interface ActiveAlert {
  agenda: AgendaItem;
  remainingMinutes: number;
  isHappeningNow: boolean;
}

/**
 * Check if an agenda is due for reminder
 */
export function checkAgendaAlert(agenda: AgendaItem, now: Date = new Date()): ActiveAlert | null {
  if (agenda.status === 'Selesai' || agenda.status === 'Dibatalkan') {
    return null;
  }

  // Parse start and end time
  const [year, month, day] = agenda.date.split('-').map(Number);
  const [startHour, startMinute] = agenda.startTime.split(':').map(Number);
  const [endHour, endMinute] = agenda.endTime.split(':').map(Number);

  const startTimestamp = new Date(year, month - 1, day, startHour, startMinute, 0).getTime();
  const endTimestamp = new Date(year, month - 1, day, endHour, endMinute, 0).getTime();
  const nowMs = now.getTime();

  // If snoozed and snooze time hasn't expired
  if (agenda.reminder.snoozedUntil && nowMs < agenda.reminder.snoozedUntil) {
    return null;
  }

  // Event already finished
  if (nowMs > endTimestamp) {
    return null;
  }

  const reminderThresholdMs = (agenda.reminder.minutesBefore || 30) * 60 * 1000;
  const triggerTimeMs = startTimestamp - reminderThresholdMs;

  const isHappeningNow = nowMs >= startTimestamp && nowMs <= endTimestamp;
  const isWithinReminderWindow = nowMs >= triggerTimeMs && nowMs < startTimestamp;

  if (agenda.reminder.enabled && (isWithinReminderWindow || isHappeningNow)) {
    const diffMs = startTimestamp - nowMs;
    const remainingMinutes = Math.max(0, Math.round(diffMs / 60000));

    return {
      agenda,
      remainingMinutes,
      isHappeningNow
    };
  }

  return null;
}

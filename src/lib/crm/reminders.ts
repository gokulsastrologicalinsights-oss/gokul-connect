import {
  CrmFollowUpReminder,
  FollowUpReminderType,
  NotificationCategory,
  NotificationFilterOptions,
  NotificationStats,
  UserNotificationPreferences,
} from "@/types/database";
import {
  createNotificationDb,
  dismissAllNotificationsDb,
  dismissNotificationDb,
  formatKolkataTimestamp,
  generateFollowUpRemindersDb,
  getKolkataDateString,
  getNotificationStatsDb,
  getUserNotificationPreferencesDb,
  listNotificationsDb,
  markAllNotificationsReadDb,
  markNotificationReadDb,
  processReminderJobsBatch,
  resetMockNotificationsStore,
  updateUserNotificationPreferencesDb,
} from "@/lib/notifications/service";

export async function getUserRemindersDb(
  businessId: string,
  userId: string,
  unreadOnly: boolean | NotificationFilterOptions = false,
  client?: any
): Promise<CrmFollowUpReminder[]> {
  const filters: NotificationFilterOptions =
    typeof unreadOnly === "boolean"
      ? { isRead: unreadOnly ? false : undefined, tab: unreadOnly ? "unread" : "all" }
      : unreadOnly;

  const result = await listNotificationsDb(businessId, userId, filters, client);
  return result.notifications;
}

export {
  resetMockNotificationsStore,
  resetMockNotificationsStore as resetMockRemindersStore,
  generateFollowUpRemindersDb,
  listNotificationsDb,
  markNotificationReadDb,
  markNotificationReadDb as markReminderReadDb,
  markAllNotificationsReadDb,
  dismissNotificationDb,
  dismissAllNotificationsDb,
  getNotificationStatsDb,
  getUserNotificationPreferencesDb,
  updateUserNotificationPreferencesDb,
  processReminderJobsBatch,
  formatKolkataTimestamp,
  getKolkataDateString,
  createNotificationDb,
};

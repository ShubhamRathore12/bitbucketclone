import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { Notification, ListNotificationsParams } from "@/types/notifications";

export async function listNotifications(
  params?: ListNotificationsParams,
): Promise<PaginatedResponse<Notification>> {
  const { data } = await apiClient.get<PaginatedResponse<Notification>>(
    "/notifications",
    { params },
  );
  return data;
}

export async function markRead(notificationId: string): Promise<Notification> {
  const { data } = await apiClient.put<ApiResponse<Notification>>(
    `/notifications/${notificationId}/read`,
  );
  return data.data;
}

export async function markAllRead(): Promise<void> {
  await apiClient.put("/notifications/read-all");
}

from django.urls import path

from . import views

urlpatterns = [
    path("", views.UserNotificationListView.as_view(), name="user-notifications-list"),
    path("health/", views.health, name="notifications-health"),
    path(
        "unread-count/",
        views.user_notification_unread_count,
        name="user-notifications-unread-count",
    ),
    path(
        "mark-all-read/",
        views.user_notification_mark_all_read,
        name="user-notifications-mark-all-read",
    ),
    path(
        "<uuid:pk>/read/",
        views.UserNotificationMarkReadView.as_view(),
        name="user-notification-mark-read",
    ),
            path("devices/", views.NotificationDeviceRegisterView.as_view(), name="notification-devices"),
            path("send-test/", views.SendTestPushView.as_view(), name="notification-send-test"),
        path("broadcast/", views.BroadcastNotificationView.as_view(), name="notification-broadcast"),
]

from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("sessions/", views.AuthSessionListView.as_view(), name="auth-sessions-list"),
    path(
        "sessions/<uuid:pk>/",
        views.AuthSessionRevokeView.as_view(),
        name="auth-sessions-revoke",
    ),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path(
        "change-password/",
        views.ChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path("health/", views.health, name="auth-health"),
]

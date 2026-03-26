from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="admin-console-health"),
    path("analytics/summary/", views.summary_kpis, name="analytics-summary"),
    path("analytics/records/by-stage/", views.records_by_stage, name="analytics-by-stage"),
    path("analytics/records/by-alert/", views.records_by_alert_level, name="analytics-by-alert"),
]

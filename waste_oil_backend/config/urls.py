"""
URL configuration for waste_oil_backend.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.records.views import api_health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", api_health),
    path("api/v1/", include("apps.workflow.urls")),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/gm/", include("apps.accounts.gm_urls")),
    path("api/v1/records/", include("apps.records.urls")),
    path("api/v1/alerts/", include("apps.alerts.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/admin-console/", include("apps.admin_console.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass

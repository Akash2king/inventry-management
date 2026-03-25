from django.urls import path

from . import views

urlpatterns = [
    path("vendors/", views.VendorListCreateView.as_view(), name="vendor-list-create"),
    path(
        "vendors/<uuid:pk>/",
        views.VendorDetailView.as_view(),
        name="vendor-detail",
    ),
    path("", views.WasteOilRecordListCreateView.as_view(), name="record-list-create"),
    path(
        "<uuid:pk>/",
        views.WasteOilRecordDetailView.as_view(),
        name="record-detail",
    ),
    path(
        "<uuid:pk>/attachments/",
        views.WasteOilRecordAttachmentView.as_view(),
        name="record-attachments",
    ),
    path("health/", views.records_health, name="records-health"),
]

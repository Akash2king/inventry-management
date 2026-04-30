from django.urls import path

from . import views

urlpatterns = [
    path("options/", views.RecordOptionListCreateView.as_view(), name="record-option-list-create"),
    path("options/<uuid:pk>/", views.RecordOptionDetailView.as_view(), name="record-option-detail"),
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
    path(
        "<uuid:pk>/photo/",
        views.WasteOilRecordPhotoView.as_view(),
        name="record-photo",
    ),
    path("health/", views.records_health, name="records-health"),
]

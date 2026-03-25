from django.urls import path

from . import gm_views

urlpatterns = [
    path(
        "departments/",
        gm_views.GmDepartmentListView.as_view(),
        name="gm-departments",
    ),
    path(
        "employees/",
        gm_views.GmEmployeeListCreateView.as_view(),
        name="gm-employees-list",
    ),
    path(
        "employees/<uuid:pk>/",
        gm_views.GmEmployeeDetailView.as_view(),
        name="gm-employees-detail",
    ),
]

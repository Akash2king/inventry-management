from django.urls import path

from . import views

urlpatterns = [
    path(
        "records/<uuid:record_id>/forward/",
        views.RecordForwardView.as_view(),
        name="workflow-record-forward",
    ),
    path(
        "records/<uuid:record_id>/forward-candidates/",
        views.RecordForwardCandidatesView.as_view(),
        name="workflow-record-forward-candidates",
    ),
    path(
        "records/<uuid:record_id>/return/",
        views.RecordReturnView.as_view(),
        name="workflow-record-return",
    ),
    path(
        "records/<uuid:record_id>/transitions/",
        views.RecordTransitionsView.as_view(),
        name="workflow-record-transitions",
    ),
    path("workflow/queue/", views.WorkflowQueueView.as_view(), name="workflow-queue"),
    path("workflow/health/", views.health, name="workflow-health"),
]

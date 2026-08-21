from django.conf import settings
from django.core.cache import cache
from django.db import models


class SystemConfig(models.Model):
    CACHE_KEY_PREFIX = "system_config:"
    CACHE_TIMEOUT = 300

    key = models.CharField(max_length=100, primary_key=True)
    value = models.TextField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="system_config_updates",
        db_column="updated_by_id",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_config"
        ordering = ["key"]
        verbose_name = "system config"
        verbose_name_plural = "system config"

    def __str__(self):
        return self.key

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        try:
            cache.delete(f"{self.CACHE_KEY_PREFIX}{self.key}")
        except Exception:
            pass

    def delete(self, *args, **kwargs):
        k = self.key
        super().delete(*args, **kwargs)
        try:
            cache.delete(f"{self.CACHE_KEY_PREFIX}{k}")
        except Exception:
            pass

    @classmethod
    def get_value(cls, key, default=None, cast=str):
        ck = f"{cls.CACHE_KEY_PREFIX}{key}"
        raw = None
        try:
            raw = cache.get(ck)
        except Exception:
            raw = None
        if raw is None:
            try:
                row = cls.objects.only("value").get(pk=key)
                raw = row.value
            except cls.DoesNotExist:
                return default
            try:
                cache.set(ck, raw, timeout=cls.CACHE_TIMEOUT)
            except Exception:
                pass

        if cast is bool:
            return str(raw).lower() in ("1", "true", "yes", "on")

        if cast in (int, float):
            try:
                return cast(raw)
            except (TypeError, ValueError):
                return default

        try:
            return cast(raw)
        except (TypeError, ValueError):
            return default

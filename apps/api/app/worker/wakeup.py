"""A dedicated autocommit connection receives cross-process commit notifications."""
import logging

import psycopg
from sqlalchemy.engine import make_url

from app.services import jobs

log = logging.getLogger(__name__)


class QueueWakeup:
    def __init__(self, url):
        self.url = make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)
        self.connection = None

    def clear(self):
        # Establish LISTEN before checking the queue, closing the query/wait race.
        jobs.queue_changed.clear()
        if self.connection is None:
            try:
                self.connection = psycopg.connect(self.url, autocommit=True, connect_timeout=5)
                self.connection.execute(f"LISTEN {jobs.QUEUE_CHANNEL}")
            except psycopg.Error:
                self.close()
                log.warning("queue listener unavailable; using polling backoff")

    def wait(self, timeout):
        if self.connection is None:
            return jobs.queue_changed.wait(timeout)
        try:
            return next(self.connection.notifies(timeout=timeout, stop_after=1), None) is not None
        except psycopg.Error:
            self.close()
            # Retain the idle delay even if the listener disconnects immediately.
            jobs.queue_changed.wait(timeout)
            return False

    def close(self):
        if self.connection is not None:
            self.connection.close()
        self.connection = None

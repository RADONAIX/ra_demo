#!/usr/bin/env python3
"""Example custom Python script managed by the dashboard.

- Reads its config from config.yaml (the dashboard edits this file over SSH).
- Run under systemd (see price-ingestor.service) so the dashboard can
  start/stop/restart it with `systemctl` and read its logs with `journalctl`.
- On restart it simply re-reads the config — no code change required to apply
  a config update from the UI.
"""
import logging
import signal
import sys
import time
from pathlib import Path

import yaml

CONFIG_PATH = Path(__file__).with_name("config.yaml")


def load_config() -> dict:
    with CONFIG_PATH.open() as fh:
        return yaml.safe_load(fh) or {}


def main() -> None:
    cfg = load_config()
    logging.basicConfig(
        level=getattr(logging, cfg.get("log_level", "INFO")),
        format="%(asctime)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    log = logging.getLogger("price_ingestor")

    running = True

    def stop(*_):
        nonlocal running
        running = False
        log.info("received signal, shutting down")

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    symbols = cfg.get("symbols", [])
    interval = int(cfg.get("interval_seconds", 30))
    batch = int(cfg.get("batch_size", 500))
    log.info("started: symbols=%s interval=%ss batch=%s", symbols, interval, batch)

    while running:
        for symbol in symbols:
            log.info("ingesting %s (batch=%s)", symbol, batch)
        time.sleep(interval)

    log.info("stopped cleanly")


if __name__ == "__main__":
    main()

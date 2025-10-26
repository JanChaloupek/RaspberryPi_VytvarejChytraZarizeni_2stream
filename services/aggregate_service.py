# services/aggregate_service.py
import logging
from services.time_utils import parse_local_key_to_range
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

class AggregateService:
    def __init__(self, db_factory):
        """
        db_factory: třída (neinstanciovaný) SqlSensorData, aby service mohla vytvářet kontextové připojení.
        """
        self.db_factory = db_factory

    def handle_aggregate(self, sensor_id: str, level: str, key: str, tz_name: Optional[str], tz_offset: Optional[str]) -> List[Dict]:
        """
        Vrátí JSON-serializovatelný seznam řádků pro danou úroveň.
        tz_offset očekává řetězec minut; převod na int se provede zde.
        """
        tz_offset_min = None
        if tz_offset is not None:
            try:
                tz_offset_min = int(tz_offset)
            except Exception:
                tz_offset_min = None

        # Log request params
        logger.info("handle_aggregate request: sensor_id=%s level=%s key=%s tz=%s tz_offset=%s",
                    sensor_id, level, key, tz_name, tz_offset_min)

        # Převod lokálního key na UTC interval vhodný pro DB dotazy
        try:
            start_db, end_db = parse_local_key_to_range(level, key, tz_name, tz_offset_min)
        except Exception as e:
            logger.exception("parse_local_key_to_range failed for key=%s level=%s tz=%s tz_offset=%s",
                             key, level, tz_name, tz_offset_min)
            raise

        # Log computed UTC interval
        logger.info("Computed UTC interval for query: start=%s end=%s (for key=%s level=%s tz=%s tz_offset=%s)",
                    start_db, end_db, key, level, tz_name, tz_offset_min)

        with self.db_factory() as db:
            if level == 'monthly':
                rows = db.get_aggregated(sensor_id, start_db, end_db, group_by='%Y-%m')
            elif level == 'daily':
                rows = db.get_aggregated(sensor_id, start_db, end_db, group_by='%Y-%m-%d')
            elif level == 'hourly':
                rows = db.get_aggregated(sensor_id, start_db, end_db, group_by='%Y-%m-%dT%H')
            elif level == 'minutely':
                rows = db.get_aggregated(sensor_id, start_db, end_db, group_by='%Y-%m-%dT%H:%M')
            elif level == 'raw':
                rows = db.get_measurements_range(sensor_id, start_db, end_db)
            else:
                raise ValueError(f'Neznámá úroveň agregace: {level}')

            result = [dict(r) for r in rows]

        # Log result summary
        logger.info("Aggregate returned %d rows for sensor=%s level=%s key=%s", len(result), sensor_id, level, key)
        if result:
            # log first item brief preview (safe to log keys/values)
            first = result[0]
            logger.debug("First row sample: %s", {k: first.get(k) for k in first.keys()})

        return result

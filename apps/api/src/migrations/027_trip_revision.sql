-- Любое изменение содержимого поездки обновляет её ревизию. Клиент использует
-- trips.updated_at для optimistic concurrency control и не перезаписывает
-- данные, если после открытия формы их уже изменил другой пользователь.
CREATE OR REPLACE FUNCTION touch_parent_trip_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_trip_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_trip_id := OLD.trip_id;
  ELSE
    parent_trip_id := NEW.trip_id;
  END IF;
  UPDATE trips SET updated_at = clock_timestamp() WHERE id = parent_trip_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_trip_from_cities ON cities;
CREATE TRIGGER touch_trip_from_cities
AFTER INSERT OR UPDATE OR DELETE ON cities
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

DROP TRIGGER IF EXISTS touch_trip_from_places ON places;
CREATE TRIGGER touch_trip_from_places
AFTER INSERT OR UPDATE OR DELETE ON places
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

DROP TRIGGER IF EXISTS touch_trip_from_tasks ON tasks;
CREATE TRIGGER touch_trip_from_tasks
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

DROP TRIGGER IF EXISTS touch_trip_from_day_notes ON trip_day_notes;
CREATE TRIGGER touch_trip_from_day_notes
AFTER INSERT OR UPDATE OR DELETE ON trip_day_notes
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

DROP TRIGGER IF EXISTS touch_trip_from_documents ON documents;
CREATE TRIGGER touch_trip_from_documents
AFTER INSERT OR UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

DROP TRIGGER IF EXISTS touch_trip_from_members ON trip_members;
CREATE TRIGGER touch_trip_from_members
AFTER INSERT OR UPDATE OR DELETE ON trip_members
FOR EACH ROW EXECUTE FUNCTION touch_parent_trip_updated_at();

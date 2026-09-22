-- Session 2 works on the session 1 dataset with the page-inspection
-- extensions loaded: every slide that opens a heap page uses pageinspect, and
-- the bloat slides quote pgstattuple.
CREATE EXTENSION pageinspect;
CREATE EXTENSION pgstattuple;
CREATE EXTENSION pg_freespacemap;

-- Autovacuum off on `orders` for the whole session. A 500k-row churn crosses
-- the default threshold, so a worker would wake up mid-talk and quietly undo
-- the slide on screen. The autovacuum slide says this out loud rather than
-- pretending the numbers it shows came from a server running normally.
ALTER TABLE orders SET (autovacuum_enabled = off);

-- 50k customers, 500k orders, ~1M order items. Large enough that a sequential
-- scan and an index scan differ visibly on the clock (E5), small enough that
-- CREATE DATABASE ... TEMPLATE restores it in well under a second.
--
-- Values come from a seeded RNG rather than arithmetic on the generated id.
-- Deriving several columns from i makes them correlated in ways the planner
-- can see: an earlier draft had status determined by customer_id, so every
-- order of a given customer shared one status. placed_at is left correlated
-- with id on purpose, because real append-only tables are.

SELECT setseed(0.42);

INSERT INTO customers (id, name, email, country, created_at)
SELECT i,
       'Customer ' || i,
       'customer' || i || '@example.com',
       (ARRAY['DE','AT','CH','FR','IT','ES','NL','SE'])[1 + floor(random() * 8)::int],
       timestamptz '2023-01-01' + floor(random() * 900)::int * interval '1 day'
FROM generate_series(1, 50000) AS i;

INSERT INTO orders (id, customer_id, status, total_cents, placed_at)
SELECT i,
       1 + floor(random() * 50000)::int,
       (ARRAY['pending','paid','shipped','delivered','cancelled'])[1 + floor(random() * 5)::int],
       500 + floor(random() * 250000)::int,
       timestamptz '2024-01-01' + i * interval '1 minute'
                                + floor(random() * 60)::int * interval '1 second'
FROM generate_series(1, 500000) AS i;

INSERT INTO order_items (id, order_id, product, quantity, price_cents)
SELECT i,
       1 + floor(random() * 500000)::int,
       (ARRAY['Keyboard','Monitor','Mouse','Laptop','Dock','Cable','Webcam','Headset'])[1 + floor(random() * 8)::int],
       1 + floor(random() * 4)::int,
       300 + floor(random() * 90000)::int
FROM generate_series(1, 999999) AS i;

ANALYZE;

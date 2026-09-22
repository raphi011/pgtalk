-- Base schema for every session. Deliberately has no indexes beyond the
-- primary keys: session 3 adds them live and measures the difference.

CREATE TABLE customers (
    id         integer PRIMARY KEY,
    name       text        NOT NULL,
    email      text        NOT NULL,
    country    text        NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE orders (
    id          integer PRIMARY KEY,
    customer_id integer     NOT NULL REFERENCES customers (id),
    status      text        NOT NULL,
    total_cents integer     NOT NULL,
    placed_at   timestamptz NOT NULL
);

CREATE TABLE order_items (
    id          integer PRIMARY KEY,
    order_id    integer NOT NULL REFERENCES orders (id),
    product     text    NOT NULL,
    quantity    integer NOT NULL,
    price_cents integer NOT NULL
);

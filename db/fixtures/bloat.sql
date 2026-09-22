-- `orders` after one full churn and no vacuum: every row rewritten, every old
-- version still in the file. The slide that watches the table double does the
-- churn live; the slides after it start here, so each can be entered cold
-- (E4) without waiting two seconds for damage the audience already saw.
UPDATE orders SET status = status;

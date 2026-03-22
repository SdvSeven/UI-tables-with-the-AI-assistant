CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    region VARCHAR(50),
    product_category VARCHAR(50),
    product_name VARCHAR(100),
    quantity INTEGER,
    price NUMERIC(10,2),
    revenue NUMERIC(12,2),
    customer_id INTEGER,
    payment_method VARCHAR(20),
    discount NUMERIC(5,2),
    extra_attributes JSONB
);

CREATE TABLE IF NOT EXISTS saved_views (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_region ON sales(region);
CREATE INDEX IF NOT EXISTS idx_sales_category ON sales(product_category);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_extra ON sales USING gin (extra_attributes);

INSERT INTO sales (sale_date, region, product_category, product_name, quantity, price, revenue, customer_id, payment_method, discount)
SELECT
    current_date - (random() * 1095)::int,
    (array['Москва','СПб','Казань','Новосибирск','Екатеринбург','Нижний Новгород','Самара','Ростов-на-Дону','Уфа','Красноярск'])[floor(random() * 10) + 1],
    (array['Электроника','Бытовая техника','Аксессуары','Одежда','Книги','Мебель','Спорт','Игрушки','Продукты','Косметика'])[floor(random() * 10) + 1],
    'Товар_' || floor(random() * 5000)::text,
    floor(random() * 5 + 1)::int,
    (random() * 100000 + 100)::numeric(10,2),
    ((random() * 100000 + 100) * floor(random() * 5 + 1))::numeric(12,2),
    floor(random() * 1000000 + 1)::int,
    (array['Карта','Наличные','Перевод','QR-код'])[floor(random() * 4) + 1],
    (random() * 30)::numeric(5,2)
FROM generate_series(1, 100000);

UPDATE sales 
SET extra_attributes = jsonb_build_object(
    'segment', (array['premium','standard','economy'])[floor(random()*3)+1],
    'loyalty_tier', (array['gold','silver','bronze'])[floor(random()*3)+1],
    'device', (array['mobile','desktop'])[floor(random()*2)+1],
    'campaign', floor(random()*50+1)::int,
    'score', random()*100
)
WHERE id % 10 = 0;
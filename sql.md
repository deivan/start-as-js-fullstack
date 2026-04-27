# 1. Базові типи даних PostgreSQL для E-commerce

PostgreSQL пропонує потужний набір типів даних. Для нашої предметної області найбільш релевантними є:

- **UUID**: Ідеальний вибір для первинних ключів (Primary Keys) розподілених систем та мікросервісів. На відміну від SERIAL, UUID генерується без звернення до єдиного лічильника бази, що зменшує блокування та робить ідентифікатори непередбачуваними.
- **NUMERIC(precision, scale)**: Обов'язковий тип для фінансових транзакцій (ціни, суми замовлень). Наприклад, NUMERIC(10, 2) гарантує відсутність помилок округлення, притаманних числам з плаваючою крапкою (FLOAT або REAL).
- **VARCHAR(n) / TEXT**: Для рядкових даних. У Postgres немає суттєвої різниці в продуктивності між ними, але VARCHAR(255) зручний для накладання логічних обмежень на рівні БД (наприклад, для email).
- **TIMESTAMPTZ (Timestamp with Time Zone)**: Зберігає дату та час з прив'язкою до UTC. Критично важливо для додатків, якими користуються в різних часових поясах.
- **JSONB**: Бінарний JSON. Корисний для зберігання неструктурованих або динамічних метаданих продукту (наприклад, специфічні характеристики: колір, розмір, матеріал), які незручно виносити в окремі реляційнІ таблицІ.

Цей конспект побудований з акцентом на фундаментальні можливості PostgreSQL. Хоча в екосистемі Node.js/Nest.js запити часто інкапсулюються за допомогою pg або ORM/Query Builders, розуміння базового SQL є критичним для проектування ефективної архітектури та оптимізації вузьких місць.

1. Базові типи даних PostgreSQL для E-commerce
PostgreSQL пропонує потужний набір типів даних. Для нашої предметної області найбільш релевантними є:

UUID: Ідеальний вибір для первинних ключів (Primary Keys) розподілених систем та мікросервісів. На відміну від SERIAL, UUID генерується без звернення до єдиного лічильника бази, що зменшує блокування та робить ідентифікатори непередбачуваними.

NUMERIC(precision, scale): Обов'язковий тип для фінансових транзакцій (ціни, суми замовлень). Наприклад, NUMERIC(10, 2) гарантує відсутність помилок округлення, притаманних числам з плаваючою крапкою (FLOAT або REAL).

VARCHAR(n) / TEXT: Для рядкових даних. У Postgres немає суттєвої різниці в продуктивності між ними, але VARCHAR(255) зручний для накладання логічних обмежень на рівні БД (наприклад, для email).

TIMESTAMPTZ (Timestamp with Time Zone): Зберігає дату та час з прив'язкою до UTC. Критично важливо для додатків, якими користуються в різних часових поясах.

JSONB: Бінарний JSON. Корисний для зберігання неструктурованих або динамічних метаданих продукту (наприклад, специфічні характеристики: колір, розмір, матеріал), які незручно виносити в окремі реляційні таблиці.

# 2. Схеми бази даних: Навіщо вони потрібні?

В PostgreSQL Схема (Schema) — це простір імен, який містить іменовані об'єкти (таблиці, типи, функції). За замовчуванням всі таблиці створюються в схемі public.

Чому це важливо:

1. **Логічна ізоляція**: Дозволяє розділити велику базу на модулі (наприклад, auth, catalog, billing).

2. **Безпека**: Можна легко обмежити доступ конкретним ролям лише до певних схем.

3. **Мультитеннантність (Multi-tenancy)**: Дозволяє обслуговувати кількох клієнтів (B2B) в одній базі даних, створюючи для кожного окрему схему з однаковою структурою таблиць.

Приклад створення схеми:

```sql
CREATE SCHEMA IF NOT EXISTS shop;
```

# 3. Архітектура бази даних E-commerce

Нижче наведено DDL команди для створення таблиць у нашій створеній схемі shop. Тут ми реалізуємо відношення Один-до-багатьох (1:N) та Багато-до-багатьох (N:M).

Створення базових сутностей та відношень

```sql
-- Таблиця користувачів
CREATE TABLE shop.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблиця категорій
CREATE TABLE shop.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Таблиця продуктів
CREATE TABLE shop.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    attributes JSONB, -- Для динамічних характеристик
    created_at TIMESTAMPTZ DEFAULT NOW()
);
``` 

## Відношення: Багато-до-багатьох (N:M)

Один продукт може належати до кількох категорій (наприклад, "Смартфони" та "Акції"), а категорія має багато продуктів. Для цього створюється проміжна (join) таблиця.

```sql
CREATE TABLE shop.product_categories (
    product_id UUID REFERENCES shop.products(id) ON DELETE CASCADE,
    category_id INT REFERENCES shop.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id) -- Складений первинний ключ
);
```

## Відношення: Один-до-багатьох (1:N) – Корзина

Користувач має одну корзину, яка складається з багатьох позицій. Найпростіша реалізація — прив'язати елементи корзини безпосередньо до користувача.

```sql
CREATE TABLE shop.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES shop.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop.products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id) -- Запобігає дублюванню одного товару в корзині
);
```

# 4. Система рейтингів та перевірка фактів покупки

Бізнес-логіка: Користувач може залишити рейтинг лише якщо він купив цей товар.
Для цього нам потрібна історія замовлень.

```sql
-- Таблиця замовлень
CREATE TABLE shop.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES shop.users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Позиції замовлення (фіксують ціну на момент покупки)
CREATE TABLE shop.order_items (
    order_id UUID REFERENCES shop.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop.products(id),
    quantity INT NOT NULL,
    price_at_purchase NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

## Архітектура таблиці рейтингів

Ми використовуємо складений унікальний індекс UNIQUE(user_id, product_id), щоб один користувач не міг накручувати рейтинг, залишаючи сотні відгуків на один товар.

```sql
CREATE TABLE shop.product_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES shop.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop.products(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id) 
);
```

# 5. Типові запити (Queries) з реальними прикладами

## Отримання вмісту корзини з даними про продукти (JOIN)

Цей запит використовується для відображення сторінки "Моя корзина". Він об'єднує таблицю позицій корзини з деталями продукту та обчислює загальну вартість рядка.

```sql
SELECT 
    p.id AS product_id,
    p.name,
    p.price,
    ci.quantity,
    (p.price * ci.quantity) AS subtotal
FROM shop.cart_items ci
JOIN shop.products p ON ci.product_id = p.id
WHERE ci.user_id = 'c1234567-89ab-cdef-0123-456789abcdef';
```

## Перевірка права на відгук (Subquery / EXISTS)

Перед тим як Node.js/Nest.js зробить INSERT в таблицю product_ratings, необхідно виконати перевірку, чи існує завершене замовлення цього користувача з цим товаром.

```sql
SELECT EXISTS (
    SELECT 1 
    FROM shop.orders o
    JOIN shop.order_items oi ON o.id = oi.order_id
    WHERE o.user_id = 'c1234567-89ab-cdef-0123-456789abcdef' -- ID автентифікованого користувача
      AND oi.product_id = 'a1234567-89ab-cdef-0123-456789abcdef' -- ID продукту
      AND o.status = 'completed'
) AS can_leave_review;
```

Якщо запит повертає true, бекенд дозволяє вставку рейтингу.


## Агрегація: Отримання каталогу продуктів з їх середнім рейтингом

Приклад того, як об'єднати продукти, їх категорії та обчислити середній рейтинг "на льоту".

```sql
SELECT 
    p.id,
    p.name,
    p.price,
    ARRAY_AGG(c.name) AS categories, -- Збираємо категорії у масив
    COALESCE(ROUND(AVG(pr.rating), 2), 0) AS average_rating,
    COUNT(pr.id) AS total_reviews
FROM shop.products p
LEFT JOIN shop.product_categories pc ON p.id = pc.product_id
LEFT JOIN shop.categories c ON pc.category_id = c.id
LEFT JOIN shop.product_ratings pr ON p.id = pr.product_id
GROUP BY p.id
ORDER BY average_rating DESC;
```

(Функція COALESCE гарантує, що якщо відгуків немає, повернеться 0, а не NULL).

# 6. Оптимізація бази даних: Композитні індекси та Пошук

Індекс у PostgreSQL — це окрема структура даних (найчастіше B-Tree), яка зберігає значення певних колонок у відсортованому вигляді, що дозволяє знаходити рядки за логарифмічний час замість лінійного.

## 6.1 Композитні індекси (Складені індекси)

Композитний індекс будується на двох або більше колонках. Головне правило композитного індексу: порядок колонок має значення. PostgreSQL може використовувати такий індекс для пошуку, лише якщо в запиті (у WHERE) використовуються колонки з індексу зліва направо.

### Практичний приклад:

На сторінці товару нам потрібно вивести останні відгуки. Для цього ми робимо запит до таблиці shop.product_ratings, фільтруємо за product_id і сортуємо за датою created_at за спаданням.

Типовий запит:

```sql
SELECT user_id, rating, review, created_at
FROM shop.product_ratings
WHERE product_id = 'a1234567-89ab-cdef-0123-456789abcdef'
ORDER BY created_at DESC
LIMIT 10;
```

Без індексу база знайде всі відгуки для продукту, а потім буде сортувати їх у пам'яті (Memory Sort), що повільно для популярних товарів з тисячами відгуків.

Створення ідеального композитного індексу для цього запиту:

```sql
CREATE INDEX idx_product_ratings_product_date 
ON shop.product_ratings (product_id, created_at DESC);
```

Чому це працює: Індекс вже зберігає дані згрупованими за product_id, а всередині кожної групи вони вже відсортовані за created_at від найновіших. Базі даних достатньо "стрибнути" до потрібного product_id і просто прочитати перші 10 записів. Сортування (найважча операція) взагалі не виконується!

## 6.2 Оптимізація пошуку за динамічними атрибутами (JSONB + GIN)

В сучасному e-commerce товари мають безліч різних характеристик (колір, розмір, діагональ екрану), які зручно зберігати в колонці типу JSONB (у нашому конспекті це колонка attributes у таблиці products).

### Практичний приклад:

Користувач обрав фільтри: "Колір: Чорний" та "Матеріал: Шкіра". Ваш Nest.js формує запит:

```sql
SELECT id, name, price 
FROM shop.products
WHERE attributes @> '{"color": "black", "material": "leather"}';
```

(Оператор @> перевіряє, чи містить лівий JSONB об'єкт дані з правого JSONB об'єкта).

Щоб цей запит працював миттєво серед мільйонів товарів, стандартний B-Tree індекс не підійде. Нам потрібен індекс типу GIN (Generalized Inverted Index).

### Створення GIN індексу:

```sql
CREATE INDEX idx_products_attributes_gin 
ON shop.products USING GIN (attributes);
```

## 6.3 Повнотекстовий пошук (Full-Text Search) замість повільного LIKE

Пошук товарів за назвою через WHERE name ILIKE '%iphone%' є антипатерном для великих баз, оскільки такий запит не може використовувати звичайні B-Tree індекси та завжди призводить до повного сканування таблиці.

PostgreSQL має вбудований потужний механізм повнотекстового пошуку на основі лексем.

### Практичний приклад:

Ми хочемо, щоб пошук "чорні кросівки" знаходив товар "Кросівки спортивні, чорний колір".

1. Для цього ми перетворюємо текст у вектор слів (лексем) за допомогою функції to_tsvector.
2. Пошуковий запит користувача перетворюємо на to_tsquery.

Типовий запит пошуку:

```sql
SELECT id, name, price 
FROM shop.products
-- 'simple' - це словник (в реальному проєкті використовується словник мови, наприклад 'english' або кастомний)
WHERE to_tsvector('simple', name) @@ to_tsquery('simple', 'кросівки & чорний');
```

Щоб цей пошук був швидким, ми будуємо GIN індекс на результаті функції (Expression Index):

```sql
CREATE INDEX idx_products_name_search 
ON shop.products USING GIN (to_tsvector('simple', name));
```

Тепер PostgreSQL може миттєво знаходити товари за ключовими словами, враховуючи логічні оператори (І, АБО, НЕ) у пошуковому рядку, який генерує ваш бекенд на Node.js.

## 6.4 Часткові індекси (Partial Indexes)

Іноді нам потрібно швидко шукати лише "активні" товари або ті, що є в наявності. Немає сенсу індексувати товари, які видалені або зняті з продажу.

### Практичний приклад:
Припустимо, ми додали колонку is_active BOOLEAN до таблиці продуктів. Більшість запитів від клієнтів шукають лише активні товари.

```sql
CREATE INDEX idx_active_products_price 
ON shop.products (price)
WHERE is_active = true;
```

**Переваги:** Такий індекс займає значно менше місця на диску і в оперативній пам'яті (бо не містить неактивних товарів), і оновлюється швидше. Запит SELECT * FROM shop.products WHERE is_active = true ORDER BY price буде виконано максимально ефективно.

# 7. Цей неймовірний GIN

GIN (Generalized Inverted Index) розкриває свою справжню міць, коли ми працюємо з колонками, що містять множинні значення (composite values). Якщо класичний B-Tree індекс вказує на конкретне значення рядка, то GIN створює "словник" елементів, що знаходяться всередині даних (всередині масивів, JSON-об'єктів або тексту), і вказує, в яких рядках таблиці зустрічається кожен елемент.

## 7.1. Робота з масивами (Arrays): Система тегів або маркерів

Дуже часто в e-commerce замість створення окремої таблиці для зв'язків багато-до-багатьох (якщо теги прості і не мають власних метаданих), їх зберігають просто як масив рядків.

**Сценарій**: Додамо до таблиці shop.products колонку tags TEXT[].

```sql
ALTER TABLE shop.products ADD COLUMN tags TEXT[];
```

Якщо ми хочемо знайти товари з певними тегами, запити без індексу будуть сканувати всю таблицю. Створимо GIN-індекс:

```sql
CREATE INDEX idx_products_tags_gin ON shop.products USING GIN (tags);
```

Практичні запити, які цей індекс прискорить:

- Знайти товари, які мають і тег 'sale', і тег 'summer' (Оператор @> - contains):
```sql
SELECT name, tags FROM shop.products 
WHERE tags @> ARRAY['sale', 'summer'];
```
- Знайти товари, які мають хоча б один з тегів 'eco', 'handmade' або 'vegan' (Оператор && - overlap/перетин):
```sql
SELECT name, tags FROM shop.products 
WHERE tags && ARRAY['eco', 'handmade', 'vegan'];
```
- Знайти товари, які не мають тегу 'outlet' (Оператор NOT @>):
```sql
SELECT name, tags FROM shop.products 
WHERE NOT (tags @> ARRAY['outlet']);
```

## 7.2. Нечіткий пошук та оптимізація ILIKE (Розширення pg_trgm)

Використання LIKE '%слово%' або ILIKE '%слово%' ігнорує звичайні B-Tree індекси, що є класичною причиною падіння продуктивності бекенду. Однак за допомогою GIN та вбудованого розширення pg_trgm (триграми) цю проблему можна вирішити елегантно.

Це особливо корисно для пошуку з опечатками (fuzzy search), коли користувач ввів "кросвкі" замість "кросівки" або шукає частину артикулу.

**Сценарій**: Налаштування швидкого пошуку за частиною назви або артикулу товару.

1. Спочатку потрібно увімкнути розширення (виконується один раз на базу):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
2. Створюємо спеціальний GIN-індекс з операційним класом gin_trgm_ops:
```sql
CREATE INDEX idx_products_name_trgm 
ON shop.products USING GIN (name gin_trgm_ops);
```

Практичні запити, які тепер літають:

- Швидкий ILIKE з підстановкою з обох боків:
```sql
SELECT id, name FROM shop.products 
WHERE name ILIKE '%iphone 15 pro%';
```
(База розіб'є запит на 3-літерні послідовності (триграми) і швидко знайде відповідності через GIN-індекс).
- Пошук за подібністю (Similarity Search) з невідповідністю в написанні:
```sql
SELECT id, name, similarity(name, 'айфон') AS sim_score
FROM shop.products 
WHERE name % 'айфон' -- Оператор подібності (fuzzy match)
ORDER BY sim_score DESC;
```
(Цей запит знайде товари, назви яких схожі на "айфон", навіть якщо є помилки в написанні).

## 7.3. "Глибокий" пошук по ключах у JSONB

У попередньому повідомленні ми розглядали індексацію всього JSONB об'єкта для пошуку точних пар ключ-значення (наприклад, {"color": "black"}). Але GIN-індекс jsonb_ops (який використовується за замовчуванням для JSONB) також ідеально підходить для перевірки існування ключів, незалежно від їх значень.

**Сценарій**: У нас є динамічна колонка attributes JSONB. Маркетологи хочуть знайти всі товари, для яких контент-менеджери заповнили поле "гарантія" (warranty), незалежно від того, яка вона (12 місяців, 3 роки тощо). Або товари, що мають і "вагу", і "габарити".

**Індекс**:
```sql
CREATE INDEX idx_products_attributes_gin ON shop.products USING GIN (attributes);
```

**Практичні запити:**

- Чи існує конкретний ключ у JSON об'єкті? (Оператор ?):
```sql
SELECT name, attributes 
FROM shop.products 
WHERE attributes ? 'warranty';
```
(Цей запит поверне всі товари, у яких є ключ "warranty" в колонці attributes, незалежно від його значення).
- Чи існують ВСІ перелічені ключі? (Оператор ?&):
```sql
SELECT name, attributes 
FROM shop.products 
WHERE attributes ?& ARRAY['weight', 'dimensions'];
```
(Поверне товари, які мають обидва ключі "weight" та "dimensions" у своїх атрибутах).
- Чи існує ХОЧА БИ ОДИН з перелічених ключів? (Оператор ?|):
```sql
SELECT name, attributes 
FROM shop.products 
WHERE attributes ?| ARRAY['bluetooth', 'wifi'];
```
(Поверне товари, які мають хоча б один з ключів "bluetooth" або "wifi" у своїх атрибутах).

Ці запити будуть виконуватися миттєво навіть на великих таблицях, оскільки GIN-індекс дозволяє швидко знаходити рядки, що містять потрібні ключі в JSONB колонці.
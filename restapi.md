# Лекція: Побудова архітектури REST API за допомогою Node.js 22 та Express.js v5

## Вступ

Сучасні веб-додатки вимагають надійної, масштабованої та зрозумілої архітектури для обміну даними між клієнтом та сервером. Одним із найпопулярніших архітектурних стилів для цієї задачі є REST (Representational State Transfer). 

У цій лекції ми розберемо принципи побудови REST API, використовуючи серверну платформу Node.js версії 22 та фреймворк для маршрутизації Express.js версії 5. 

---

## 1. Архітектура REST API взагалі

**REST** — це архітектурний стиль, який визначає набір обмежень для створення веб-сервісів. API, що відповідають цим правилам, називаються *RESTful API*. 

Ключові принципи REST:
* **Клієнт-серверна архітектура:** Чітке розділення між інтерфейсом користувача (клієнтом) та зберіганням/обробкою даних (сервером).
* **Відсутність стану (Stateless):** Кожен запит від клієнта до сервера повинен містити всю необхідну інформацію для його розуміння та обробки. Сервер не зберігає стан сесії між запитами.
* **Єдиний інтерфейс:** Уніфікований спосіб взаємодії з ресурсами. У REST ресурси ідентифікуються за допомогою URI (Uniform Resource Identifier), а взаємодія з ними відбувається через стандартні HTTP-методи.
* **Представлення ресурсів:** Дані (ресурси) найчастіше передаються у форматі JSON, який є стандартом де-факто для сучасних REST API.

---

## 2. Типи HTTP-запитів (Методи) та їх зона застосування

У REST API HTTP-методи діють як дії (дієслова), які застосовуються до ресурсів (іменників).

* **GET** — отримання ресурсу або списку ресурсів. Ніколи не повинен змінювати стан даних (безпечний та ідемпотентний метод).
* **POST** — створення нового ресурсу. Дані передаються у тілі запиту.
* **PUT** — повне оновлення існуючого ресурсу. Якщо ресурс не знайдено, він може бути створений.
* **PATCH** — часткове оновлення існуючого ресурсу (наприклад, зміна лише статусу замовлення).
* **DELETE** — видалення ресурсу.

### Приклад застосування (Модель `Article`):
* `GET /api/articles` — Отримати список усіх статей.
* `GET /api/articles/123` — Отримати статтю з ID 123.
* `POST /api/articles` — Створити нову статтю.
* `PUT /api/articles/123` — Повністю перезаписати дані статті 123.
* `PATCH /api/articles/123` — Оновити лише заголовок статті 123.
* `DELETE /api/articles/123` — Видалити статтю 123.

---

## 3. Робота з параметрами запиту: `req.body`, `req.query`, `req.params`

Express.js надає три основні об'єкти для отримання даних від клієнта.

* **`req.params` (Параметри маршруту):** Використовуються для ідентифікації конкретного ресурсу в URI.
* **`req.query` (Параметри рядка запиту):** Використовуються для фільтрації, сортування або пагінації. Додаються до URL після знаку `?`.
* **`req.body` (Тіло запиту):** Використовується для передачі корисного навантаження (payload) при створенні або оновленні ресурсів (POST, PUT, PATCH).

> **Ключова особливість Express v5:** У 5-й версії була впроваджена нативна підтримка `Promise`. Якщо ваш асинхронний обробник маршруту (`async`) викидає помилку (`throw new Error(...)`) або повертає відхилений проміс, Express v5 **автоматично** передасть цю помилку до middleware обробки помилок. Вам більше не потрібно огортати весь код у `try...catch(err) { next(err) }`, як це було обов'язково у 4-й версії.

### Приклад (використання Node.js 22 ES Modules):

```javascript
import express from 'express';

const app = express();
// Middleware для парсингу JSON у тілі запиту (req.body)
app.use(express.json());

// GET запит з використанням req.params та req.query
// Приклад URL: /api/products/electronics?sort=price_desc&limit=10
app.get('/api/products/:category', async (req, res) => {
    const category = req.params.category; // Отримуємо 'electronics'
    const { sort, limit } = req.query;    // Отримуємо 'price_desc' та '10'

    // Імітація запиту до БД
    const products = await ProductModel.findByCategory(category, sort, limit);
    
    // В Express 5, якщо ProductModel викине помилку, вона автоматично
    // буде перехоплена глобальним обробником помилок.
    res.json({ success: true, data: products });
});

// POST запит з використанням req.body
// Приклад URL: /api/products
app.post('/api/products', async (req, res) => {
    const { name, price, description } = req.body; // Отримуємо дані з тіла

    if (!name || !price) {
        // Ця помилка автоматично піде в error handler
        throw new Error('Name and price are required'); 
    }

    const newProduct = await ProductModel.create({ name, price, description });
    res.status(201).json({ success: true, data: newProduct });
});
```

---

## 4. Побудування файлів модулів для різних функціональних роутів

Для підтримки чистоти коду та масштабованості проєкту, маршрути та бізнес-логіку слід розділяти. Express пропонує клас `express.Router()` для створення модульних обробників маршрутів.

Рекомендована структура директорій:
```text
src/
 ├── controllers/    # Логіка обробки запитів (бізнес-логіка)
 │    └── user.controller.js
 ├── routes/         # Визначення маршрутів
 │    └── user.routes.js
 ├── models/         # Схеми баз даних
 └── app.js          # Головний файл ініціалізації Express
```

### Приклад модульного роутингу:

**1. `src/controllers/user.controller.js`**
```javascript
export const getUserById = async (req, res) => {
    const user = await UserModel.findById(req.params.id);
    if (!user) throw new Error('User not found');
    res.json({ data: user });
};

export const createUser = async (req, res) => {
    const newUser = await UserModel.create(req.body);
    res.status(201).json({ data: newUser });
};
```

**2. `src/routes/user.routes.js`**
```javascript
import { Router } from 'express';
import { getUserById, createUser } from '../controllers/user.controller.js';

const router = Router();

// Маршрути відносно базового шляху, який буде задано в app.js
router.get('/:id', getUserById);
router.post('/', createUser);

export default router;
```

**3. `src/app.js`**
```javascript
import express from 'express';
import userRoutes from './routes/user.routes.js';

const app = express();
app.use(express.json());

// Підключення модульного роутера
// Усі запити до /api/users будуть оброблятися в user.routes.js
app.use('/api/users', userRoutes);

// Глобальний обробник помилок (Express 5 автоматично направляє сюди throw)
app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(3000, () => console.log('Server is running on port 3000'));
```

---

## 5. Забезпечення безпеки запитів та використання політики CORS

Безпека REST API — це критичний аспект. Двома основними складовими базової безпеки є налаштування HTTP-заголовків та управління політикою єдиного походження (CORS).

### CORS (Cross-Origin Resource Sharing)
За замовчуванням браузери блокують запити до API з інших доменів задля безпеки. CORS дозволяє серверу вказати, з яких доменів (origin), які методи та заголовки дозволено приймати. Для цього використовується бібліотека `cors`.

### Захист заголовків з Helmet
Бібліотека `helmet` автоматично встановлює різноманітні HTTP-заголовки (наприклад, `X-XSS-Protection`, `Content-Security-Policy`, приховує `X-Powered-By`), що захищає додаток від багатьох поширених вразливостей.

### Приклад налаштування безпеки:

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// 1. Встановлення безпечних HTTP-заголовків
app.use(helmet());

// 2. Налаштування CORS
const corsOptions = {
    origin: ['https://mydomain.com', 'https://dev.mydomain.com'], // Дозволені домени
    methods: ['GET', 'POST', 'PUT', 'DELETE'],                    // Дозволені методи
    allowedHeaders: ['Content-Type', 'Authorization'],            // Дозволені заголовки клієнта
    credentials: true                                             // Дозвіл на передачу cookies
};

app.use(cors(corsOptions));

// 3. Парсинг тіла запиту (з обмеженням розміру для запобігання DDoS)
app.use(express.json({ limit: '10kb' }));

app.post('/api/secure-data', async (req, res) => {
    // Цей маршрут тепер захищений від базових атак та 
    // приймає запити лише з дозволених доменів.
    res.json({ message: 'Secure data processed successfully' });
});
```

Додатково для безпеки REST API рекомендується впровадити лімітування запитів (Rate Limiting) за допомогою `express-rate-limit`, щоб захистити сервер від атак перебору (Brute Force) та перевантаження.

---

### Підсумок
Побудова REST API на базі Node.js 22 та Express v5 стала ще зручнішою завдяки підтримці сучасних стандартів JavaScript та нативній обробці асинхронних помилок. Чітке розділення логіки через `express.Router()`, правильне використання HTTP-методів та параметрів (`req.query`, `req.body`, `req.params`), а також обов'язкове налаштування CORS і Helmet створюють міцний фундамент для масштабованого та безпечного бекенду.

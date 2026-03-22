📘 Async / Await у JavaScript


🧠 1. Проблема Promise-ланцюгів
При використанні .then() код може ставати:
вкладеним
менш читабельним
Особливо при:
багатьох асинхронних операціях
залежностях між ними

📌 Це називають:

"Promise hell" (аналог callback hell)

🚀 2. async / await — рішення

async/await — синтаксичний цукор над Promise

👉 Дозволяє писати асинхронний код як синхронний

📌 Основні правила
async:
завжди повертає Promise
await:
чекає виконання Promise
можна використовувати тільки всередині async

💻 3. Базовий приклад

Файл: async-basic.js
```js
async function getData() {
  return "Hello";
}

getData().then(console.log);
```

📌 Пояснення:

функція автоматично повертає Promise

⏳ 4. Використання await

Файл: await-example.js
```js
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  await delay(1000);
  console.log("Done");
}

run();
```

📌 await:

зупиняє виконання функції
не блокує весь JS (тільки async-функцію)

🔗 5. Послідовні операції

Файл: sequential.js
```js
async function load() {
  const a = await fetch("/a");
  const b = await fetch("/b");
  const c = await fetch("/c");

  console.log(a, b, c);
}
```

📌 Виконання:

строго по черзі

⚡ 6. Паралельні операції

👉 Проблема:

await у ряд → повільно
✅ Рішення: Promise.all

Файл: parallel.js
```js
async function load() {
  const [a, b, c] = await Promise.all([
    fetch("/a"),
    fetch("/b"),
    fetch("/c")
  ]);

  console.log(a, b, c);
}
```

📌 Виконання:

паралельно
швидше

❌ 7. Обробка помилок (try/catch)

Файл: try-catch.js
```js
async function load() {
  try {
    const data = await fetch("/api");
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}
```

📌 Аналог:

.catch() у Promise

🔁 8. await + Promise methods

Можна комбінувати:
```js
async function run() {
  const result = await Promise.race([
    fetch("/fast"),
    fetch("/slow")
  ]);

  console.log(result);
}
```
🧩 9. Важливі особливості

🔹 await працює тільки з Promise
await 5; // працює, але обгортається в Promise

🔹 async функція завжди повертає Promise
async function test() {
  return 42;
}

// те саме що:
Promise.resolve(42);

🔹 можна використовувати в циклах
for (const item of items) {
  await process(item);
}


📌 Але:

це буде послідовно

⚠️ 10. Типові помилки
❌ Забули await
const data = fetch("/api");
console.log(data); // Promise, а не результат

❌ Зайвий await
await Promise.all([...]); // ок
await fetch(); // ок


👉 Але не завжди потрібен

❌ Послідовність замість паралельності
await fetch("/a");
await fetch("/b");


👉 краще:

await Promise.all([fetch("/a"), fetch("/b")]);

📊 11. Порівняння: Promise vs async/await
Promise	async/await
then/catch	try/catch
ланцюжки	синхронний стиль
складніше читати	простіше

🧾 12. Висновки
async/await:
робить код читабельнішим
спрощує обробку помилок
await:
не блокує потік
лише призупиняє функцію
Для продуктивності:
використовуй Promise.all

### Посилання на репозиторій з прикладами

https://github.com/HowProgrammingWorks/AsyncAwait

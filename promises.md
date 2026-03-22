📘 Асинхронність через Promise (all, then, catch, race)


🧠 1. Асинхронність у JavaScript

JavaScript є однопоточним
Асинхронність дозволяє:
не блокувати виконання
працювати з API, таймерами, файлами
❗ Проблема
Callback Hell (вкладені колбеки)
✅ Рішення
Використання Promise

🔄 2. Promise — основи

Promise — це об’єкт, який представляє результат асинхронної операції.

📌 Стани:
pending — очікування
fulfilled — успішно
rejected — помилка
💻 Приклад

Файл: promise-basic.js
```js
const promise = new Promise((resolve, reject) => {
  const success = true;

  if (success) {
    resolve("Операція успішна");
  } else {
    reject("Помилка");
  }
});
```

⛓ 3. then()

Виконується при успішному завершенні Promise

💻 Приклад

Файл: then-example.js
```js
promise.then((result) => {
  console.log(result);
});
```

🔗 Ланцюжки then

Файл: then-chain.js
```js
promise
  .then((data) => {
    return data + "!";
  })
  .then((data) => {
    console.log(data);
  });
```

📌 Важливо:

кожен then повертає новий Promise

❌ 4. catch()

Обробка помилок

💻 Приклад

Файл: catch-example.js
```js
promise
  .then((result) => {
    console.log(result);
  })
  .catch((error) => {
    console.error(error);
  });
```

📌 Ловить помилки з усього ланцюга

🧹 5. finally()

Виконується незалежно від результату

💻 Приклад

Файл: finally-example.js
```js
promise
  .then((res) => console.log(res))
  .catch((err) => console.error(err))
  .finally(() => console.log("Завершено"));
```

📦 6. Promise.all()

Виконує всі Promise паралельно

💻 Приклад

Файл: promise-all.js
```js
const p1 = Promise.resolve(1);
const p2 = Promise.resolve(2);
const p3 = Promise.resolve(3);

Promise.all([p1, p2, p3])
  .then((results) => {
    console.log(results); // [1, 2, 3]
  })
  .catch((err) => console.error(err));
```

📌 Особливості:

повертає масив результатів
fail-fast (помилка, якщо один впав)

⚡ 7. Promise.race()

Повертає перший завершений Promise

💻 Приклад

Файл: promise-race.js
```js
const p1 = new Promise((resolve) =>
  setTimeout(() => resolve("A"), 1000)
);

const p2 = new Promise((resolve) =>
  setTimeout(() => resolve("B"), 500)
);

Promise.race([p1, p2])
  .then((result) => {
    console.log(result); // "B"
  });
```

🧩 8. Практичні патерни

🌐 API-запит
fetch("https://api.example.com/data")
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));

🔀 Паралельні запити
Promise.all([
  fetch("/users"),
  fetch("/posts")
])
.then(([users, posts]) => {
  // обробка результатів
});

⏱ Таймаут через race
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject("Timeout"), 3000)
);

Promise.race([
  fetch("/data"),
  timeout
])
.catch(err => console.error(err));

📊 9. Шпаргалка

Метод	Що робить
then	обробка успіху
catch	обробка помилки
finally	завжди виконується
all	всі Promise паралельно
race	перший результат

🧾 10. Висновки

Promise — базовий інструмент асинхронності
дозволяє уникнути callback hell
підтримує:
ланцюжки (then)
централізовану обробку помилок (catch)
паралельність (all)
контроль часу (race)


### Посилання на репо з прикладами:

https://github.com/HowProgrammingWorks/Promise

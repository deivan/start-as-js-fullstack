# 02. Серверна середа виконання скриптів на мові Javascript - Node.js 

## Знайомство зі створенням веб-сервера на Node.js

Node.js - це середовище виконання JavaScript, яке дозволяє запускати JavaScript код на сервері. Це відкриває безмежні можливості для розробки веб-додатків, API та інших серверних рішень. У цій статті ми розглянемо основи створення веб-сервера на Node.js, а також відмінності виконання скриптів у Node.js та браузері.

### Відмінності виконання скриптів у Node.js та браузері
JavaScript традиційно використовується для розробки веб-сторінок, які виконуються в браузері. Проте, Node.js дозволяє виконувати JavaScript код на сервері. Ось деякі ключові відмінності:

Середовище виконання: У браузері JavaScript виконується в контексті веб-сторінки, має доступ до DOM та інших об'єктів браузера. У Node.js JavaScript виконується в окремому середовищі, має доступ до файлової системи, мережі та інших серверних ресурсів.
Об'єкти: У браузері існують об'єкти window, document та інші, що представляють веб-сторінку та її елементи. У Node.js існують інші об'єкти, такі як process, require та інші, що забезпечують доступ до серверних ресурсів.
Створення найпростішого сервера
Для створення веб-сервера на Node.js використовується модуль http. Ось простий приклад:



``` JavaScript
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Привіт, світ!');
});

server.listen(3000, () => {
  console.log('Сервер запущено на порту 3000');
});
```

Цей код створює сервер, який слухає порт 3000. Коли надходить запит, сервер відправляє відповідь "Привіт, світ!" з кодом 200 (успіх) та типом вмісту text/plain.

### Об'єкти Request та Response
У прикладі вище, req - це об'єкт запиту (Request), який містить інформацію про запит, що надійшов (наприклад, URL, метод, заголовки). res - це об'єкт відповіді (Response), який використовується для формування відповіді, яку сервер відправляє клієнту.

Request: Об'єкт req має різні властивості та методи для отримання інформації про запит. Наприклад, req.url містить URL запиту, req.method містить метод запиту (GET, POST тощо).
Response: Об'єкт res має методи для встановлення заголовків (res.writeHead), відправки даних (res.write) та завершення відповіді (res.end).
Типи даних у відповіді
Веб-сервер може повертати різні типи даних у відповіді:

- Текст: text/plain (звичайний текст), text/html (HTML-сторінка), text/css (CSS-стилі), text/javascript (JavaScript-код)
- JSON: application/json (формат даних JSON)
- Зображення: image/jpeg, image/png, image/gif
- Інші: application/pdf, audio/mpeg тощо.
- Вибір типу даних залежить від того, який вміст ви хочете надіслати клієнту.

### Звичайно, давайте детальніше розглянемо різні типи даних, які веб-сервер може повертати у відповідях, з прикладами коду на Node.js.

1. Текст (text/plain)
Найпростіший тип даних - це звичайний текст. Сервер відправляє текст без будь-якого форматування.

```JavaScript

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello, World! This is plain text.');
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```
У цьому прикладі сервер повертає текст "Hello, World! This is plain text.". Заголовок Content-Type встановлено на text/plain, що вказує браузеру, як обробляти цей текст.

2. HTML (text/html)
HTML використовується для створення веб-сторінок. Сервер може повертати HTML-код, який браузер відобразить у вигляді веб-сторінки.

```JavaScript

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Web Page</title>
    </head>
    <body>
      <h1>Hello, World!</h1>
      <p>This is an HTML page.</p>
    </body>
    </html>
  `);
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```
У цьому прикладі сервер повертає HTML-код, який містить заголовок та абзац. Заголовок Content-Type встановлено на text/html, що вказує браузеру, що це HTML-код.

3. JSON (application/json)
JSON (JavaScript Object Notation) є популярним форматом для обміну даними між сервером та клієнтом. Сервер може повертати JSON-об'єкт, який містить дані у структурованому вигляді.

```JavaScript

const http = require('http');

const server = http.createServer((req, res) => {
  const data = {
    name: 'John Doe',
    age: 30,
    city: 'New York'
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```
У цьому прикладі сервер повертає JSON-об'єкт, який містить інформацію про користувача. Заголовок Content-Type встановлено на application/json, що вказує браузеру, що це JSON-дані.

4. Зображення (image/jpeg, image/png тощо)
Сервер може повертати зображення різних форматів, таких як JPEG, PNG, GIF тощо.

```JavaScript

const fs = require('fs');
const http = require('http');

const server = http.createServer((req, res) => {
  fs.readFile('image.jpg', (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading image');
    } else {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    }
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```
У цьому прикладі сервер читає файл зображення image.jpg та повертає його вміст у відповіді. Заголовок Content-Type встановлено на image/jpeg, що вказує браузеру, що це зображення у форматі JPEG.

5. Інші типи даних
Крім перелічених вище, сервер може повертати й інші типи даних, такі як PDF-файли (application/pdf), аудіо-файли (audio/mpeg), відео-файли (video/mp4) тощо.


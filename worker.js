// Слухаємо повідомлення від головного потоку
self.addEventListener('message', function(event) {
  const jsonString = event.data;
  
  // Парсинг відбувається у фоновому потоці
  const parsedObject = JSON.parse(jsonString);
  
  // Відправляємо готовий об'єкт назад у головний потік
  self.postMessage(parsedObject);
});
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

if (isMainThread) {
  // ==========================================
  // КОД ГОЛОВНОГО ПОТОКУ (Мейн-тред)
  // ==========================================

  // 1. Генеруємо "важкий" JSON-рядок
  const hugeData = Array(1000000).fill({ id: 1, name: "Користувач", status: "Активний" });
  const jsonString = JSON.stringify(hugeData);

  console.log("Головний потік: Запускаємо Worker...");
  const startTime = performance.now();

  // 2. Створюємо Worker. 
  // __filename означає, що воркер запустить цей самий файл, але isMainThread буде false.
  // Дані передаємо через workerData.
  const worker = new Worker(__filename, {
    workerData: jsonString
  });

  // 3. Імітуємо роботу сервера (наприклад, обробку інших HTTP-запитів)
  let requestCount = 0;
  const serverInterval = setInterval(() => {
    console.log(`Сервер працює... оброблено інших запитів: ${++requestCount}`);
  }, 100);

  // 4. Слухаємо відповідь від Worker'а
  worker.on('message', (parsedObject) => {
    const endTime = performance.now();
    console.log(`✅ Воркер успішно повернув результат за ${Math.round(endTime - startTime)} мс.`);
    console.log(`Отримано елементів: ${parsedObject.length}`);
    clearInterval(serverInterval); // Зупиняємо інтервал для завершення скрипту
  });

  worker.on('error', (err) => {
    console.error("Помилка у воркері:", err);
  });

} else {
  // ==========================================
  // КОД ФОНОВОГО ПОТОКУ (Воркер)
  // ==========================================
  
  // 1. Отримуємо дані, передані з головного потоку
  const jsonString = workerData;

  // 2. Виконуємо важку синхронну роботу (Event Loop воркера блокується, але головний - ні)
  const parsedObject = JSON.parse(jsonString);

  // 3. Відправляємо результат назад
  parentPort.postMessage(parsedObject);
}
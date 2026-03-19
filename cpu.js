const cluster = require('cluster');
const http = require('http');
const os = require('os');

const numCPUs = 4; // os.cpus().length;

function countPrimes(limit) {
  let count = 0;

  for (let i = 2; i <= limit; i++) {
    let isPrime = true;

    for (let j = 2; j * j <= i; j++) {
      if (i % j === 0) {
        isPrime = false;
        break;
      }
    }

    if (isPrime) count++;
  }

  return count;
}

// console.log( numCPUs, countPrimes(100000)); // Output: 4 (primes: 2, 3, 5, 7)

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Number of CPU cores: ${numCPUs}`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  console.log(`Worker ${process.pid} started`);

  http.createServer((req, res) => {
    if (req.url === '/primes') {
      const limit = parseInt(req.headers['x-limit']) || 10000000;
      const primeCount = countPrimes(limit);

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`Number of primes up to ${limit}: ${primeCount}\nProcess ID: ${process.pid}\n`);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n');
    }
  }).listen(8800, () => {
    console.log(`Worker ${process.pid} is listening on port 8800`);
  });
}
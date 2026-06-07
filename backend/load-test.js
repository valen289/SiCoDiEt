const http = require('http');

const TOTAL_REQUESTS = 50;
const CONCURRENT = 10;
const HOST = 'localhost';
const PORT = 3002;

let completed = 0;
let failed = 0;
const times = [];

function makeRequest(index) {
  const start = Date.now();
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      completed++;
      times.push(Date.now() - start);
      
      if (completed % 10 === 0 || completed === TOTAL_REQUESTS) {
        console.log(`Progreso: ${completed}/${TOTAL_REQUESTS}`);
      }
      
      if (completed === TOTAL_REQUESTS) {
        printResults();
      }
    });
  });

  req.on('error', (e) => {
    failed++;
    completed++;
    console.error(`Request ${index} failed: ${e.message}`);
    
    if (completed === TOTAL_REQUESTS) {
      printResults();
    }
  });

  req.on('timeout', () => {
    req.destroy();
    failed++;
    completed++;
  });

  req.end();
}

function printResults() {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log('\n=== Resultados ===');
  console.log(`Total: ${TOTAL_REQUESTS}`);
  console.log(`Exitosas: ${TOTAL_REQUESTS - failed}`);
  console.log(`Fallidas: ${failed}`);
  console.log(`Tiempo promedio: ${avg.toFixed(2)}ms`);
  console.log(`Tiempo minimo: ${min}ms`);
  console.log(`Tiempo maximo: ${max}ms`);
  console.log('==================\n');
}

console.log(`Iniciando prueba de carga: ${TOTAL_REQUESTS} requests, ${CONCURRENT} concurrentes\n`);

for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT) {
  const batch = [];
  for (let j = 0; j < CONCURRENT && (i + j) < TOTAL_REQUESTS; j++) {
    batch.push(makeRequest(i + j));
  }
}

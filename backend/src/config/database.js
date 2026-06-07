const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000
});

pool.getConnection()
  .then(conn => {
    console.log('Base de datos conectada exitosamente');
    conn.release();
  })
  .catch(err => {
    console.error('Error conectando a la base de datos:', err.message);
  });

module.exports = pool;

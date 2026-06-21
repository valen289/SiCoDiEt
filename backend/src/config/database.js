const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || process.env.MYSQLHOST,
  port:     parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306'),
  user:     process.env.DB_USER     || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME     || process.env.MYSQLDATABASE,
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

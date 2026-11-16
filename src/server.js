require('dotenv').config();
const express = require('express');
const path = require('path');
const urlRoutes = require('./routes/urlRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', urlRoutes);

app.listen(PORT, () => {
    console.log(`=========================================================`);
    console.log(`🚀 Server URL Shortener đang chạy tại: http://localhost:${PORT}`);
    console.log(`=========================================================`);
});

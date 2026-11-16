const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');

// API chuẩn theo Chương 8
router.post('/api/v1/data/shorten', urlController.shortenUrl);

// API phục vụ Dashboard giám sát trực quan
router.get('/api/v1/stats', urlController.getSystemStats);
router.post('/api/v1/cache/clear', urlController.clearCache);

// Route điều hướng (Đặt dưới cùng)
router.get('/:shortUrl', urlController.redirectUrl);

module.exports = router;

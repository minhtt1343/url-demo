const db = require('../config/db');
const cache = require('../utils/cache');
const { encodeBase62 } = require('../utils/base62');

let systemLogs = [];
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 5;

function addLog(step, detail, status = 'INFO') {
    const time = new Date().toLocaleTimeString('vi-VN');
    systemLogs.unshift({ time, step, detail, status });
    if (systemLogs.length > 20) systemLogs.pop();
}

exports.shortenUrl = (req, res) => {
    const startTime = performance.now();
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

    const now = Date.now();
    const userRequests = rateLimitMap.get(clientIp) || [];
    const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS) {
        addLog('Rate Limiter (429)', `Chặn IP ${clientIp} do vượt quá ${MAX_REQUESTS} request/phút`, 'ERROR');
        return res.status(429).json({
            error: `Rate Limit Exceeded! Bạn chỉ được tạo tối đa ${MAX_REQUESTS} link mỗi phút để chống spam.`
        });
    }
    recentRequests.push(now);
    rateLimitMap.set(clientIp, recentRequests);

    let { longUrl } = req.body;
    if (!longUrl || !longUrl.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập đường dẫn cần rút gọn.' });
    }
    longUrl = longUrl.trim();
    if (!/^https?:\/\//i.test(longUrl)) {
        longUrl = 'https://' + longUrl;
    }

    try {
        new URL(longUrl);
    } catch (err) {
        return res.status(400).json({ error: 'Định dạng URL không hợp lệ. Vui lòng kiểm tra lại!' });
    }

    addLog('API Gateway', `POST /shorten từ IP ${clientIp} -> ${longUrl}`, 'INFO');

    const existing = db.findByLongUrl(longUrl);
    if (existing) {
        const latency = (performance.now() - startTime).toFixed(2);
        addLog('Database Hit', `URL đã tồn tại -> Tái sử dụng /${existing.shortURL} (${latency}ms)`, 'WARNING');
        return res.json({
            message: 'URL đã tồn tại trong hệ thống (Tái sử dụng mã cũ)',
            data: existing,
            fullShortUrl: `${req.protocol}://${req.get('host')}/${existing.shortURL}`,
            latency
        });
    }

    const newId = db.generateNextId();
    const shortCode = encodeBase62(newId);
    const savedRecord = db.saveUrl(newId, shortCode, longUrl);
    cache.set(shortCode, longUrl);

    const latency = (performance.now() - startTime).toFixed(2);
    addLog('Base 62 & Storage', `ID ${newId} ➔ /${shortCode} | Đã lưu DB & Cache (${latency}ms)`, 'SUCCESS');

    return res.status(201).json({
        message: 'Tạo đường dẫn rút gọn thành công!',
        data: savedRecord,
        fullShortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
        latency
    });
};

exports.redirectUrl = (req, res) => {
    const startTime = performance.now();
    const { shortUrl } = req.params;
    if (shortUrl === 'favicon.ico') return res.status(204).end();

    const redirectType = req.query.type === '301' ? 301 : 302;

    const cachedLongUrl = cache.get(shortUrl);
    if (cachedLongUrl) {
        db.incrementClick(shortUrl);
        const latency = (performance.now() - startTime).toFixed(2);
        addLog(`Cache HIT (${latency}ms)`, `/${shortUrl} ➔ Chuyển hướng HTTP ${redirectType} trực tiếp từ RAM`, 'SUCCESS');
        return res.redirect(redirectType, cachedLongUrl);
    }

    const record = db.findByShortUrl(shortUrl);
    if (!record) {
        addLog('404 Not Found', `Không tồn tại mã /${shortUrl} trong Database`, 'ERROR');
        return res.status(404).send('<h2 style="font-family:sans-serif;text-align:center;margin-top:50px;">404 - Đường dẫn rút gọn không tồn tại!</h2>');
    }

    cache.set(shortUrl, record.longURL);
    db.incrementClick(shortUrl);
    const latency = (performance.now() - startTime).toFixed(2);
    addLog(`Cache MISS -> DB (${latency}ms)`, `Lấy /${shortUrl} từ DB & đồng bộ lại lên Cache`, 'WARNING');

    return res.redirect(redirectType, record.longURL);
};

exports.getSystemStats = (req, res) => {
    const urls = db.getAllUrls();
    const totalClicks = urls.reduce((sum, item) => sum + item.clicks, 0);
    res.json({
        metrics: {
            totalUrls: urls.length,
            totalClicks: totalClicks,
            cacheSize: cache.getAll().length
        },
        database: urls,
        cache: cache.getAll(),
        logs: systemLogs
    });
};

exports.clearCache = (req, res) => {
    cache.clear();
    addLog('System Admin', 'Đã xóa sạch bộ nhớ đệm RAM (Cache Flushed)', 'WARNING');
    res.json({ message: 'Đã xóa sạch Cache!' });
};

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../database.json');

if (!fs.existsSync(DB_FILE)) {
    // Bắt đầu từ ID 1 nghìn tỷ để chuỗi Base 62 luôn có độ dài chuẩn 7 ký tự (62^7 ≈ 3.5 nghìn tỷ)
    const initialData = {
        currentId: 1000000000000,
        urls: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

function readDB() {
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    findByLongUrl(longURL) {
        return readDB().urls.find(item => item.longURL === longURL);
    },

    findByShortUrl(shortURL) {
        return readDB().urls.find(item => item.shortURL === shortURL);
    },

    generateNextId() {
        const db = readDB();
        db.currentId += 1;
        writeDB(db);
        return db.currentId;
    },

    saveUrl(id, shortURL, longURL) {
        const db = readDB();
        const newRecord = { 
            id, 
            shortURL, 
            longURL, 
            clicks: 0,
            createdAt: new Date().toLocaleTimeString('vi-VN')
        };
        db.urls.unshift(newRecord);
        writeDB(db);
        return newRecord;
    },

    incrementClick(shortURL) {
        const db = readDB();
        const record = db.urls.find(item => item.shortURL === shortURL);
        if (record) {
            record.clicks += 1;
            writeDB(db);
        }
    },

    getAllUrls() {
        return readDB().urls;
    }
};

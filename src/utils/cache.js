class MemoryCache {
    constructor() {
        this.store = new Map();
    }

    get(shortUrl) {
        return this.store.get(shortUrl) || null;
    }

    set(shortUrl, longUrl) {
        this.store.set(shortUrl, longUrl);
    }

    getAll() {
        return Array.from(this.store.entries()).map(([shortURL, longURL]) => ({
            shortURL,
            longURL
        }));
    }

    clear() {
        this.store.clear();
    }
}

module.exports = new MemoryCache();

/*
    OpenSeadragon: TileCache
    This module implements a lightweight LRU/FIFO cache
*/
(function( $ ){

/**
 * TileCache class provides a simple caching mechanism for tiles.
 * It uses a Map to store tiles, preserving insertion order for LRU/FIFO behavior.
 *  //TODO: consider switching to a linked-list LRU if TileCashe.use() performance issues occure.
 */
$.TileCache = class {
    __limit; // Maximum number of tiles the cache can hold.
    __map;   // Internal Map to store cache entries.
    __lastKey;

    /**
     * Constructor initializes the cache with a maximum size.
     * @param {Object} options - Configuration options for the cache.
     * @param {number} options.maxImageCacheCount - Maximum number of tiles to cache (default: 200).
     */
    constructor(options = {maxImageCacheCount: 200} ) {
        this.__limit = options.maxImageCacheCount;
        this.__map = new Map();                          // Preserves insertion order for LRU/FIFO.
        this.__lastKey = undefined;
    }

    /**
     * Expands the limit of the cache if needed
     * @param {number} limit - New to set limit (if larger than the existing one)
     */
    expand(limit){
        this.__limit = Math.max(this.__limit, limit);
    }

    /**
     * Checks if a tile exists in the cache.
     * @param {string} key - The unique key for the tile.
     * @returns {boolean} True if the tile exists, false otherwise.
     */
    has(key){
        return this.__map.has(key);
    }

    /**
     * Retrieves a tile from the cache without affecting its position in the LRU queue.
     * @param {string} key - The unique key for the tile.
     * @returns {*} The cached tile, or undefined if not found.
     */
    get(key) {
        return this.__map.get(key);
    }

    /**
     * Retrieves a tile and moves it to the end of the LRU queue, making it the most recently used.
     * @param {string} key - The unique key for the tile.
     * @returns {*} The cached tile, or undefined if not found.
     */
    use(key) {
        let current = key;
        const map = this.__map;

        while (current) {
            const value = map.get(current);
            if (!value) break;                                                      // eslint-disable-line curly

            if (this.__lastKey !== current) {
                map.delete(current);
                map.set(current, value);
                this.__lastKey = current;
            }

            const next = value.tile?.lrCacheKey;   // move lower-resolution tile entries too !!!
            if (next === current) break;                                            // eslint-disable-line curly
            current = next;
        }

        return map.get(key);
    }

    /**
     * Adds or updates a tile in the cache. Removes the oldest entry if the cache exceeds its limit.
     * @param {string} key - The unique key for the tile.
     * @param {*} value - The tile to cache. Must not be undefined.
     */
    set(key, value) {
        const map = this.__map;
        map.delete(key);                                // Remove old position if it exists.
        if (value !== undefined){                       // MUST NEVER insert undefined!!!
            map.set(key, value);
        }
        if ( map.size > this.__limit) {
            const oldestKey = map.keys().next().value;  // Get the oldest key.
            map.delete(oldestKey);                      // Remove the oldest entry.
        }
    }

    /**
     * Generates a unique cache key for a tile based on its tiledImage, zoom level, and position.
     * @param {Object} tiledImage - The tiled image the tile belongs to.
     * @param {number} level - The zoom level of the tile.
     * @param {number} x - The x-coordinate of the tile.
     * @param {number} y - The y-coordinate of the tile.
     * @returns {string} The unique cache key for the tile.
     */
    static getTileCacheKey(tiledImage, level, x, y){
        return `${tiledImage.source.hash}/${level}/${x}/${y}`;
    }

    /**
     * Removes all tiles associated with a specific tiledImage from the cache.
     * @param {Object} tiledImage - The tiled image whose tiles should be cleared.
     */
    clearTilesFor(tiledImage) {
        const tileSourceId = tiledImage.source.hash;
        const map = this.__map;

        for (const key of map.keys()) {
            if (key.startsWith(tileSourceId + "/")) {
                map.delete(key);
            }
        }
    }

    /**
     * Returns the number of tiles currently in the cache.
     * @returns {number} The number of cached tiles.
     */
    numTilesLoaded(){
        return this.__map.size;
    }
};

}(OpenSeadragon));

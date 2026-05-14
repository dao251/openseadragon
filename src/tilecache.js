/*
    OpenSeadragon: TileCache
*/
(function( $ ){
$.TileCache = class {                               // simpliest LRU/FIFO cache
    #limit;
    #map;
    constructor(options = {maxImageCacheCount: 200} ) {
        this.#limit = options.maxImageCacheCount;
        this.#map = new Map();                      // preserves insertion order
    }
    has(key){
        return this.#map.has(key);
    }
    get(key) {
        return this.#map.get(key);
    }
    gett(key) {                                     // get the value and moves it to the end of LRU/FIFO queue
        const map = this.#map;
        const value = map.get(key);
        map.delete(key);
        if (value !== undefined) {
            map.set(key, value);
        }
        return value;
    }
    set(key, value) {
        const map = this.#map;
        map.delete(key);                            // remove old position
        if (value !== undefined){                   // MUST NEVER insert undefined !!!
            map.set(key, value);
        }
        if ( map.size > this.#limit) {
            const oldestKey = map.keys().next().value;
            map.delete(oldestKey);
        }
    }
    static getTileCacheKey(tiledImage, level, x, y){
        return `${tiledImage.source.hash}/${level}/${x}/${y}`;
    }
    // "compatibility" methods
    // cacheTile( options ){
    //     this.set( options.tile.cacheKey, options.data.getContext('2d') );
    // }
    clearTilesFor( tiledImage ){
        const tileSourceId = tiledImage.source.hash;
        for (const [key] of this.#map) {
            if ( key.split("/")[0] === tileSourceId){
                this.#map.delete(key);
            }
        }
    }
    numTilesLoaded(){
        return this.#map.size;
    }
};
}(OpenSeadragon));

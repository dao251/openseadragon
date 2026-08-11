/*
 * OpenSeadragon - Utils
 */
(function( $ ){

class Deprecation {
    static warned = new Set();
    static silent = false;

    // ---- helpers ----
    static _shouldWarn(feature) {
        if (this.silent) return false;                  // eslint-disable-line curly
        if (this.warned.has(feature)) return false;     // eslint-disable-line curly
        this.warned.add(feature);
        return true;
    }

    static _compareVersions(a, b) {
        // simple semver-ish compare: "2.1" < "2.10"
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        const len = Math.max(pa.length, pb.length);

        for (let i = 0; i < len; i++) {
            const x = pa[i] || 0;
            const y = pb[i] || 0;
            if (x < y) return -1;   // eslint-disable-line curly
            if (x > y) return 1;    // eslint-disable-line curly
        }
        return 0;
    }

    // ---- soft ----
    static soft(feature, message) {
        if (this._shouldWarn(feature)) {
            console.warn(`[DEPRECATION][soft] ${feature}: ${message}`);
        }
    }

    // ---- hard ----
    static hard(feature, message) {
        throw new Error(`[DEPRECATION][hard] ${feature}: ${message}`);
    }

    // ---- scheduled (version-based) ----
    static schedule(feature, { since, removeIn, current, message }) {
        // If current >= removeIn → hard error
        if (this._compareVersions(current, removeIn) >= 0) {
            this.hard(
                feature,
                `${message} (removed in ${removeIn}, was deprecated since ${since})`
            );
        }

        // Otherwise → soft warning (once)
        if (this._shouldWarn(feature)) {
            console.warn(
                `[DEPRECATION][scheduled] ${feature}: ${message} ` +
                `(deprecated since ${since}, will be removed in ${removeIn}, current ${current})`
            );
        }
    }
}

$.Utils = class {

    // deprecation: decorator API

    // static deprecate = {
    //     soft(feature, message) {
    //         return function (value, context) {
    //             if (context.kind !== "method") {
    //                 throw new Error(`@decorators.soft can only be applied to methods: ${feature}`);
    //             }

    //             return function (...args) {
    //                 Deprecation.soft(feature, message);
    //                 return value.call(this, ...args);
    //             };
    //         };
    //     },

    //     hard(feature, message) {
    //         return function (value, context) {
    //             if (context.kind !== "method") {
    //                 throw new Error(`@decorators.hard can only be applied to methods: ${feature}`);
    //             }

    //             return function (...args) {
    //                 Deprecation.hard(feature, message);
    //             };
    //         };
    //     },

    //     schedule(feature, meta) {
    //         return function (value, context) {
    //             if (context.kind !== "method") {
    //                 throw new Error(`@decorators.schedule can only be applied to methods: ${feature}`);
    //             }

    //             return function (...args) {
    //                 Deprecation.schedule(feature, meta);
    //                 return value.call(this, ...args);
    //             };
    //         };
    //     }
    // };


    // deprecation: wrapper API (to replace with decorators when widely available)
    static deprecate = {
        soft(feature, message, fn) {
            return function (...args) {
                Deprecation.soft(feature, message);
                return fn.apply(this, args);        // eslint-disable-line no-invalid-this
            };
        },

        hard(feature, message, fn) {
            return function (...args) {
                Deprecation.hard(feature, message);
            };
        },

        schedule(feature, meta, fn) {
            return function (...args) {
                Deprecation.schedule(feature, meta);
                return fn.apply(this, args);        // eslint-disable-line no-invalid-this
            };
        }
    };

    /**
     * Create a standard HTMLCanvasElement at the requested width and height.
     *
     * @param {number} [w=300] - The width of the canvas in CSS pixels.
     * @param {number} [h=150] - The height of the canvas in CSS pixels.
     * @returns {HTMLCanvasElement} A newly-created canvas element.
     */
    static newCanvas (w = 300, h = 150) {
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        return canvas;
    }

    /**
     * Create a cross-platform offscreen canvas instance.
     * Uses OffscreenCanvas when available and falls back to a normal canvas element.
     *
     * @type {function(number=, number=): HTMLCanvasElement|OffscreenCanvas}
     */
    static newOffscreenCanvas =
        ( typeof OffscreenCanvas === "function" ?                               // eslint-disable-line compat/compat
            (w = 300, h = 150) => new OffscreenCanvas(w, h) :                   // eslint-disable-line compat/compat
            (w = 300, h = 150) => $.Utils.newCanvas(w, h)
        );

    /**
     * Generates a strictly monotonic, collision-proof unique ID.
     * Uses a timestamp and a per-millisecond counter to ensure uniqueness.
     * @returns {string} A unique ID string.
     */
    static uniqueId = (function () {
        let last = 0;
        let count = 0;

        return () => {
            const now = Date.now();
            if (now !== last) {
                last = now;
                count = 0;
            } else {
                count++;
            }
            return (
                now.toString(36).padStart(8, "0") +
                count.toString(36).padStart(4, "0")
            );
        };
    })();

    /**
     * Decodes an image safely, avoiding resolution races and browser-specific bugs.
     * @param {HTMLImageElement|*} image - The image to decode.
     *      In the case the parameter is not an HTMLImageElement, the method simply returns it wrapped in a Promise
     * @returns {Promise<HTMLImageElement|*>} A promise that resolves with the decoded image.
     */
    static safeImageDecode (image) {
        // don't throw (just return) if something else is passed (e.g. canvas element or ImageBitmap)
        if(!(image instanceof Image)){
            return Promise.resolve(image);
        }

        // Fast path: already loaded & valid
        if (image.complete && image.naturalWidth > 0) {
            // decode() may still be needed in Safari, but resolves immediately
            return image.decode().then(() => image);
        }

        return new Promise((resolve, reject) => {
            let settled = false;

            const fail = (err) => {
                if (!settled) {
                    settled = true;
                    reject(err);
                }
            };

            image.onerror = () => fail(new Error("Image load error"));
            image.onabort = () => fail(new Error("Image load aborted"));

            // decode() may resolve synchronously — this is why handlers must be attached first
            image.decode()
                .then(() => {
                    if (!settled) {
                        settled = true;
                        resolve(image);
                    }
                })
                .catch(fail);
        });
    }

    /**
     * Creates an ImageBitmap from a Blob, with Safari-specific bug detection and fallback.
     * @param {Blob} blob - The Blob object to create an ImageBitmap from.
     * @returns {Promise<ImageBitmap>} A promise that resolves to the created ImageBitmap.
     */
    static safeCreateImageBitmap(blob) {

        // Detects Safari's "bitmap exists but cannot be drawn" bug
        const isBitmapDrawable = (bmp) => {
            return new Promise(resolve => {
                try {
                    const canvas = $.Utils.newOffscreenCanvas(bmp.width, bmp.height);
                    const ctx = canvas.getContext("2d", {willReadFrequently: true});
                    ctx.drawImage(bmp, 0, 0);

                    const w = bmp.width;
                    const h = bmp.height;

                    // sample 4 corners for robustness
                    const samples = [
                        ctx.getImageData(0, 0, 1, 1).data,
                        ctx.getImageData(w - 1, 0, 1, 1).data,
                        ctx.getImageData(0, h - 1, 1, 1).data,
                        ctx.getImageData(w - 1, h - 1, 1, 1).data
                    ];

                    const ok = samples.some(d => d[3] !== 0);
                    resolve(ok);
                } catch (e) {
                    resolve(false);
                }
            });
        };


        // Safari-safe fallback: Blob -> <img> -> safe decode -> canvas -> ImageBitmap
        const createImageBitmapFallback = (blob) => {
            const url = URL.createObjectURL(blob);

            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = url;

                $.Utils.safeImageDecode(img)
                    .then((img) => {
                        const canvas = $.Utils.newCanvas(img.naturalWidth, img.naturalHeight);
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0);
                        return window.createImageBitmap(canvas);
                    })
                    .then(resolve, reject)
                    .finally(() => URL.revokeObjectURL(url));
            });
        };


        // Fast path + Safari auto-detection
        return window.createImageBitmap(blob)
            .then(bmp => {
                // Detect Safari silent failures (0×0 bitmap)
                if (bmp.width === 0 || bmp.height === 0) {
                    throw new Error("ImageBitmap is empty (Safari bug)");
                }

                // Detect Safari corrupted / non-drawable bitmaps
                return isBitmapDrawable(bmp).then(ok => {
                    if (!ok) {
                        throw new Error("ImageBitmap is not drawable (Safari bug)");
                    }
                    return bmp;
                });
            })
            // Fallback for Safari 14–16 and any failure
            .catch(() => createImageBitmapFallback(blob));
    }

    /**
     * Copies an image source to a new canvas element.
     * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|OffscreenCanvas|VideoFrame|SVGImageElement} source - The image source to copy.
     * @returns {HTMLCanvasElement} The resulting canvas element.
     */
    static toCanvas(source) {
        const canvas = $.Utils.newCanvas(source.width, source.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(source, 0, 0);
        return canvas;
    }

    /**
     * Copies an image source to a new OffscreenCanvas.
     * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|ImageBitmap|OffscreenCanvas|VideoFrame|SVGImageElement} source - The image source to copy.
     * @returns {HTMLCanvasElement} The resulting OffscreenCanvas.
     */
    static toOffscreenCanvas(source) {
        const canvas = $.Utils.newOffscreenCanvas(source.width, source.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(source, 0, 0);
        return canvas;
    }

    /**
     * Checks if the given object is a valid canvas image source.
     * @param {*} x - The object to check.
     * @returns {boolean} True if the object is a valid canvas image source, false otherwise.
     */
    static isCanvasImageSource(x) {
        return (
            x instanceof HTMLImageElement ||
            x instanceof HTMLCanvasElement ||
            x instanceof HTMLVideoElement ||
            x instanceof ImageBitmap ||
            (typeof OffscreenCanvas === "function" && x instanceof OffscreenCanvas) ||   // eslint-disable-line compat/compat
            (typeof VideoFrame === "function" && x instanceof VideoFrame) ||             // eslint-disable-line compat/compat, no-undef
            x instanceof SVGImageElement
        );
    }

    /**
     * Aligns an element to the device pixel grid to reduce blur.
     * The method snaps the element's position to whole device pixels
     * by adjusting its transform without affecting layout.
     *
     * @param {HTMLElement} el - The element to align.
     */
    static snapElementToDevicePixels(el) {
        const dpr = window.devicePixelRatio;
        const rect = el.getBoundingClientRect();
        let snappedLeft = Math.round(rect.left * dpr) / dpr;
        let snappedTop = Math.round(rect.top * dpr) / dpr;
        const q = 1 / dpr;
        snappedLeft = Math.round(snappedLeft / q) * q;
        snappedTop = Math.round(snappedTop / q) * q;
        const dx = snappedLeft - rect.left;
        const dy = snappedTop - rect.top;
        const EPS = 1e-5;
        if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
            return;
        }
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    /**
     * Clears a canvas context efficiently by resizing the canvas when needed
     * or resetting the transform and clearing the existing buffer otherwise.
     *
     * @param {CanvasRenderingContext2D} ctx - The drawing context to clear.
     * @param {number} w - The target width in pixels.
     * @param {number} h - The target height in pixels.
     */
    static clearContext(ctx, w, h){
        if ( ctx.canvas.width !== w || ctx.canvas.height !== h){
            ctx.canvas.width = w;
            ctx.canvas.height = h;
        }else{
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
        }
    }

};
}(OpenSeadragon));

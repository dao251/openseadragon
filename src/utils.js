/*
 * OpenSeadragon - Utils
 */
(function( $ ){
$.Utils = class {

    static newCanvas (w, h) {
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        return canvas;
    }

    static newOffscreenCanvas =
        ( typeof OffscreenCanvas === "function" ?                   // eslint-disable-line compat/compat
            (w, h) => new OffscreenCanvas(w, h) :                   // eslint-disable-line compat/compat
            (w, h) => $.Utils.newCanvas(w, h)
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

        if(!(image instanceof Image)){              // don't throw if something else is passed (e.g. canvas element or ImageBitmap)
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
};
}(OpenSeadragon));

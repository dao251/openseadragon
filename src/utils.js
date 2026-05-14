/*
 * OpenSeadragon - Utils
 */
(function( $ ){
OpenSeadragon.Utils = class {

    // Generates a strictly monotonic, collision‑proof unique ID.
    // Uses timestamp(ms) + per‑ms counter stored inside a closure.
    // No randomness, no external state, no collisions within this JS process.
    static uniqueId = (() => {
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

    // ------------------------------------------------------------
    // safeImageDecode(): race‑free wrapper around image.decode().
    // Attaches error/abort handlers before decode() to avoid synchronous
    // resolution races and Safari’s decode‑before‑error bug. Resolves with
    // the image only when it is fully decoded and valid.
    // ------------------------------------------------------------
    static safeImageDecode = (image) => {

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
    };

    // ------------------------------------------------------------
    //  safeCreateImageBitmap(blob)
    // ------------------------------------------------------------
    static safeCreateImageBitmap(blob) {

        // Detects Safari's "bitmap exists but cannot be drawn" bug
        const isBitmapDrawable = (bmp) => {
            return new Promise(resolve => {
                try {
                    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
                    const ctx = canvas.getContext("2d");
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
                        const canvas = document.createElement("canvas");
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;

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

    static toCanvas(source) {
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(source, 0, 0);

        return canvas;
    }

};
}( OpenSeadragon ));

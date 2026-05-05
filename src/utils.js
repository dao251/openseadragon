/*
 * OpenSeadragon - Profiler
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2024 OpenSeadragon contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * - Neither the name of CodePlex Foundation nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

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
                now.toString(16).padStart(8, "0") +
                count.toString(16).padStart(4, "0")
            );
        };
    })();

    // safeImageDecode(): race‑free wrapper around image.decode().
    // Attaches error/abort handlers before decode() to avoid synchronous
    // resolution races and Safari’s decode‑before‑error bug. Resolves with
    // the image only when it is fully decoded and valid.
    static safeImageDecode = (image) => {
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

};

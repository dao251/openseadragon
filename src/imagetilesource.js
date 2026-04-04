/*
 * OpenSeadragon - ImageTileSource
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

OpenSeadragon.ImageTileSource = class extends OpenSeadragon.TileSource {

    constructor({url, buildPyramid = true, tileSize = 256}){
        super(url);
        this.__buildPyramid = buildPyramid;
        this.__tileSize = tileSize;
    }

    supports( data ){
        return data.type === "image";
    }

    configure( options ){
        return options;
    }

    getTileImage(level, x, y){
        const image = this.__levels[level];
        // no pyramid built
        if( image instanceof Image ){
            return image.cloneNode();       //need clone because OSD will delete the image
        }

        const tileSize = this.__tileSize;

        const tileCanvas = new OffscreenCanvas(tileSize, tileSize);
        const tileCtx = tileCanvas.getContext("2d");

        tileCtx.fillStyle = "transparent";
        tileCtx.fillRect(0, 0, tileSize, tileSize);

        tileCtx.drawImage(
            image,
            x * tileSize, y * tileSize, tileSize, tileSize,
            0, 0, tileSize, tileSize
        );

        return tileCanvas
            .convertToBlob({ type: "image/png" })
            .then(function (blob) {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.src = url;
                return img;
            });
    }

    getImageInfo( url ){

        Promise.resolve(this._fetchImage(url))
        .then(image=>{
            image.onload = () => {
                this.__image = image;

                this.width = image.naturalWidth;
                this.height = image.naturalHeight;
                this.aspectRatio = this.width / this.height;
                this.dimensions = new OpenSeadragon.Point(this.width, this.height);

                this.__buildImagePyramid();

                this.minLevel = 0;
                this.maxLevel = this.__levels.length - 1;

                this.ready = true;

                // Note: this event is documented elsewhere, in TileSource
                this.raiseEvent('ready', {tileSource: this});
            };
            image.onerror = () => {
                // Note: this event is documented elsewhere, in TileSource
                this.raiseEvent('open-failed', {
                    message: "Error loading image at " + url,
                    source: url
                });
            };
        })
        // we need both image.onerror above and the .catch() to support non-CORS images
        //  non-CORS handled by onerror, and "normal" fetch by the .catch block below
        .catch( (e) => {
            // Note: this event is documented elsewhere, in TileSource
            this.raiseEvent('open-failed', {
                message: `Error (${e.message}) fetching image at ${url}`,
                source: url
            });
        });
    }

    __buildImagePyramid() {

        // Can't buid the pyramid if the image is non-CORS
        if( !this.__buildPyramid || this.__image._nonCors){
            this.__levels = [this.__image];
            this._tileWidth = this.width;
            this._tileHeight = this.height;
            this.tileOverlap = 0;
            return;
        }

        // Building the pyramid
        //   actually not tiled pyramid, but simple image pyramid
        //   tiling is done by getTileImage()
        const tileSize = this.__tileSize;
        this._tileWidth  = tileSize;
        this._tileHeight = tileSize;
        this.tileOverlap = 0;

        let w = this.__image.width;
        let h = this.__image.height;

        this.__levels = [];

        // Last (max) level = original image
        let canvas = new OffscreenCanvas(w, h);
        let ctx = canvas.getContext("2d");
        ctx.drawImage(this.__image, 0, 0);
        this.__levels.unshift(canvas);

        // Build downsampled levels until fits single tile
        while (w > tileSize || h > tileSize) {
            const nextW = Math.floor(w / 2);
            const nextH = Math.floor(h / 2);

            const nextCanvas = new OffscreenCanvas(nextW, nextH);
            const nextCtx = nextCanvas.getContext("2d");

            nextCtx.imageSmoothingEnabled = true;
            nextCtx.imageSmoothingQuality = "high";

            nextCtx.drawImage(
                canvas,
                0, 0, w, h,
                0, 0, nextW, nextH
            );

            this.__levels.unshift(nextCanvas);

            canvas = nextCanvas;
            w = nextW;
            h = nextH;
        }
        // we don't need the original image anymore
        this.__image = undefined;
    }
};

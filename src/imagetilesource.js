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

(function( $ ){
$.ImageTileSource = class extends $.TileSource {

    constructor({url, buildPyramid = true, tileSize = 256, tileWidth, tileHeight }){
        super(url);
        this.__buildPyramid = buildPyramid;
        this.__tileSize = tileSize;
        this.__tileWidth = (tileWidth ? tileWidth : tileSize);
        this.__tileHeight = (tileHeight ? tileHeight : tileSize);
        this.ready = false;
    }

    supports( data ){
        return data.type === "image";
    }

    configure( options ){
        return options;
    }

    getTileImage(level, x, y){
        const image = this.__levels[level];
        // const tileSize = this.__tileSize;
        const tileWidth = this.__tileWidth;
        const tileHeight = this.__tileHeight;

        if(!this.__buildPyramid){
            return image;
        }

        const tileCanvas = $.Utils.newOffscreenCanvas(tileWidth, tileHeight);
        const tileCtx = tileCanvas.getContext("2d");

        tileCtx.drawImage(
            image,
            x * tileWidth, y * tileHeight, tileWidth, tileHeight,
            0, 0, tileWidth, tileHeight
        );

        return tileCanvas;

    }

    getImageInfo( url ){
        return Promise.resolve(this._fetchImage(url))
        .then(image=>{
            this.__image = image;

            this.width = image.naturalWidth;
            this.height = image.naturalHeight;
            this.aspectRatio = this.width / this.height;
            this.dimensions = new $.Point(this.width, this.height);

            this.__buildImagePyramid();

            this.minLevel = 0;
            this.maxLevel = this.__levels.length - 1;

            this.ready = true;

            // Note: this event is documented elsewhere, in TileSource
            this.raiseEvent('ready', {tileSource: this});
        })
        .catch( (e) => {
            // Note: this event is documented elsewhere, in TileSource
            this.raiseEvent('open-failed', {
                message: `Error (${e.message}) fetching image at ${url}`,
                source: url
            });
        });
    }

    __buildImagePyramid() {

        if( !this.__buildPyramid ){
            this.__levels = [$.Utils.toOffscreenCanvas(this.__image)];
            this._tileWidth = this.width;
            this._tileHeight = this.height;
            this.tileOverlap = 0;
            return;
        }

        // Building the pyramid
        //   actually not tiled pyramid, but simple image pyramid
        //   tiling is done by getTileImage()
        // const tileSize = this.__tileSize;
        this._tileWidth  = this.__tileWidth;
        this._tileHeight = this.__tileHeight;
        this.tileOverlap = 0;

        let w = this.__image.width;
        let h = this.__image.height;

        this.__levels = [];

        let src = this.__image;

        while (true) {                      //eslint-disable-line no-constant-condition
            const canvas = $.Utils.newOffscreenCanvas(w, h);
            const ctx = canvas.getContext("2d");

            ctx.drawImage(
                src,
                0, 0, src.width, src.height,
                0, 0, w, h
            );

            this.__levels.unshift(canvas);

            if (w <= this.__tileWidth && h <= this.__tileHeight){
                break;
            }

            src = canvas;
            w = Math.ceil(w / 2);
            h = Math.ceil(h / 2);
        }

        // we don't need the original image anymore
        this.__image = undefined;
    }
};
}(OpenSeadragon));

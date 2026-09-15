/*
 * OpenSeadragon - CanvasDrawer
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

    const OpenSeadragon = $; // (re)alias back to OpenSeadragon for JSDoc

    class CanvasTileBuffer {
        __size; // #private member

        get size(){
            return this.__size;
        }

        constructor( size ){
            this.__size = size;
            this.context = $.Utils.newOffscreenCanvas(size, size).getContext('2d');
        }

        destroy(){
            this.__size = 0;
            delete this.context;
        }

        get valid(){
            return true;
        }

        clear(){
            const ctx = this.context;

            // DON'T smooth, all coordinates are Integers, no scale, no rotation !!!!
            // must be here as composite clear may reset to default
            ctx.imageSmoothingEnabled = false;
        }

        clearRect(rect){
            this.context.clearRect( rect.x, rect.y, rect.width, rect.height );
        }

        drawTileImage( image, srcRect, destRect, debugInfo ){
            // const {sx, sy, sw, sh} = srcRect;
            const ctx = this.context;
            ctx.drawImage( image,
                srcRect.x, srcRect.y, srcRect.width, srcRect.height,
                destRect.x, destRect.y, destRect.width, destRect.height
            );
            if (debugInfo) {
                $.Utils.drawDebugInfoOnCanvas(ctx, destRect, debugInfo);
            }
        }

    }

/**
 * @class OpenSeadragon.CanvasDrawer
 * @extends OpenSeadragon.DrawerBase
 * @classdesc Default implementation of CanvasDrawer for an {@link OpenSeadragon.Viewer}.
 * @param {Object} options - Options for this Drawer.
 * @param {OpenSeadragon.Viewer} options.viewer - The Viewer that owns this Drawer.
 * @param {OpenSeadragon.Viewport} options.viewport - Reference to Viewer viewport.
 * @param {Element} options.element - Parent element.
 * @param {Number} [options.debugGridColor] - See debugGridColor in {@link OpenSeadragon.Options} for details.
 */

class CanvasDrawer extends OpenSeadragon.Drawer{

    constructor(options){
        super(options);
        this.context = this.canvas.getContext( '2d' );
    }

    static isSupported(){
        return true;        // all modern browsers support canvas
    }

    clear( width, height ){
        this.canvas.width = width;
        this.canvas.height = height;
    }

    newTileBuffer(size){
        return new CanvasTileBuffer(size);
    }

    drawTileBuffer( buffer, affine, srcRect ){
        const [sx, sy, sw, sh] = [srcRect.x, srcRect.y, srcRect.width, srcRect.height];     // source rect in buffer coordinates
        const {a, b, c, d, e, f} = affine;                                                  // buffer → canvas

        const ctx = this.context;

        ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
        ctx.globalCompositeOperation = this.__currentCompositeOperation;
        ctx.globalAlpha = this.__currentOpacity;

        ctx.setTransform(a, b, c, d, e, f);
        ctx.drawImage(
            buffer.context.canvas,
            sx, sy, sw, sh,
            sx, sy, sw, sh,
        );
    }

    /**
     *
     * @returns 'canvas'
     */
    getType(){
        return 'canvas';
    }
}

$.CanvasDrawer = CanvasDrawer;

}( OpenSeadragon ));

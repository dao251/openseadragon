
/*
 * OpenSeadragon - WebGLDrawer
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

    const OpenSeadragon = $; // alias for JSDoc

   /**
    * @class OpenSeadragon.WebGLDrawer
    * @classdesc Default implementation of WebGLDrawer for an {@link OpenSeadragon.Viewer}. The WebGLDrawer
    * loads tile data as textures to the graphics card as soon as it is available (via the tile-ready event),
    * and unloads the data (via the image-unloaded event). The drawer utilizes a context-dependent two pass drawing pipeline.
    * For the first pass, tile composition for a given TiledImage is always done using a canvas with a WebGL context.
    * This allows tiles to be stitched together without seams or artifacts, without requiring a tile source with overlap. If overlap is present,
    * overlapping pixels are discarded. The second pass copies all pixel data from the WebGL context onto an output canvas
    * with a Context2d context. This allows applications to have access to pixel data and other functionality provided by
    * Context2d, regardless of whether the CanvasDrawer or the WebGLDrawer is used. Certain options, including compositeOperation,
    * clip, croppingPolygons, and debugMode are implemented using Context2d operations; in these scenarios, each TiledImage is
    * drawn onto the output canvas immediately after the tile composition step (pass 1). Otherwise, for efficiency, all TiledImages
    * are copied over to the output canvas at once, after all tiles have been composited for all images.
    * @param {Object} options - Options for this Drawer.
    * @param {OpenSeadragon.Viewer} options.viewer - The Viewer that owns this Drawer.
    * @param {OpenSeadragon.Viewport} options.viewport - Reference to Viewer viewport.
    * @param {Element} options.element - Parent element.
    * @param {Number} [options.debugGridColor] - See debugGridColor in {@link OpenSeadragon.Options} for details.
    */

$.WebGLDrawer = class extends OpenSeadragon.Drawer{
    constructor(options){
        super(options);
        $.console.warn(" 'webgl' drawer not implemented, using default drawer (Canvas API)" );
        this.context = this.canvas.getContext( '2d' );
    }

    /**
     *
     * @returns 'webgl'
     */
    getType(){
        return 'webgl';
    }
};

}( OpenSeadragon ));

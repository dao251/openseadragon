/*
 * OpenSeadragon - Drawer
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

//DAO251: helper functions //TODO: move to the TileImage class

function getCurrentZoomLevel( tiledImage ) {
    const zoom = tiledImage.viewport.getZoom(true);
    const imageZoom = tiledImage.viewportToImageZoom(zoom);

    //DAO251: Need to take into account minPixelRatio (who chose this f... name, what is its physical meaning?????)
    const pixelRatio = 1 / imageZoom * Math.max(tiledImage.minPixelRatio, 1 / $.pixelDensityRatio);   // Math.max : no sense to fall below device resolution

    const maxLevel =  tiledImage.source.maxLevel;
    const idealLevel = maxLevel - Math.log2(pixelRatio);
    const downsample = 2 ** (maxLevel - idealLevel);

    // √2 hysteresis band around the ideal level
    return ( pixelRatio < downsample / Math.SQRT2 ?
                Math.floor(idealLevel) :
            ( pixelRatio > downsample * Math.SQRT2 ?
                Math.floor(idealLevel) :
                Math.round(idealLevel)
        ));
}





    const OpenSeadragon = $; // (re)alias back to OpenSeadragon for JSDoc
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

class Drawer extends OpenSeadragon.DrawerBase{

    constructor(options){
        super(options);

        this.context = this.canvas.getContext( '2d' );

        // Since the tile-drawn and tile-drawing events are fired by this drawer, make sure handlers can be added for them
        this.viewer.allowEventHandler("tile-drawn");
        this.viewer.allowEventHandler("tile-drawing");

    }

    /**
     * @returns {Boolean} true if canvas is supported by the browser, otherwise false
     */
    static isSupported(){
        return true;        // DAO251: all modern browsers support canvas
    }

    getType(){
        return 'drawer';
    }

    /**
     * create the HTML element (e.g. canvas, div) that the image will be drawn into
     * @returns {Element} the canvas to draw into
     */
    _createDrawingElement(){
        let canvas = $.makeNeutralElement("canvas");
        let viewportSize = this._calculateCanvasSize();
        canvas.width = viewportSize.x;
        canvas.height = viewportSize.y;
        return canvas;
    }

    /**
     * Draws the TiledImages
     */
    draw(tiledImages) {
        this._prepareNewFrame(); // prepare to draw a new frame
        for(const tiledImage of tiledImages){
            if (tiledImage.opacity !== 0) {
                this.drawTiledImage(tiledImage);
            }
        }
    }

    /**
     * @returns {Boolean} True - rotation is supported.
     */
    canRotate() {
        return true;
    }

    /**
     * Destroy the drawer (unload current loaded tiles)
     */
    destroy() {
        this.canvas.remove(); //???
    }


    /**
     * Turns image smoothing on or off for this viewer. Note: Ignored in some (especially older) browsers that do not support this property.
     *
     * @function
     * @param {Boolean} [imageSmoothingEnabled] - Whether or not the image is
     * drawn smoothly on the canvas; see imageSmoothingEnabled in
     * {@link OpenSeadragon.Options} for more explanation.
     */
    setImageSmoothingEnabled(imageSmoothingEnabled){
        this._imageSmoothingEnabled = !!imageSmoothingEnabled;
        // this._updateImageSmoothingEnabled(this.context);
        this.viewer.forceRedraw();
    }

    /**
     * Fires the tile-drawing event.
     * @private
     */
    _raiseTileDrawingEvent(tiledImage, context, tile, rendered){
        /**
         * This event is fired just before the tile is drawn giving the application a chance to alter the image.
         *
         * NOTE: This event is only fired when the 'canvas' drawer is being used
         *
         * @event tile-drawing
         * @memberof OpenSeadragon.Viewer
         * @type {object}
         * @property {OpenSeadragon.Viewer} eventSource - A reference to the Viewer which raised the event.
         * @property {OpenSeadragon.Tile} tile - The Tile being drawn.
         * @property {OpenSeadragon.TiledImage} tiledImage - Which TiledImage is being drawn.
         * @property {CanvasRenderingContext2D} context - The HTML canvas context being drawn into.
         * @property {CanvasRenderingContext2D} rendered - The HTML canvas context containing the tile imagery.
         * @property {?Object} userData - Arbitrary subscriber-defined object.
         */
        this.viewer.raiseEvent('tile-drawing', {
            tiledImage: tiledImage,
            context: context,
            tile: tile,
            rendered: rendered
        });
    }

    /**
     * Clears the Drawer so it's ready to draw another frame.
     * @private
     *
     */
    _prepareNewFrame() {
        var viewportSize = this._calculateCanvasSize();

        // clears the canvas
        this.canvas.width = viewportSize.x;
        this.canvas.height = viewportSize.y;

        const flipViewport = this.viewer.viewport.getFlip();
        if(!!flipViewport !== !!(this.context.getTransform().a < 0)){
            this.context.scale(-1, 1);
            this.context.translate(-this.context.canvas.width, 0);
        }

    }


// DAO251: ----------------------------------------------

    static _applyDebugStyles( sewCtx ){
        sewCtx.strokeStyle = "rgba(255, 63, 255)";
        sewCtx.fillStyle = "rgba(255, 63, 255)";
        sewCtx.font = "20px monospace";
        sewCtx.lineWidth = 1;
    }

    drawTiledImage( tiledImage ){

        let drawArea = tiledImage.getDrawArea();
        if (!drawArea){
            return;
        }

        const imageDims = tiledImage.getContentSize();
        // const imageRect = new $.Rect(0, 0, imageDims.x, imageDims.y);

        const maxLevel =  tiledImage.source.maxLevel;
        const minLevel =  tiledImage.source.minLevel;
        const tileWidth = tiledImage.source.getTileWidth(maxLevel);         //DAO251: replace with just .tileWidth      // we only support 2x2 tile pyramids !!!!
        const tileHeight = tiledImage.source.getTileHeight(maxLevel);       //DAO251: replace with just .tileHeight     // we only support 2x2 tile pyramids !!!!
        const tileDims = new $.Point(tileWidth, tileHeight);

        const currentLevel =  Math.max(minLevel, Math.min(maxLevel, getCurrentZoomLevel( tiledImage ) ));


        //TODO: rewrite integer arithmetics using BigInt here, otherwise we are limited to 2^31 pixels :-)

        const downShift =  maxLevel - currentLevel;
        const downSample = (x) => (x >> 0) >> downShift;
        const upSample = (x) => (x >> 0) << downShift;

        // drawArea in image pixels, then round
        let imageDrawArea = drawArea.times(imageDims.x).apply(Math.round);
        //  const sewImageDims = imageDims.apply(downSample);

        // clip here !!!
        const clipRect = tiledImage.getClip();
        if( clipRect ){
            imageDrawArea = imageDrawArea.intersection(clipRect);
        }

        // flip then
        if( tiledImage.flipped ){
            imageDrawArea =  imageDrawArea.flip( imageDims.x / 2 );
        }

        const imageSewingTileDims = tileDims.apply(upSample);       // current level tile dimensions in image coordinates.

        // calculate tiles Rectangle (at current level) that covers drawArea, in tile (x,y) coordinates
        const tileTL = imageDrawArea.getTopLeft().unscale( imageSewingTileDims ).apply(Math.floor);
        const tileBR = imageDrawArea.getBottomRight().unscale( imageSewingTileDims ).apply(Math.ceil);
        const tilesRect = new $.Rect( tileTL.x, tileTL.y, tileBR.x - tileTL.x, tileBR.y - tileTL.y);

        const imageCanvasRect = tilesRect.scale(imageSewingTileDims);
        let sewCanvasRect = imageCanvasRect.apply(downSample);

        if ( sewCanvasRect.width <= 0 || sewCanvasRect.height <= 0){    // to be on safe side
            return;
        }

        let sewDrawArea = imageDrawArea.apply(downSample);


        // stich tiles on sewCanvas
        //TODO: move stiching to TiledImage class - for further optimization

        const sewCanvas = $.Utils.newOffscreenCanvas(sewCanvasRect.width, sewCanvasRect.height);
        const sewCtx = sewCanvas.getContext('2d');

        // for debug purposes only
        // sewCtx.fillStyle = "rgba(144, 238, 144, 0.2)"; // lightgreen + 20%
        // sewCtx.fillRect(0, 0, sewCanvas.width, sewCanvas.height);

        sewCtx.translate( -sewCanvasRect.x, -sewCanvasRect.y );

        function drawTile( level, x, y){
                const numTiles = tiledImage.source.getNumTiles(level);                    //DAO251: TiledImage._getTile need this for some reason ?????
                const tile = tiledImage._getTile(x, y, level, 0, numTiles);

                const posX = x * tileWidth;             // do not use sewCtx.translate !!!! context.save() is not free
                const posY = y * tileHeight;

                if (tile.loaded){
                    const tileImage = tile.getImage();
                    sewCtx.drawImage(tileImage, posX, posY);
                }

                if (tiledImage.debugMode){
                    sewCtx.save(); // OK in debug mode
                    {
                        sewCtx.translate(posX, posY);
                        sewCtx.strokeRect( 0.5, 0.5, tileWidth - 1, tileHeight - 1);
                        if (tiledImage.flipped){
                            sewCtx.translate(tileWidth, 0);
                            sewCtx.scale(-1, 1);
                        }
                        sewCtx.fillText(`${level}:${x}:${y}`, 10, 25);
                    }
                    sewCtx.restore();
                }

        }

        //   styles for debugMode
        Drawer._applyDebugStyles(sewCtx);

        for( let x = 0; x < tilesRect.width; x++ ){
            for( let y = 0; y < tilesRect.height; y++ ){
                drawTile( currentLevel, tilesRect.x + x, tilesRect.y + y);
            }
        }

        this.context.save();    // OK outside a loop
        {
            const ctx = this.context;

            if( tiledImage.flipped ){       // restore drawArea position
                imageDrawArea = imageDrawArea.flip( imageDims.x / 2 );
            }

            let tl = imageDrawArea.getTopLeft();
            let tr = imageDrawArea.getTopRight();
            let bl = imageDrawArea.getBottomLeft();
            let br = imageDrawArea.getBottomRight();

            if( tiledImage.flipped ){   // swap the drawArea corners
                [tl, tr] = [tr, tl];
                [bl, br] = [br, bl];
            }

            // in theory, we already have all neccesary numbers (position, rotation etc.)
            //DAO251: but I've been lazy, so recalculate to exactly fit OSD 5.0 behaviour
            const posTL = this.viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(tl.x, tl.y, true)
            );
            const posTR = this.viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(tr.x, tr.y, true)
            );
            const posBR = this.viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(br.x, br.y, true)
            );
            const a = (posTR.x - posTL.x) / sewDrawArea.width;
            const b = (posTR.y - posTL.y) / sewDrawArea.width;
            const c = (posBR.x - posTR.x) / sewDrawArea.height;
            const d = (posBR.y - posTR.y) / sewDrawArea.height;
            const e = posTL.x;
            const f = posTL.y;

            ctx.scale( $.pixelDensityRatio, $.pixelDensityRatio );      // transition to logical pixels !!!
            ctx.transform(a, b, c, d, e, f);

            // image Smoothing
            ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
            ctx.globalCompositeOperation = tiledImage.compositeOperation;
            ctx.globalAlpha = tiledImage.opacity;

            ctx.drawImage(sewCtx.canvas,
                sewDrawArea.x - sewCanvasRect.x, sewDrawArea.y - sewCanvasRect.y,
                sewDrawArea.width, sewDrawArea.height,
                0, 0,
                sewDrawArea.width, sewDrawArea.height,
            );
        }
        this.context.restore();
    }
}

$.Drawer = Drawer;

}( OpenSeadragon ));

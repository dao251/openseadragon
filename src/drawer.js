/*
 * OpenSeadragon - Drawer
 *
 * Copyright (C) 2010-2026 OpenSeadragon contributors
 *
 */

(function( $ ){
const OpenSeadragon = $; // (re)alias back to OpenSeadragon for JSDoc

    /**
     * Align an element to the device pixel grid in order to avoid blurry rendering.
     * This adjusts the element's transform so its layout box is snapped to whole
     * device pixels while preserving any existing transform.
     */
    function snapElementToDevicePixels(el) {
        const dpr = window.devicePixelRatio;
        // Get current rendered box
        const rect = el.getBoundingClientRect();
        // Compute aligned CSS pixel coordinates
        let snappedLeft = Math.round(rect.left * dpr) / dpr;
        let snappedTop = Math.round(rect.top * dpr) / dpr;
        // === Quantize to exact DPR grid ===
        // This removes float noise like 0.09999984
        const q = 1 / dpr; // CSS pixel step that maps to 1 device pixel
        snappedLeft = Math.round(snappedLeft / q) * q;
        snappedTop = Math.round(snappedTop / q) * q;
        // Apply correction offset
        const dx = snappedLeft - rect.left;
        const dy = snappedTop - rect.top;
        // Dead-zone to avoid chasing floating-point noise
        const EPS = 1e-5;
        if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) {
            return; // already aligned
        }
        // Apply via transform (safe, non‑layout‑breaking)
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    }


// helper functions and a class
//TODO: move to the TiledImage class

function getZoomLevel(tiledImage, zoom) {                       // 'zoom' means viewport zoom
    zoom = zoom || tiledImage.viewport.getZoom(true);           // defaults to current zoom
    const imageZoom = tiledImage.viewportToImageZoom(zoom);

    const maxLevel = tiledImage.source.maxLevel;
    const minLevel = tiledImage.source.minLevel;

    // imagePixelsPerDevicePixel
    const imageScale = 1 / (imageZoom * $.pixelDensityRatio);
    const lodRangeFactor = Math.max( Number(tiledImage.viewer.lodRangeFactor) || 1, 0);  // default is [1/sqrt2, sqrt2]

    // branch‑free interval definition
    const f = (lodRangeFactor + 1e-5) * 0.5 - 1;   // 1e-5 : heuristics to avoid jittering, need something more elegant
    const sMin = 2 ** f;
    const sMax = 2 ** (f + 1);

    // center of the interval (geometric mean)
    const sCenter = 2 ** (f + 0.5);

    // apply lodRangeFactor BEFORE idealLevel calculation
    const effectiveScale = imageScale * sCenter;

    // continuous ideal level
    const idealLevel = maxLevel - Math.log2(effectiveScale);

    // downsample factor of the ideal level
    const downsample = 2 ** (maxLevel - idealLevel);

    // hysteresis using the SAME interval
    let level;
    if (effectiveScale < downsample * sMin) {
        level = Math.floor(idealLevel);
    } else if (effectiveScale > downsample * sMax) {
        level = Math.ceil(idealLevel);
    } else {
        level = Math.round(idealLevel);
    }

    return Math.max(minLevel, Math.min(maxLevel, level));
}


function getCurrentTileScale(tiledImage, level){
    const zoom = tiledImage.viewport.getZoom(true);
    const imageZoom = tiledImage.viewportToImageZoom(zoom);
    const tileScale = imageZoom * $.pixelDensityRatio * 2 ** (tiledImage.source.maxLevel - level);
    return tileScale;
}

//TODO: Make Composite a class, probably after moving to TiledImage ??
class Composite {
    constructor (tiledImage, level){
        this.tiledImage = tiledImage;
        this.level = level;
    }

    // returns true if the tile was drawn
    drawTile(level, x, y){
        return false;
    }
}
void Composite;

function getComposite( tiledImage, level ) {

    let drawArea = tiledImage.getDrawArea();
    if (!drawArea){
        return undefined;
    }

    const imgSize = tiledImage.getContentSize();
    const maxLevel =  tiledImage.source.maxLevel;

    const tileWidth = tiledImage.source.getTileWidth(maxLevel);         //DAO251: replace with just .tileWidth      // we only support 2x2 tile pyramids !!!!
    const tileHeight = tiledImage.source.getTileHeight(maxLevel);       //DAO251: replace with just .tileHeight     // we only support 2x2 tile pyramids !!!!
    const tileSize = new $.Point(tileWidth, tileHeight);

    const levelScale = 2 ** ( maxLevel - level );

    // drawArea Rectangle in image pixels (expand to integer boundaries ???)
    let imgDrawArea = drawArea.times(imgSize.x).expandToInegerBounds();

    // clip here
    const imgClip = tiledImage.getClip();
    if( imgClip ){
        imgDrawArea = imgDrawArea.intersection(imgClip.apply(Math.round));
    }

    // flip
    //DAO251: it would be better if drawArea had a negative width, but it doesn’t. So we have to flip.
    if( tiledImage.flipped ){
        imgDrawArea =  imgDrawArea.flip( imgSize.x / 2 );
    }

    const imgTileSize = tileSize.times(levelScale);                                 // tileSize in image pixels
    const tilComposite = imgDrawArea.unscale(imgTileSize).expandToInegerBounds();   // composite context rectangle in tile numbers
    const lyrComposite = tilComposite.scale(tileSize);                              // Composite context rectangle in level pixels
    const lyrDrawArea = imgDrawArea.times( 1 / levelScale ).apply(Math.round);      // DrawArea in level pixels

    if ( lyrComposite.width <= 0 || lyrComposite.height <= 0){    // to be on the safe side
        return undefined;
    }

    // stich tiles on compositeCanvas
    const compositeCanvas = $.Utils.newOffscreenCanvas(lyrComposite.width, lyrComposite.height);
    const compositeContext = compositeCanvas.getContext('2d');
    compositeContext.imageSmoothingEnabled = false;   // DON'T smooth, all coordinates are Integers, no scale, no rotation !!!!

    compositeContext.translate( -lyrComposite.x, -lyrComposite.y );

    // TODO: make it a separate method after moving to TiledImage class
    function drawTile( level, x, y){
        const numTiles = tiledImage.source.getNumTiles(level);          //DAO251: TiledImage._getTile need this for some reason ?????
        const tile = tiledImage._getTile(x, y, level, 0, numTiles);

        const posX = x * tileWidth;             // do not use compositeContext.translate here !!!! context.save()/restore() are not free
        const posY = y * tileHeight;

        if (tile.loaded){
            const tileImage = tile.getImage();
            compositeContext.drawImage(tileImage, posX, posY);
        }

        if (tiledImage.debugMode){
            compositeContext.save(); // OK in debug mode
            {
                // styles for debugMode
                compositeContext.strokeStyle = "rgba(255, 63, 255)";
                compositeContext.fillStyle = "rgba(255, 63, 255)";
                compositeContext.font = "20px monospace";
                compositeContext.lineWidth = 1;

                compositeContext.translate(posX, posY);
                compositeContext.strokeRect( 0.5, 0.5, tileWidth - 1, tileHeight - 1);
                if (tiledImage.flipped){
                    compositeContext.textAlign = "right";
                    compositeContext.scale(-1, 1);
                }
                compositeContext.fillText(`  ${level}:${x}:${y}  `, 0, 25);
            }
            compositeContext.restore();
        }

    }

    for( let x = 0; x < tilComposite.width; x++ ){
        for( let y = 0; y < tilComposite.height; y++ ){
            drawTile( level, tilComposite.x + x, tilComposite.y + y);
        }
    }

    const composite = {
        context: compositeContext,
        imgSize: imgSize,
        levelScale: levelScale,
        lyrDrawArea: lyrDrawArea,
        lyrComposite: lyrComposite,
    };

    return composite;
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

$.Drawer = class extends OpenSeadragon.DrawerBase{

    __snapToDevicePixels;   // #private

    constructor(options){
        super(options);
        this.context = this.canvas.getContext( '2d' );

        // this.snapToDevicePixels: default -> true
        this.__snapToDevicePixels = this.viewer.snapToDevicePixels === undefined ? true : !!this.viewer.snapToDevicePixels;

        // check for DPR changes every 250ms
        // shouldn't this be done for the entire OSD ???
        let lastDpr = window.devicePixelRatio;
        setInterval(() => {
            const dpr = window.devicePixelRatio;
            if (dpr !== lastDpr) {
                lastDpr = dpr;
                this.viewer.forceRedraw();
            }
        }, 250);
    }

    get snapToDevicePixels(){
        return this.__snapTodevicePixels;
    }

    set snapToDevicePixels(force){
        if(this.__snapToDevicePixels === !!force){
            return;
        }

        this.__snapToDevicePixels = !!force;
        this.viewer.forceRedraw();
    }

    /**
     * Destroy the drawer
     */
    destroy() {
        this.canvas.remove();
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
        const canvas = $.Utils.newCanvas();
        return canvas;
    }

    /**
     * @returns {Boolean} True - rotation is supported.
     */
    canRotate() {
        return true;
    }

    /**
     * Turns image smoothing on or off for this viewer.
     *
     * @function
     * @param {Boolean} [imageSmoothingEnabled] - Whether or not the image is
     * drawn smoothly on the canvas; see imageSmoothingEnabled in
     * {@link OpenSeadragon.Options} for more explanation.
     */
    setImageSmoothingEnabled(imageSmoothingEnabled){
        this._imageSmoothingEnabled = !!imageSmoothingEnabled;
        this.viewer.forceRedraw();
    }

    /**
     * Draws the TiledImages
     */
    draw(tiledImages) {
        // prepare new frame
        const dpr = $.pixelDensityRatio;

        // const size = this.viewport.getContainerSize()
        //     .times(dpr).apply(Math.ceil);      // must be integer (in device physical pixels)
        const canvas = this.canvas;
        const container = this.viewer.container;

        // 1. Get rendered CSS box (what layout actually produced)
        const rect = container.getBoundingClientRect();

        // 2. Compute DPR-aligned CSS width/height
        //    This ensures cssWidth * dpr and cssHeight * dpr are integers.
        const devWidth  = Math.round(rect.width * dpr);
        const devHeight = Math.round(rect.height * dpr);

        // clears the canvas
        canvas.width = devWidth;
        canvas.height = devHeight;

        // 3. Apply CSS size explicitly (lock it)
        canvas.style.width  = devWidth / dpr + "px";
        canvas.style.height = devHeight / dpr + "px";

        // align the canvas to device pixel boundaries
        if(this.__snapToDevicePixels){
            snapElementToDevicePixels(canvas);
        } else {
            canvas.style.transform = "";
        }

        const ctx = this.context;

        // flip the viewport //DAO251: why here ?
        if( this.viewer.viewport.getFlip() ){
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
        }

        // draw tiledImages onto this.context
        for(const tiledImage of tiledImages){
            if (tiledImage.opacity !== 0) {
                ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
                ctx.globalCompositeOperation = tiledImage.compositeOperation;
                ctx.globalAlpha = tiledImage.opacity;

                this.__drawTiledImage(tiledImage);
            }
        }
    }

    // private, never call outside the Drawer class
    __drawTiledImage( tiledImage ){

        const currentLevel =  getZoomLevel( tiledImage );

        const composite = getComposite(tiledImage, currentLevel);
        if(!composite){
            return;
        }

        const lyrComposite = composite.lyrComposite;
        const imgSize = composite.imgSize;
        const lyrDrawArea = composite.lyrDrawArea;
        const levelScale = composite.levelScale;
        let imgDrawArea = lyrDrawArea.times(levelScale);                                    // correct

        if( tiledImage.flipped ){
            imgDrawArea =  imgDrawArea.flip( imgSize.x / 2 );
        }

        let tl = imgDrawArea.getTopLeft();
        let tr = imgDrawArea.getTopRight();
        let bl = imgDrawArea.getBottomLeft();
        let br = imgDrawArea.getBottomRight();

        if( tiledImage.flipped ){   // swap the drawArea corners
            [tl, tr] = [tr, tl];
            [bl, br] = [br, bl];
        }

        let posTL = this.viewport.viewportToViewerElementCoordinates(       // top-left position of the drawArea in device px
                tiledImage.imageToViewportCoordinates(tl.x, tl.y, true)
            ).times($.pixelDensityRatio);
        let posTR = this.viewport.viewportToViewerElementCoordinates(       // top-right position of the drawArea in device px
                tiledImage.imageToViewportCoordinates(tr.x, tr.y, true)
            ).times($.pixelDensityRatio);
        let posBR = this.viewport.viewportToViewerElementCoordinates(       // bottom-right position of the drawArea in device px
                tiledImage.imageToViewportCoordinates(br.x, br.y, true)
            ).times($.pixelDensityRatio);

        //DAO251: trying to adjust to device pixels....
        if ( this.__snapToDevicePixels) {
            posTL = posTL.apply(Math.round);
            posBR = posBR.apply(Math.round);
        }

        //DAO251: if we decide to calculate TR from TL,BR - do it here !!!

        if ( this.__snapToDevicePixels) {
            posTR = posTR.apply(Math.round); // .apply(Math.round) may break right angles... ???
        }

        // Affine coefficients
        const a = (posTR.x - posTL.x) / lyrDrawArea.width;
        const b = (posTR.y - posTL.y) / lyrDrawArea.width;
        const c = (posBR.x - posTR.x) / lyrDrawArea.height;
        const d = (posBR.y - posTR.y) / lyrDrawArea.height;
        const e = posTL.x;
        const f = posTL.y;

        const ctx = this.context;

        ctx.save();
        ctx.transform(a, b, c, d, e, f);
        ctx.drawImage(
            composite.context.canvas,
            lyrDrawArea.x - lyrComposite.x, lyrDrawArea.y - lyrComposite.y,
            lyrDrawArea.width, lyrDrawArea.height,
            0, 0, lyrDrawArea.width, lyrDrawArea.height,
        );
        ctx.restore();

        //TODO: where to move these ??? or keep for futher optimizations ???
        tiledImage.lastDrawnLevel = currentLevel;
        tiledImage.lastDrawnTileScale = getCurrentTileScale(tiledImage, currentLevel);

    }
};
}( OpenSeadragon ));

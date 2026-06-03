/*
 * OpenSeadragon - Drawer
 *
 * Copyright (C) 2010-2026 OpenSeadragon contributors
 *
 */

(function( $ ){
const OpenSeadragon = $; // (re)alias back to OpenSeadragon for JSDoc

// helper functions and a class
//TODO: move to the TiledImage class

function getZoomLevel( tiledImage ) {
    const zoom = tiledImage.viewport.getZoom(true);
    const imageZoom = tiledImage.viewportToImageZoom(zoom);

    //DAO251: Need to take into account .minPixelRatio (who chose this f... name, what is its physical meaning?????)
    const pixelRatio = 1 / imageZoom *
        Math.max(tiledImage.minPixelRatio, 1 / $.pixelDensityRatio);  //  no sense to exceed the screen resolution

    const maxLevel =  tiledImage.source.maxLevel;
    const idealLevel = maxLevel - Math.log2(pixelRatio);
    const downsample = 2 ** (maxLevel - idealLevel);

    // √2 hysteresis band around the ideal level
    const level = ( pixelRatio < downsample / Math.SQRT2 ?
                Math.floor(idealLevel) :
            ( pixelRatio > downsample * Math.SQRT2 ?
                Math.ceil(idealLevel) :
            Math.round(idealLevel)
        ));
    return level;
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

    // drawArea Rectangle in image pixels (expanded to integer boundaries)
    let imgDrawArea = drawArea.times(imgSize.x).ceil();

    // clip here
    const imgClip = tiledImage.getClip();       // clip area in image coords
    if( imgClip ){
        imgDrawArea = imgDrawArea.intersection(imgClip);
    }

    // flip
    //DAO251: drawArea should have had a negative width, but it doesn't.
    //      so we have to flip (and then flip back)
    if( tiledImage.flipped ){
        imgDrawArea =  imgDrawArea.flip( imgSize.x / 2 );
    }

    const imgTileSize = tileSize.times(levelScale);                             // tileSize in image pixels
    const tilComposite = imgDrawArea.unscale(imgTileSize).ceil();               // composite context rectangle in tile numbers
    const lyrComposite = tilComposite.scale(tileSize);                          // Composite context rectangle in level pixels
    const lyrDrawArea = imgDrawArea.times( 1 / levelScale ).ceil();              // DrawArea in level pixels

    if ( lyrComposite.width <= 0 || lyrComposite.height <= 0){    // to be on the safe side
        return undefined;
    }

    // stich tiles on compositeCanvas
    const compositeCanvas = $.Utils.newOffscreenCanvas(lyrComposite.width, lyrComposite.height);
    const compositeContext = compositeCanvas.getContext('2d');

    compositeContext.translate( -lyrComposite.x, -lyrComposite.y );

    // TODO: make it a separate method after moving to TiledImage class
    function drawTile( level, x, y){
        const numTiles = tiledImage.source.getNumTiles(level);                    //DAO251: TiledImage._getTile need this for some reason ?????
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

    // restore drawArea position, see comments above
    if( tiledImage.flipped ){
        imgDrawArea = imgDrawArea.flip( imgSize.x / 2 );
    }

    const composite = {
        context: compositeContext,
        lyrDrawArea: lyrDrawArea,
        imgDrawArea: imgDrawArea,
        imgSize: imgSize,
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

    constructor(options){
        super(options);
        this.context = this.canvas.getContext( '2d' );
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
        const size = this.viewport.getContainerSize()
            .times($.pixelDensityRatio).apply(Math.ceil);      // must be integer (in device physical pixels)

        // clears the canvas
        this.canvas.width = size.x;
        this.canvas.height = size.y;

        // flip the viewport //DAO251: why here ?
        if( this.viewer.viewport.getFlip() ){
            this.context.scale(-1, 1);
            this.context.translate(-this.context.canvas.width, 0);
        }

        //align the canvas to device pixels (for the cost of 0.03-0.15 ms)
        $.Utils.snapElementToDevicePixels(this.canvas);

        // draw tiledImages onto this.context
        for(const tiledImage of tiledImages){
            if (tiledImage.opacity !== 0) {
                this.__drawTiledImage(tiledImage);
            }
        }
    }

    // private, newer call outside the Drawer class
    __drawTiledImage( tiledImage ){

        const maxLevel =  tiledImage.source.maxLevel;
        const minLevel =  tiledImage.source.minLevel;
        const currentLevel =  Math.max(minLevel, Math.min(maxLevel, getZoomLevel( tiledImage ) ));

        const composite = getComposite(tiledImage, currentLevel);
        if(!composite){
            return;
        }

        // const compositeContext = composite.context;

        let imgDrawArea = composite.imgDrawArea.clone();
        const lyrComposite = composite.lyrComposite;
        // const imgSize = composite.imgSize;
        const lyrDrawArea = composite.lyrDrawArea;

        this.context.save();    // OK outside a loop
        {
            const ctx = this.context;

            let tl = imgDrawArea.getTopLeft();
            let tr = imgDrawArea.getTopRight();
            let bl = imgDrawArea.getBottomLeft();
            let br = imgDrawArea.getBottomRight();

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
            const a = (posTR.x - posTL.x) / lyrDrawArea.width;
            const b = (posTR.y - posTL.y) / lyrDrawArea.width;
            const c = (posBR.x - posTR.x) / lyrDrawArea.height;
            const d = (posBR.y - posTR.y) / lyrDrawArea.height;
            const e = posTL.x;
            const f = posTL.y;

            ctx.scale( $.pixelDensityRatio, $.pixelDensityRatio );      // transition to logical pixels as we're drawing to the screen!!!
            ctx.transform(a, b, c, d, e, f);

            ctx.imageSmoothingEnabled = this._imageSmoothingEnabled;
            ctx.globalCompositeOperation = tiledImage.compositeOperation;
            ctx.globalAlpha = tiledImage.opacity;

            ctx.drawImage(
                composite.context.canvas,
                lyrDrawArea.x - lyrComposite.x, lyrDrawArea.y - lyrComposite.y,
                lyrDrawArea.width, lyrDrawArea.height,
                0, 0,
                lyrDrawArea.width, lyrDrawArea.height,
            );
        }
        this.context.restore();
    }
};
}( OpenSeadragon ));

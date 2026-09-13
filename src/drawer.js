/*
 * OpenSeadragon - Drawer
 *
 * Copyright (C) 2010-2026 OpenSeadragon contributors
 *
 */

(function( $ ){
const OpenSeadragon = $; // (re)alias back to OpenSeadragon for JSDoc

/**
 * @class OpenSeadragon.Drawer
 * @extends OpenSeadragon.DrawerBase
 * @classdesc Common Drawer {@link OpenSeadragon.Viewer}.
 */

$.Drawer = class extends OpenSeadragon.DrawerBase{
    __snapToDevicePixels;   // #private member

    constructor(options){
        super(options);
        this.__snapToDevicePixels = !!this.viewer.snapToDevicePixels;

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
        if(this.__snapToDevicePixels === !!force) return;                       // eslint-disable-line curly
        this.__snapToDevicePixels = !!force;
        this.viewer.forceRedraw();
    }

    /**
     * Destroy the drawer
     */
    destroy() {
        this.canvas.remove();
    }

    getType(){
        return 'drawer';
    }

    static isSupported(){
        return true;        // DAO251: all modern browsers support canvas
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

        const canvas = this.canvas;
        // const ctx = this.context;

        const containerSize = this.viewport.getContainerSize()
            .times(dpr)             // use device pixels, not logical
            .apply(Math.ceil);      // must be integer - round ??

        if ( canvas.width !== containerSize.x || canvas.height !== containerSize.y){
            canvas.style.width  = containerSize.x / dpr + "px";
            canvas.style.height = containerSize.y / dpr + "px";
        }

        this.clear(containerSize.x, containerSize.y);

        // align the canvas to device pixel boundaries
        // if(this.__snapToDevicePixels){
        //     $.Utils.snapElementToDevicePixels(canvas);
        // } else {
        //     canvas.style.transform = "";
        // }

        // --------------------- draw tiledImages onto this.context

        for(const tiledImage of tiledImages){
            if (tiledImage.opacity !== 0) {
                this.__drawTiledImage(tiledImage);
            }
        }
    }

    // private, never call outside the Drawer class
    __drawTiledImage( tiledImage ){

        if (tiledImage.opacity === 0) {
            return;
        }

        const composite = tiledImage.composite;
        if(!composite) return;                                                  // eslint-disable-line curly

        const levelScale = composite.levelScale;
        const lyrImgWidth = composite.imgImageRect.width / levelScale;

        let lyrCompositeRect = composite.lyrCompositeRect;
        let lyrDrawAreaRect = composite.lyrDrawAreaRect;

        // top-left position of the draw area in image px
        const imgTL = new $.Point(
            tiledImage.flipped ? lyrImgWidth - lyrCompositeRect.x : lyrCompositeRect.x,
            lyrCompositeRect.y
        ).times(levelScale);

        // top-left position of the drawArea on viewport (in device px)
        const devTL = this.viewport.viewportToViewerElementCoordinates(
                tiledImage.imageToViewportCoordinates(imgTL.x, imgTL.y, true)
            )
            .times($.pixelDensityRatio);

        const rotationDeg = tiledImage.getRotation(true) + this.viewer.viewport.getRotation(true);   // current rotation
        const scale = tiledImage.getTileScale(composite.level);

        // compute Affine Coefficients
        let a, b, c, d, e, f;

        // rotation in radians
        const rot = rotationDeg * Math.PI / 180;
        const scaleCos = scale * Math.cos(rot);
        const scaleSin = scale * Math.sin(rot);

        // scale + rotate matrix
        a = tiledImage.flipped ? -scaleCos : scaleCos;
        b = tiledImage.flipped ? -scaleSin : scaleSin;
        c = -scaleSin;
        d = scaleCos;

        // translation so that (0, 0) maps to TL
        e = Math.round(devTL.x);
        f = Math.round(devTL.y);

        // flip the viewport
        if( this.viewer.viewport.getFlip() ){
            [a, c, e] = [-a, -c, this.canvas.width - e];
        }

        let sx = lyrDrawAreaRect.x - lyrCompositeRect.x;
        let sy = lyrDrawAreaRect.y - lyrCompositeRect.y;
        let sw = lyrDrawAreaRect.width;
        let sh = lyrDrawAreaRect.height;

        // not a Feng Shui parameters passing (to drawTileBuffer)
        this.__currentCompositeOperation = tiledImage.compositeOperation;
        this.__currentOpacity = tiledImage.opacity;

        this.drawTileBuffer( composite.__tileBuffer, {a, b, c, d, e, f}, { x: sx, y: sy, width: sw, height: sh } );

        //TODO: where to move these ??? needed for demo only yet
        tiledImage.lastDrawnLevel = composite.level;
        tiledImage.lastDrawnTileScale = scale;

        const drawnTiles = composite.drawnTiles.toFlat();
        this._raiseTiledImageDrawnEvent(tiledImage, drawnTiles);

    }

    drawTileBuffer( buffer, affine, srcRect ){
        $.console.warn(" drawTileBuffer not implemented !!!" );
    }
};
}( OpenSeadragon ));

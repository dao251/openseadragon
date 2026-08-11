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
 * @classdesc Default implementation of CanvasDrawer for an {@link OpenSeadragon.Viewer}.
 * @param {Object} options - Options for this Drawer.
 * @param {OpenSeadragon.Viewer} options.viewer - The Viewer that owns this Drawer.
 * @param {OpenSeadragon.Viewport} options.viewport - Reference to Viewer viewport.
 * @param {Element} options.element - Parent element.
 * @param {Number} [options.debugGridColor] - See debugGridColor in {@link OpenSeadragon.Options} for details.
 */

$.Drawer = class extends OpenSeadragon.DrawerBase{
    __snapToDevicePixels;   // #private member

    constructor(options){
        super(options);
        // this.context = this.canvas.getContext( '2d' );
        // this.snapToDevicePixels: default -> true
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

    /**
     * @returns {Boolean} true if canvas is supported by the browser, otherwise false
     */
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
        const container = this.viewer.container;
        const ctx = this.context;

        // Get rendered CSS box (what layout actually produced)

        //DAO251: the best way to avoid layout flush, style flush ang GPU flush
        //  is to cache dimensions. Are they already cached e.g. in Viewport ???? //TODO: check
        //  Particularly, NEVER call getBoundingClientRect() inside render loop like below !!!!!!
        //      const rect = container.getBoundingClientRect();
        //  Now, just minimizing the probability of the flush:
        const rect = new $.Rect(0, 0, container.offsetWidth, container.offsetHeight );

        // Compute DPR-aligned CSS width/height
        //    This ensures cssWidth * dpr and cssHeight * dpr are integers.
        const devWidth  = Math.round(rect.width * dpr);
        const devHeight = Math.round(rect.height * dpr);

        if ( canvas.width !== devWidth || canvas.height !== devHeight){
            canvas.style.width  = devWidth / dpr + "px";
            canvas.style.height = devHeight / dpr + "px";
        }

        $.Utils.clearContext(ctx, devWidth, devHeight);

        // align the canvas to device pixel boundaries
        // if(this.__snapToDevicePixels){
        //     $.Utils.snapElementToDevicePixels(canvas);
        // } else {
        //     canvas.style.transform = "";
        // }

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

        if (tiledImage.opacity === 0) {
            return;
        }

        const composite = tiledImage.composite;
        if(!composite) return;                                                  // eslint-disable-line curly

        const levelScale = composite.levelScale;
        const lyrImgWidth = composite.imgImage.width / levelScale;

        let lyrComposite = composite.lyrComposite;
        let lyrDrawArea = composite.lyrDrawArea;

        // top-left position of the draw area in image px
        const imgTL = new $.Point(
            tiledImage.flipped ? lyrImgWidth - lyrComposite.x : lyrComposite.x,
            lyrComposite.y
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

        // 1) rotation in radians
        const rot = rotationDeg * Math.PI / 180;
        const scaleCos = scale * Math.cos(rot);
        const scaleSin = scale * Math.sin(rot);

        // 2) scale + rotate matrix
        a = tiledImage.flipped ? -scaleCos : scaleCos;
        b = tiledImage.flipped ? -scaleSin : scaleSin;
        c = -scaleSin;
        d = scaleCos;

        // 3) translation so that (0, 0) maps to TL
        e = Math.round(devTL.x);
        f = Math.round(devTL.y);

        let sx = lyrDrawArea.x - lyrComposite.x;
        let sy = lyrDrawArea.y - lyrComposite.y;
        let sw = lyrDrawArea.width;
        let sh = lyrDrawArea.height;

        const ctx = this.context;

        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // flip the viewport
        if( this.viewer.viewport.getFlip() ){
            ctx.scale(-1, 1);
            ctx.translate(-ctx.canvas.width, 0);
        }

        // ctx.save();
            ctx.transform(a, b, c, d, e, f);
            ctx.drawImage(
                composite.context.canvas,
                sx, sy, sw, sh,
                sx, sy, sw, sh,
            );
        // ctx.restore();

        //TODO: where to move these ??? or keep for futher optimizations ???
        tiledImage.lastDrawnLevel = composite.level;
        tiledImage.lastDrawnTileScale = scale;

        const drawnTiles = composite.drawnTiles.toFlat();
        this._raiseTiledImageDrawnEvent(tiledImage, drawnTiles);

    }
};
}( OpenSeadragon ));

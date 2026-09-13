
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


const fullQuad = new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1
]);

const CompositeOps = {
    "source-over": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE, gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE, gl.ONE_MINUS_SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "destination-over": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE_MINUS_DST_ALPHA, gl.ONE,
            gl.ONE_MINUS_DST_ALPHA, gl.ONE
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "source-in": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.DST_ALPHA, gl.ZERO,
            gl.DST_ALPHA, gl.ZERO
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "destination-in": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ZERO, gl.SRC_ALPHA,
            gl.ZERO, gl.SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "source-out": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE_MINUS_DST_ALPHA, gl.ZERO,
            gl.ONE_MINUS_DST_ALPHA, gl.ZERO
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "destination-out": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ZERO, gl.ONE_MINUS_SRC_ALPHA,
            gl.ZERO, gl.ONE_MINUS_SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "source-atop": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
            gl.DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    "destination-atop": (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE_MINUS_DST_ALPHA, gl.SRC_ALPHA,
            gl.ONE_MINUS_DST_ALPHA, gl.SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    lighter: (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE, gl.ONE,
            gl.ONE, gl.ONE
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    copy: (gl) => {
        gl.disable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE, gl.ZERO,
            gl.ONE, gl.ZERO
        );
        gl.blendEquation(gl.FUNC_ADD);
    },

    xor: (gl) => {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(
            gl.ONE_MINUS_DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
            gl.ONE_MINUS_DST_ALPHA, gl.ONE_MINUS_SRC_ALPHA
        );
        gl.blendEquation(gl.FUNC_ADD);
    }
};

function setCompositeOperation(gl, mode) {
    const fn = CompositeOps[mode] || CompositeOps["source-over"];
    fn(gl);
}

class WebGLTileBuffer {
    __size;

    get size() {
        return this.__size;
    }

    constructor(gl, size) {
        this.gl = gl;
        this.__size = size;

        // Create texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Allocate empty texture
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            size,
            size,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );

        // Create framebuffer for drawing into the texture
        this.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.texture,
            0
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    destroy() {
        const gl = this.gl;
        gl.deleteTexture(this.texture);
        gl.deleteFramebuffer(this.fbo);
        this.texture = null;
        this.fbo = null;
        this.__size = 0;
    }

    get valid() {
        return !!this.texture;      //TODO: replace with real validity check, which must be called at TiledImage.prepareComposite (??)
    }

    clear() {
        // no need to clear pixels
    }

    clearRect(rect) {
        // no need to clear pixels
    }

    drawTileImage(image, srcRect, destRect, debugInfo) {

        const gl = this.gl;
        const [sx, sy, sw, sh] = [srcRect.x, srcRect.y, srcRect.width, srcRect.height];
        const [dx, dy, dw, dh] = [destRect.x, destRect.y, destRect.width, destRect.height];

        let img = image;

        // if(true){ // eslint-disable-line
        if(sx !== 0 || sy !== 0 || sw !== dw || sh !== dh || debugInfo ){
            // 1. Reuse a static temporary canvas
            img = WebGLTileBuffer._tmpCanvas || (WebGLTileBuffer._tmpCanvas = document.createElement("canvas"));
            img.width = dw;
            img.height = dh;

            const tctx = img.getContext("2d");
            tctx.imageSmoothingEnabled = false;

            // 2. Crop + (integer) scale
            tctx.clearRect(0, 0, dw, dh);
            tctx.drawImage(
                image,
                sx, sy, sw, sh,
                0, 0, dw, dh   // integer scaling
            );
            if (debugInfo) {
                $.Utils.drawDebugInfoOnCanvas( tctx, { x: 0, y: 0, width: dw, height: dh }, debugInfo );
            }

        }

        // 3. Upload scaled region into tileBuffer texture
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        try{
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                dx, dy,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                img
            );
        } catch (err) {
            if (err.name === "SecurityError") {
                console.log("non-CORS tile image:", err.message);
            } else {
                throw err; // rethrow if it's not CORS
            }
        }
        // //debug:  (getError is extremely slow !!!!)
        // const err = gl.getError();
        // void err;

    }

    // Helper: parse CSS color → RGBA floats
    static parseColor(css) {
        if (!css){
            return [0, 0, 0, 0];
        }
        const c = (WebGLTileBuffer._tmpCanvas || (WebGLTileBuffer._tmpCanvas = document.createElement("canvas"))).getContext("2d");
        c.fillStyle = css;  // this normalizes to either '#rrggbb' or to 'rgba(r, g, b, a)'
        const s = c.fillStyle;

        // opaque colors → "#rrggbb"
        if (s.startsWith('#')) {
            const r = parseInt(s.slice(1, 3), 16);
            const g = parseInt(s.slice(3, 5), 16);
            const b = parseInt(s.slice(5, 7), 16);
            return [r, g, b, 255];
        }

        // transparent colors → "rgba(r, g, b, a)"
        const m = s.match(/rgba?\(([^)]+)\)/)[1].split(/\s*,\s*/);
        const r = +m[0];
        const g = +m[1];
        const b = +m[2];
        const a = m[3] !== undefined ? Math.round(+m[3] * 255) : 255;

        return [r, g, b, a];
    }
}

   /**
    * @class OpenSeadragon.WebGLDrawer
    * @classdesc Default implementation of WebGLDrawer for an {@link OpenSeadragon.Viewer}.
    * @param {Object} options - Options for this Drawer.
    * @param {OpenSeadragon.Viewer} options.viewer - The Viewer that owns this Drawer.
    * @param {OpenSeadragon.Viewport} options.viewport - Reference to Viewer viewport.
    * @param {Element} options.element - Parent element.
    * @param {Number} [options.debugGridColor] - See debugGridColor in {@link OpenSeadragon.Options} for details.
    */

$.WebGLDrawer = class extends OpenSeadragon.Drawer{

    constructor(options){
        super(options);
        this.gl = this.canvas.getContext( 'webgl', {alpha: true} );

        this.initProgram();
        this.initQuadBuffers();
    }

    initProgram() {
        const gl = this.gl;

        const vsSource = `
            attribute vec2 aPos;      // unit quad (0..1)
            attribute vec2 aUV;

            uniform vec2 uCanvasSize; // [width, height]
            uniform vec4 uSrcRect;    // [sx, sy, sw, sh] in buffer
            uniform mat3 uAffine;     // adjusted for WebGL (see JS below)

            varying vec2 vUV;

            void main() {
                // buffer-space coords inside srcRect
                float bx = uSrcRect.x + aPos.x * uSrcRect.z;
                float by = uSrcRect.y + aPos.y * uSrcRect.w;

                // apply affine: buffer → canvas
                vec3 p = uAffine * vec3(bx, by, 1.0);

                // canvas → clip (Y-down → Y-up)
                float x = (p.x / uCanvasSize.x) * 2.0 - 1.0;
                float y = 1.0 - (p.y / uCanvasSize.y) * 2.0;

                gl_Position = vec4(x, y, 0.0, 1.0);
                vUV = aUV;
            }
        `;

        const fsSource = `
            precision mediump float;

            uniform sampler2D uTex;
            uniform float uAlpha;

            varying vec2 vUV;

            void main() {
                vec4 c = texture2D(uTex, vUV);
                gl_FragColor = vec4(c.rgb * uAlpha, c.a * uAlpha);
            }
        `;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vsSource);
        gl.compileShader(vs);

        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource);
        gl.compileShader(fs);

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        this.program = program;

        // Cache attribute/uniform locations
        this.aPos = gl.getAttribLocation(program, "aPos");
        this.aUV  = gl.getAttribLocation(program, "aUV");
        this.uTex = gl.getUniformLocation(program, "uTex");
        this.uCanvasSize = gl.getUniformLocation(program, "uCanvasSize");
        this.uSrcRect = gl.getUniformLocation(program, "uSrcRect");
        this.uAffine  = gl.getUniformLocation(program, "uAffine");
        this.uAlpha = gl.getUniformLocation(program, "uAlpha");

    }

    initQuadBuffers() {
        const gl = this.gl;

        this.posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fullQuad, gl.STATIC_DRAW);

        this.uvBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, fullQuad, gl.STATIC_DRAW);
    }

    clear(width, height) {
        const gl = this.gl;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width  = width;
            this.canvas.height = height;

            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.useProgram(this.program);
            gl.uniform2f(this.uCanvasSize, this.canvas.width, this.canvas.height);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

    }

    newTileBuffer(size){
        return new WebGLTileBuffer(this.gl, size);
    }

    drawTileBuffer(buffer, affine, srcRect) {
        const gl = this.gl;
        const [sx, sy, sw, sh] = [srcRect.x, srcRect.y, srcRect.width, srcRect.height];     // source rect in buffer coordinates
        const {a, b, c, d, e, f} = affine;                                                  // buffer → canvas

        gl.useProgram(this.program);

        // --- bind texture ---
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, buffer.texture);
        gl.uniform1i(this.uTex, 0);

        // --- srcRect in buffer space ---
        gl.uniform4f(this.uSrcRect, sx, sy, sw, sh);

        // Canvas: [a b; c d] in Y-down
        // WebGL (Y-up) equivalent: [a -b; -c d] in case the matrix determinant is positive
        //      in case the determinant is negetive - use original matrix
        const det = a * d - b * c;
        const reflection = det > 0 ? -1 : 1;

        const m = new Float32Array([
            a, c * reflection, 0,
            b * reflection, d, 0,
            e, f, 1,
        ]);

        gl.uniformMatrix3fv(this.uAffine, false, m);

        // --- UVs for srcRect in buffer ---
        const texSize = buffer.size;
        const u0 = sx / texSize;
        const v0 = sy / texSize;
        const u1 = (sx + sw) / texSize;
        const v1 = (sy + sh) / texSize;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            u0, v0,
            u1, v0,
            u0, v1,
            u1, v1
        ]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.aUV);
        gl.vertexAttribPointer(this.aUV, 2, gl.FLOAT, false, 0, 0);

        // --- quad geometry (unit quad) ---
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
        gl.enableVertexAttribArray(this.aPos);
        gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

        // --- smoothing ---
        if (this._imageSmoothingEnabled) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }

        // --- opacity ---
        gl.uniform1f(this.uAlpha, this.__currentOpacity);

        // --- globalCompositeOperation ---
        // we only support Porter–Duff modes yet
        // Photoshop-style modes require a "blend-mode fragment shader" - a purely technical exercise //TODO
        // Or, alternatively, if we properly implement arbitrary (user) shaders, we won't need it.
        setCompositeOperation(gl, this.__currentCompositeOperation);

        // --- draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

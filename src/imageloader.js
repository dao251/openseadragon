/*
 * OpenSeadragon - ImageLoader
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2024 OpenSeadragon contributors

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

(function($){

/**
 * @class ImageJob
 * @classdesc Handles downloading of a single image.
 *
 * @memberof OpenSeadragon
 * @param {Object} options - Options for this ImageJob.
 * @param {String} [options.src] - URL of image to download.
 * @param {Tile} [options.tile] - Tile that belongs the data to.
 * @param {TileSource} [options.source] - Image loading strategy
 * @param {String} [options.loadWithAjax] - Whether to load this image with AJAX.
 * @param {String} [options.ajaxHeaders] - Headers to add to the image request if using AJAX.
 * @param {Boolean} [options.ajaxWithCredentials] - Whether to set withCredentials on AJAX requests.
 * @param {String} [options.crossOriginPolicy] - CORS policy to use for downloads
 * @param {String} [options.postData] - HTTP POST data (usually but not necessarily in k=v&k2=v2... form,
 *      see TileSource::getPostData) or null
 * @param {Function} [options.callback] - Called once image has been downloaded.
 * @param {Function} [options.abort] - Called when this image job is aborted.
 * @param {Number} [options.timeout] - The max number of milliseconds that this image job may take to complete.
 * @param {Number} [options.tries] - Actual number of the current try.
 */
$.ImageJob = function(options) {

    $.extend(true, this, {
        timeout: $.DEFAULT_SETTINGS.timeout,
        jobId: null,
        tries: 0
    }, options);

    /**
     * Data object which will contain downloaded image data.
     * @member {Image|*} data data object, by default an Image object (depends on TileSource)
     * @memberof OpenSeadragon.ImageJob#
     */
    this.data = null;

    /**
     * User workspace to populate with helper variables
     * @member {*} userData to append custom data and avoid namespace collision
     * @memberof OpenSeadragon.ImageJob#
     */
    this.userData = {};

    /**
     * Error message holder
     * @member {string} error message
     * @memberof OpenSeadragon.ImageJob#
     * @private
     */
    this.errorMsg = null;
};

$.ImageJob.prototype = {
    /**
     * Starts the image job.
     * @method
     * @memberof OpenSeadragon.ImageJob#
     */
    start: function() {
        this.tries++;

        this.jobId = window.setTimeout(() => {      // DAO251: use arrow syntax for 'this'
            this.finish(null, null, "Image load exceeded timeout (" + this.timeout + " ms)");
        }, this.timeout);

        this.abort = () => {                        // DAO251: use arrow syntax for 'this'
            // DAO251: moved downloadTileAbort from TileSource class : downloadTileAbort: function (context) {
            if (this.userData.request) {
                this.userData.request.abort();
            }
            var image = this.userData.image;
            if (image) {
                image.onload = image.onerror = image.onabort = null;
            }
            // DAO251: moved downloadTileAbort: },

            if (typeof this.abort === "function") {
                this.abort();
            }
        };

        //DAO251: moved downloadTileStart functionality back here: downloadTileStart: function (context) {
            var dataStore = this.userData,
                image = new Image();

            dataStore.image = image;
            dataStore.request = null;

            var finish = (error) => { //DAO251: use arrow syntax for 'this'
                if (!image) {
                    this.finish(null, dataStore.request, "Image load failed: undefined Image instance.");
                    return;
                }
                image.onload = image.onerror = image.onabort = null;
                this.finish(error ? null : image, dataStore.request, error);
            };

            image.onload = function () {
                finish();
            };

            image.onabort = image.onerror = function() {
                finish("Image load aborted.");
            };

            // Load the tile with an AJAX request if the loadWithAjax option is
            // set. Otherwise load the image by setting the source property of the image object.

            if (this.loadWithAjax) {
            dataStore.request = $.makeAjaxRequest({
                url: this.src,
                withCredentials: this.ajaxWithCredentials,
                headers: this.ajaxHeaders,
                responseType: "arraybuffer",
                postData: this.postData,
                success: function(request) {
                    var blb;
                    // Make the raw data into a blob.
                    // BlobBuilder fallback adapted from
                    // http://stackoverflow.com/questions/15293694/blob-constructor-browser-compatibility
                    try {
                        blb = new window.Blob([request.response]);
                    } catch (e) {
                        var BlobBuilder = (
                            window.BlobBuilder ||
                            window.WebKitBlobBuilder ||
                            window.MozBlobBuilder ||
                            window.MSBlobBuilder
                        );
                        if (e.name === 'TypeError' && BlobBuilder) {
                            var bb = new BlobBuilder();
                            bb.append(request.response);
                            blb = bb.getBlob();
                        }
                    }
                    // If the blob is empty for some reason consider the image load a failure.
                    if (blb.size === 0) {
                        finish("Empty image response.");
                    } else {
                        // Create a URL for the blob data and make it the source of the image object.
                        // This will still trigger Image.onload to indicate a successful tile load.
                        image.src = (window.URL || window.webkitURL).createObjectURL(blb);
                    }
                },
                error: function(request) {
                    finish("Image load aborted - XHR error");
                }
            });
            } else {
                if (this.crossOriginPolicy !== false) {
                    image.crossOrigin = this.crossOriginPolicy;
                }
                image.src = this.src;
            }
    },

    /**
     * Finish this job.
     * @param {*} data data that has been downloaded
     * @param {XMLHttpRequest} request reference to the request if used
     * @param {string} errorMessage description upon failure
     * @memberof OpenSeadragon.ImageJob#
     */
    finish: function(data, request, errorMessage ) {
        this.data = data;
        this.request = request;
        this.errorMsg = errorMessage;

        if (this.jobId) {
            window.clearTimeout(this.jobId);
        }

        this.callback(this);
    }
};

/**
 * @class ImageLoader
 * @memberof OpenSeadragon
 * @classdesc Handles downloading of a set of images using asynchronous queue pattern.
 * You generally won't have to interact with the ImageLoader directly.
 * @param {Object} options - Options for this ImageLoader.
 * @param {Number} [options.jobLimit] - The number of concurrent image requests. See imageLoaderLimit in {@link OpenSeadragon.Options} for details.
 * @param {Number} [options.timeout] - The max number of milliseconds that an image job may take to complete.
 */
$.ImageLoader = function(options) {

    $.extend(true, this, {
        jobLimit:       $.DEFAULT_SETTINGS.imageLoaderLimit,
        timeout:        $.DEFAULT_SETTINGS.timeout,
        jobQueue:       [],
        failedTiles:    [],
        jobsInProgress: 0
    }, options);

};

/** @lends OpenSeadragon.ImageLoader.prototype */
$.ImageLoader.prototype = {

    /**
     * Add an unloaded image to the loader queue.
     * @method
     * @param {Object} options - Options for this job.
     * @param {String} [options.src] - URL of image to download.
     * @param {Tile} [options.tile] - Tile that belongs the data to. The tile instance
     *      is not internally used and serves for custom TileSources implementations.
     * @param {TileSource} [options.source] - Image loading strategy
     * @param {String} [options.loadWithAjax] - Whether to load this image with AJAX.
     * @param {String} [options.ajaxHeaders] - Headers to add to the image request if using AJAX.
     * @param {String|Boolean} [options.crossOriginPolicy] - CORS policy to use for downloads
     * @param {String} [options.postData] - POST parameters (usually but not necessarily in k=v&k2=v2... form,
     *      see TileSource::getPostData) or null
     * @param {Boolean} [options.ajaxWithCredentials] - Whether to set withCredentials on AJAX
     *      requests.
     * @param {Function} [options.callback] - Called once image has been downloaded.
     * @param {Function} [options.abort] - Called when this image job is aborted.
     */
    addJob: function(options) {
        if (!options.source) {
            $.console.error('ImageLoader.prototype.addJob() requires [options.source]. ' +
                'TileSource since new API defines how images are fetched. Creating a dummy TileSource.');
            // var implementation = $.TileSource.prototype;
            options.source = {
                // DAO251: removed downloadTileStart, downloadTileAbort methods of TileSource class
                // downloadTileStart: implementation.downloadTileStart,
                // downloadTileAbort: implementation.downloadTileAbort
            };
        }

        var _this = this,
            complete = function(job) {
                completeJob(_this, job, options.callback);
            },
            jobOptions = {
                src: options.src,
                tile: options.tile || {},
                source: options.source,
                loadWithAjax: options.loadWithAjax,
                ajaxHeaders: options.loadWithAjax ? options.ajaxHeaders : null,
                crossOriginPolicy: options.crossOriginPolicy,
                ajaxWithCredentials: options.ajaxWithCredentials,
                postData: options.postData,
                callback: complete,
                abort: options.abort,
                timeout: this.timeout
            },
            newJob = new $.ImageJob(jobOptions);

        if ( !this.jobLimit || this.jobsInProgress < this.jobLimit ) {
            newJob.start();
            this.jobsInProgress++;
        }
        else {
            this.jobQueue.push( newJob );
        }
    },

    /**
     * Clear any unstarted image loading jobs from the queue.
     * @method
     */
    clear: function() {
        for( var i = 0; i < this.jobQueue.length; i++ ) {
            var job = this.jobQueue[i];
            if ( typeof job.abort === "function" ) {
                job.abort();
            }
        }

        this.jobQueue = [];
    }
};

/**
 * Cleans up ImageJob once completed. Restarts job after tileRetryDelay seconds if failed
 * but max tileRetryMax times
 * @method
 * @private
 * @param loader - ImageLoader used to start job.
 * @param job - The ImageJob that has completed.
 * @param callback - Called once cleanup is finished.
 */
function completeJob(loader, job, callback) {
    if (job.errorMsg !== '' && (job.data === null || job.data === undefined) && job.tries < 1 + loader.tileRetryMax) {
        loader.failedTiles.push(job);
    }
    var nextJob;

    loader.jobsInProgress--;

    if ((!loader.jobLimit || loader.jobsInProgress < loader.jobLimit) && loader.jobQueue.length > 0) {
        nextJob = loader.jobQueue.shift();
        nextJob.start();
        loader.jobsInProgress++;
    }

    if (loader.tileRetryMax > 0 && loader.jobQueue.length === 0) {
        if ((!loader.jobLimit || loader.jobsInProgress < loader.jobLimit) && loader.failedTiles.length > 0) {
             nextJob = loader.failedTiles.shift();
             setTimeout(function () {
                 nextJob.start();
             }, loader.tileRetryDelay);
             loader.jobsInProgress++;
         }
     }

    callback(job.data, job.errorMsg, job.request);
}

}(OpenSeadragon));

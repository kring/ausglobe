"use strict";

/*global require,Cesium*/
var BingMapsApi = Cesium.BingMapsApi;
var defaultValue = Cesium.defaultValue;
var defined = Cesium.defined;
var defineProperties = Cesium.defineProperties;
var DeveloperError = Cesium.DeveloperError;
var Ellipsoid = Cesium.Ellipsoid;
var jsonp = Cesium.jsonp;
var CesiumMath = Cesium.Math;
var Matrix4 = Cesium.Matrix4;
var Rectangle = Cesium.Rectangle;
var CameraFlightPath = Cesium.CameraFlightPath;
var SceneMode = Cesium.SceneMode;
var when = Cesium.when;
var createCommand = Cesium.createCommand;

var knockout = require('knockout');

/**
 * The view model for the {@link Geocoder} widget.
 * @alias SearchWidgetViewModel
 * @constructor
 *
 * @param {Scene} options.scene The Scene instance to use.
 * @param {String} [options.url='//dev.virtualearth.net'] The base URL of the Bing Maps API.
 * @param {String} [options.key] The Bing Maps key for your application, which can be
 *        created at {@link https://www.bingmapsportal.com}.
 *        If this parameter is not provided, {@link BingMapsApi.defaultKey} is used.
 *        If {@link BingMapsApi.defaultKey} is undefined as well, a message is
 *        written to the console reminding you that you must create and supply a Bing Maps
 *        key as soon as possible.  Please do not deploy an application that uses
 *        this widget without creating a separate key for your application.
 * @param {Ellipsoid} [options.ellipsoid=Ellipsoid.WGS84] The Scene's primary ellipsoid.
 * @param {Number} [options.flightDuration=1500] The duration of the camera flight to an entered location, in milliseconds.
 */
var SearchWidgetViewModel = function(options) {
    //>>includeStart('debug', pragmas.debug);
    if (!defined(options) || !defined(options.viewer)) {
        throw new DeveloperError('options.scene is required.');
    }
    //>>includeEnd('debug');

    this._url = defaultValue(options.url, '//dev.virtualearth.net/');
    if (this._url.length > 0 && this._url[this._url.length - 1] !== '/') {
        this._url += '/';
    }

    this._key = BingMapsApi.getKey(options.key);
    this._viewer = options.viewer;
    this._ellipsoid = defaultValue(options.ellipsoid, Ellipsoid.WGS84);
    this._flightDuration = defaultValue(options.flightDuration, 1500);
    this._searchText = '';
    this._isSearchInProgress = false;
    this._geocodeInProgress = undefined;

    var that = this;
    this._searchCommand = createCommand(function() {
        if (that.isSearchInProgress) {
            cancelGeocode(that);
        } else {
            geocode(that);
        }
    });

    knockout.track(this, ['_searchText', '_isSearchInProgress']);

    /**
     * Gets a value indicating whether a search is currently in progress.  This property is observable.
     *
     * @type {Boolean}
     */
    this.isSearchInProgress = undefined;
    knockout.defineProperty(this, 'isSearchInProgress', {
        get : function() {
            return this._isSearchInProgress;
        }
    });

    /**
     * Gets or sets the text to search for.
     *
     * @type {String}
     */
    this.searchText = undefined;
    knockout.defineProperty(this, 'searchText', {
        get : function() {
            if (this.isSearchInProgress) {
                return 'Searching...';
            }
            return this._searchText;
        },
        set : function(value) {
            //>>includeStart('debug', pragmas.debug);
            if (typeof value !== 'string') {
                throw new DeveloperError('value must be a valid string.');
            }
            //>>includeEnd('debug');

            this._searchText = value;
        }
    });

    /**
     * Gets or sets the the duration of the camera flight in milliseconds.
     * A value of zero causes the camera to instantly switch to the geocoding location.
     *
     * @type {Number}
     * @default 1500
     */
    this.flightDuration = undefined;
    knockout.defineProperty(this, 'flightDuration', {
        get : function() {
            return this._flightDuration;
        },
        set : function(value) {
            //>>includeStart('debug', pragmas.debug);
            if (value < 0) {
                throw new DeveloperError('value must be positive.');
            }
            //>>includeEnd('debug');

            this._flightDuration = value;
        }
    });
};

defineProperties(SearchWidgetViewModel.prototype, {
    /**
     * Gets the Bing maps url.
     * @memberof SearchWidgetViewModel.prototype
     *
     * @type {String}
     */
    url : {
        get : function() {
            return this._url;
        }
    },

    /**
     * Gets the Bing maps key.
     * @memberof SearchWidgetViewModel.prototype
     *
     * @type {String}
     */
    key : {
        get : function() {
            return this._key;
        }
    },

    /**
     * Gets the scene to control.
     * @memberof SearchWidgetViewModel.prototype
     *
     * @type {Scene}
     */
    viewer : {
        get : function() {
            return this._viewer;
        }
    },

    /**
     * Gets the ellipsoid to be viewed.
     * @memberof SearchWidgetViewModel.prototype
     *
     * @type {Ellipsoid}
     */
    ellipsoid : {
        get : function() {
            return this._ellipsoid;
        }
    },

    /**
     * Gets the Command that is executed when the button is clicked.
     * @memberof SearchWidgetViewModel.prototype
     *
     * @type {Command}
     */
    search : {
        get : function() {
            return this._searchCommand;
        }
    }
});

function geocode(viewModel) {
    var query = viewModel.searchText;

    if (/^\s*$/.test(query)) {
        //whitespace string
        return;
    }

    viewModel._isSearchInProgress = true;

    var cameraPosition = viewModel._viewer.scene.camera.positionWC;
    var cameraPositionCartographic = Ellipsoid.WGS84.cartesianToCartographic(cameraPosition);

    var promise = jsonp(viewModel._url + 'REST/v1/Locations?userLocation=' + CesiumMath.toDegrees(cameraPositionCartographic.latitude) + ',' + CesiumMath.toDegrees(cameraPositionCartographic.longitude) , {
        parameters : {
            query : query,
            key : viewModel._key
        },
        callbackParameterName : 'jsonp'
    });

    var geocodeInProgress = viewModel._geocodeInProgress = when(promise, function(result) {
        if (geocodeInProgress.cancel) {
            return;
        }
        viewModel._isSearchInProgress = false;

        if (result.resourceSets.length === 0) {
            viewModel.searchText = viewModel._searchText + ' (not found)';
            return;
        }

        var resourceSet = result.resourceSets[0];
        if (resourceSet.resources.length === 0) {
            viewModel.searchText = viewModel._searchText + ' (not found)';
            return;
        }

        var resource = resourceSet.resources[0];

        // Prefer the resource that is in Australia, if any.
        for (var i = 0; i < resourceSet.resources.length; ++i) {
            var resource = resourceSet.resources[i];
            if (defined(resource.address) && resource.address.countryRegion === 'Australia') {
                resource = resourceSet.resources[i];
                break;
            }
        }

        viewModel._searchText = resource.name;
        var bbox = resource.bbox;
        var south = bbox[0];
        var west = bbox[1];
        var north = bbox[2];
        var east = bbox[3];
        var rectangle = Rectangle.fromDegrees(west, south, east, north);

        if (viewModel._viewer.viewer) {
            // Cesium
            var camera = viewModel._viewer.scene.camera;
            var position = camera.getRectangleCameraCoordinates(rectangle);
            if (!defined(position)) {
                // This can happen during a scene mode transition.
                return;
            }

            var options = {
                destination: position,
                duration: viewModel._flightDuration,
                onComplete: function () {
                    var screenSpaceCameraController = viewModel._viewer.scene.screenSpaceCameraController;
                    screenSpaceCameraController.ellipsoid = viewModel._ellipsoid;
                },
                endReferenceFrame: Matrix4.IDENTITY,
                convert: false
            };

            var flight = CameraFlightPath.createAnimation(viewModel._viewer.scene, options);
            viewModel._viewer.scene.animations.add(flight);
        } else {
            // Leaflet
            viewModel._viewer.map.fitBounds([[south, west], [north, east]]);
        }
    }, function() {
        if (geocodeInProgress.cancel) {
            return;
        }

        viewModel._isSearchInProgress = false;
        viewModel.searchText = viewModel._searchText + ' (error)';
    });
}

function cancelGeocode(viewModel) {
    viewModel._isSearchInProgress = false;
    if (defined(viewModel._geocodeInProgress)) {
        viewModel._geocodeInProgress.cancel = true;
        viewModel._geocodeInProgress = undefined;
    }
}

module.exports = SearchWidgetViewModel;

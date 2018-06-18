// https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js
// https://codepen.io/ping13/pen/xzLOqe

L.MapkitMutant = L.Layer.extend({
	options: {
		minZoom: 3,
		maxZoom: 23,
		tileSize: 256,
		// 		opacity: 1,

		// 🍂option type: String = 'standard'
		// mapkit's map type. Valid values are strings 'standard' (default),
		// 'satellite' or 'hybrid'.
		type: "standard",

		// 🍂option authorizationCallback: Function
		// An autorization callback function, as described
		// in [Apple's mapkitJS documentation](https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init)
		authorizationCallback: function() {},

		// 🍂option language: String = undefined
		// A language code, as described in
		// [Apple's mapkitJS documentation](https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init).
		// By default Mapkit will use the locale setting from the web browser.

		// 🍂option opacity: Number = 1.0
        // The opacity of the MapkitMutant
	},

	initialize: function(options) {
		L.Util.setOptions(this, options);

		/// TODO: Add a this._mapkitPromise, just like GoogleMutant

		mapkit.init({
			authorizationCallback: this.options.authorizationCallback,
			language: this.options.langhage,
		});
	},

	onAdd: function(map) {
		this._map = map;

		this._initMutantContainer();

		this._initMutant();

		map.on("move zoom moveend zoomend", this._update, this);
		map.on("resize", this._resize, this);
		this._resize();
	},

	onRemove: function(map) {
		map._container.removeChild(this._mutantContainer);
		this._mutantContainer = undefined;
		map.off("move zoom moveend zoomend", this._update, this);
		map.off("resize", this._resize, this);
        this._mutant.removeEventListener("region-change-end", this._onRegionChangeEnd, this);
        if (this._canvasOverlay) {
            this._canvasOverlay.remove();
        }

	},

    // Create the HTMLElement for the mutant map, and add it as a children
    // of the Leaflet Map container
	_initMutantContainer: function() {
		if (!this._mutantContainer) {
			this._mutantContainer = L.DomUtil.create(
				"div",
				"leaflet-mapkit-mutant leaflet-top leaflet-left"
			);
			this._mutantContainer.id =
				"_MutantContainer_" + L.Util.stamp(this._mutantContainer);
			this._mutantContainer.style.zIndex = "200"; //leaflet map pane at 400, controls at 1000
			this._mutantContainer.style.pointerEvents = "none";

			this._map.getContainer().appendChild(this._mutantContainer);
		}

		// 		this.setOpacity(this.options.opacity);
		this.setElementSize(this._mutantContainer, this._map.getSize());

		//this._attachObserver(this._mutantContainer);
	},

    // Create the mutant map inside the mutant container
	_initMutant: function() {
		if (!this._mutantContainer) return;

		var mapType = mapkit.Map.MapTypes.Standard;
		if (this.options.maptype === "hybrid") {
			mapType = mapkit.Map.MapTypes.Hybrid;
		} else if (this.options.maptype === "satellite") {
			mapType = mapkit.Map.MapTypes.Satellite;
		}

		var map = new mapkit.Map(this._mutantContainer, {
			region: this._leafletBoundsToMapkitRegion(),
			showsUserLocation: false,
			showsUserLocationControl: false,
			showsCompass: false,
			showsZoomControl: false,
			showsUserLocationControl: false,
			showsScale: false,
			showsMapTypeControl: false,
			mapType: mapType,
		});

		this._mutant = map;
		map.addEventListener("region-change-end", this._onRegionChangeEnd, this);
		map.addEventListener("region-change-start", this._onRegionChangeStart, this);

		// 🍂event spawned
		// Fired when the mutant has been created.
		this.fire("spawned", { mapObject: map });
	},

	// Fetches the map's current bounds and returns an instance of
	// mapkit.CoordinateRegion
	_leafletBoundsToMapkitRegion: function() {
		var bounds = this._map.getBounds();
		var center = bounds.getCenter();
		var width = bounds.getEast() - bounds.getWest();
		var height = bounds.getNorth() - bounds.getSouth();
		return new mapkit.CoordinateRegion(
			// Center
			new mapkit.Coordinate(center.lat, center.lng),
			// Span
			new mapkit.CoordinateSpan(height, width)
		);
	},

	// Given an instance of mapkit.CoordinateRegion, returns an instance
	// of Leaflet's LatLngBounds
	_mapkitRegionToLeafletBounds: function(region) {
		var minLat = region.center.latitude - region.span.latitudeDelta / 2;
		var minLng = region.center.longitude - region.span.longitudeDelta / 2;
		var maxLat = region.center.latitude + region.span.latitudeDelta / 2;
		var maxLng = region.center.longitude + region.span.longitudeDelta / 2;

		return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
	},

	_update: function() {
		if (this._map && this._mutant) {
			// 			console.log(
			// 				"",
			// 				this._leafletBoundsToMapkitRegion().toString(),
			// 				"vs",
			// 				this._mutant.region.toString()
			// 			);

			this._mutant.setRegionAnimated(
				this._leafletBoundsToMapkitRegion(),
				false
			);
		}
	},

	_resize: function() {
		var size = this._map.getSize();
		if (
			this._mutantContainer.style.width === size.x &&
			this._mutantContainer.style.height === size.y
		)
			return;
		this.setElementSize(this._mutantContainer, size);
		if (!this._mutant) return;
	},

	_onRegionChangeEnd: function(ev) {
        console.timeStamp('region-change-end');

// 		console.log(ev.target.region.toString());

// 		var bounds = this._mapkitRegionToLeafletBounds(this._mutant.region);
// 		if (!this.rectangle) {
// 			this.rectangle = L.rectangle(bounds, {
// 				fill: false,
// 			}).addTo(map);
// 		} else {
// 			this.rectangle.setBounds(bounds);
// 		}

		if (!this._mutantCanvas) {
			this._mutantCanvas = this._mutantContainer.querySelector(
				"canvas.syrup-canvas"
			);
		}

		if (this._map && this._mutantCanvas) {

            var bounds = this._mapkitRegionToLeafletBounds(this._mutant.region);

            L.Util.cancelAnimFrame(this._requestedFrame);

            this._requestedFrame = L.Util.requestAnimFrame(function() {
                if (!this._canvasOverlay) {
                    this._canvasOverlay = L.imageOverlay(null, bounds);

                    // Hack the ImageOverlay's _image property so that it doesn't
                    // create a HTMLImageElement
    //                 this._canvasOverlay._image = this._mutantCanvas;
                    var img = this._canvasOverlay._image = L.DomUtil.create('div');
    //                 img.style.position = 'relative';

                    L.DomUtil.addClass(img, 'leaflet-image-layer');
                    L.DomUtil.addClass(img, 'leaflet-zoom-animated');

                    // Move the mutant's canvas out of its container, and into
                    // the L.ImageOverlay's _image
                    this._mutantCanvas.parentElement.removeChild(this._mutantCanvas);
                    img.appendChild(this._mutantCanvas);

                    this._canvasOverlay.addTo(this._map);
                    this._updateOpacity();
                } else {
                    this._canvasOverlay.setBounds(bounds);
                }
                this._mutantCanvas.style.width = '100%';
                this._mutantCanvas.style.height = '100%';
                this._mutantCanvas.style.position = 'absolute';

                if (!this.rectangle) {
                    this.rectangle = L.rectangle(bounds, {
                        fill: false,
                    }).addTo(this._map);
                } else {
                    this.rectangle.setBounds(bounds);
                }
            }, this);


// 			var topLeft = this._map.latLngToContainerPoint(bounds.getNorthWest());
// 			var size = this._map
// 				.latLngToContainerPoint(bounds.getSouthEast())
// 				.subtract(topLeft);
//
// 			console.log(topLeft, size, this._mutantCanvas);
//
// 			this._mutantCanvas.style.top = topLeft.y + "px";
// 			this._mutantCanvas.style.height = size.y + "px";
// 			this._mutantCanvas.style.left = topLeft.x + "px";
// 			this._mutantCanvas.style.width = size.x + "px";
		}
	},

	// 🍂method setOpacity(opacity: Number): this
	// Sets the opacity of the MapkitMutant.
	setOpacity: function (opacity) {
		this.options.opacity = opacity;
        this._updateOpacity();
		return this;
	},


    _updateOpacity: function () {
        if (this._mutantCanvas) {
            L.DomUtil.setOpacity(this._mutantCanvas, this.options.opacity);
        }
	},

    _onRegionChangeStart: function(ev) {
//         console.timeStamp('region-change-start');
    },


	setElementSize: function(e, size) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},
});

L.mapkitMutant = function mapkitMutant(options) {
	return new L.MapkitMutant(options);
};



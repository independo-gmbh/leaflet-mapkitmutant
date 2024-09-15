const _defaultMapkitOptions = {
	/**
	 * A Boolean value that determines whether the map displays a control that lets users pan the map.
	 */
	showsUserLocationControl: false,

	/**
	 * A feature visibility setting that determines when the compass is visible.
	 * @default 'hidden'
	 */
	showsCompass: "hidden",

	/**
	 * A Boolean value that determines whether to display a control that lets users choose the map type.
	 * @default false
	 */
	showsMapTypeControl: false,

	/**
	 *   MapKit JS map type. Valid values are:
	 *   * `mapkit.Map.MapTypes.Standard` - A street map that shows the position of all roads and some road names.
	 *   * `mapkit.Map.MapTypes.MutedStandard` - A street map where your data is emphasized over the underlying map details.
	 *   * `mapkit.Map.MapTypes.Hybrid` - A satellite image of the area with road and road name information layered on top.
	 *   * `mapkit.Map.MapTypes.Satellite` - A satellite image of the area.
	 *   @default `mapkit.Map.MapTypes.Standard`
	 */
	mapType: mapkit.Map.MapTypes.Standard,

	/**
	 * The map’s color scheme when displaying standard or muted standard map types.
	 * Valid values are:
	 * * "light" - A light color scheme.
	 * * "dark" - A dark color scheme.
	 */
	colorScheme: "light",

	/**
	 * A Boolean value that determines whether the user may rotate the map using the compass control or a rotate gesture.
	 * @default false
	 * @type {Boolean}
	 */
	isRotationEnabled: false,

	/**
	 * A feature visibility setting that determines when the map's scale is displayed.
	 */
	showsScale: "hidden",

	/**
	 * A Boolean value that determines whether to show the user's location on
	 * the map.
	 * @default false
	 */
	showsUserLocation: false,

	/**
	 * A Boolean value that determines whether to show the zoom control.
	 */
	showsZoomControl: false,
};

(L as any).MapkitMutant = L.Layer.extend({
	options: {
		/**
		 * @inheritDoc L.LayerOptions.minZoom
		 * @default 3
		 * @type {Number}
		 */
		minZoom: 3,

		/**
		 * @inheritDoc L.LayerOptions.maxZoom
		 * @default 23
		 * @type {Number}
		 */
		maxZoom: 23,

		/**
		 * Options to pass to MapKit JS, that can be used to customize the map.
		 */
		mapkitOptions: {},

		/**
		 *  An authorization callback function, as described in Apple's MapKit JS documentation (https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init).
		 *  @type {Function} authorizationCallback
		 *  @default null
		 */
		authorizationCallback: function () {},

		/**
		 * A language code, as described in Apple's MapKit JS documentation (https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init).
		 * By default, Mapkit will use the locale setting from the web browser.
		 * @type {String}
		 */
		language: undefined,

		/**
		 * The opacity of the MapkitMutant.
		 * @type {Number}
		 * @default 1.0
		 */
		opacity: 1,

		/**
		 * Whether to add a rectangle with the bounds of the mutant to the map.
		 * Only meant for debugging, most useful at low zoom levels.
		 * @type {Boolean}
		 */
		debugRectangle: false,
	},

	initialize: function (options: L.LayerOptions) {
		L.Util.setOptions(this, options);

		/// TODO: Add a this._mapkitPromise, just like GoogleMutant

		mapkit.init({
			authorizationCallback: this.options.authorizationCallback,
			language: this.options.language,
		});
	},

	onAdd: function (map) {
		this._map = map;

		this._initMutantContainer();

		this._initMutant();

		map.on("move zoom moveend zoomend", this._update, this);
		map.on("resize", this._resize, this);
		this._resize();
	},

	onRemove: function (map) {
		map._container.removeChild(this._mutantContainer);
		this._mutantContainer = undefined;
		map.off("move zoom moveend zoomend", this._update, this);
		map.off("resize", this._resize, this);
		this._mutant.removeEventListener(
			"region-change-end",
			this._onRegionChangeEnd,
			this
		);
		if (this._canvasOverlay) {
			this._canvasOverlay.remove();
		}
	},

	// Create the HTMLElement for the mutant map, and add it as a children
	// of the Leaflet Map container
	_initMutantContainer: function () {
		if (!this._mutantContainer) {
			this._mutantContainer = L.DomUtil.create("div", "leaflet-mapkit-mutant");
			this._mutantContainer.id =
				"_MutantContainer_" + L.Util.stamp(this._mutantContainer);
			this._mutantContainer.style.zIndex = "200"; //leaflet map pane at 400, controls at 1000
			this._mutantContainer.style.pointerEvents = "none";

			this._map.getContainer().appendChild(this._mutantContainer);
		}

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._mutantContainer, this._map.getSize());

		//this._attachObserver(this._mutantContainer);
	},

	// Create the mutant map inside the mutant container
	_initMutant: function () {
		if (!this._mutantContainer) return;
		const mapConfig = {
			..._defaultMapkitOptions,
			...this.options.mapkitOptions,
			visibleMapRect: this._leafletBoundsToMapkitRect(),
		};
		const map = new mapkit.Map(this._mutantContainer, mapConfig);
		this._mutant = map;
		map.addEventListener("region-change-end", this._onRegionChangeEnd, this);
		map.addEventListener("region-change-start", this._onRegionChangeStart, this);

		// 🍂event spawned
		// Fired when the mutant has been created.
		this.fire("spawned", { mapObject: map });

		// Call _update once, so that it can fetch the mutant's canvas and
		// create the L.ImageOverlay
		L.Util.requestAnimFrame(this._update, this);
	},

	// Fetches the map's current *projected* (EPSG:3857) bounds, and returns
	// an instance of mapkit.MapRect
	_leafletBoundsToMapkitRect: function () {
		const bounds = this._map.getPixelBounds();
		const scale = this._map.options.crs.scale(this._map.getZoom());
		const nw = bounds.getTopLeft().divideBy(scale);
		const se = bounds.getBottomRight().divideBy(scale);

		// Map those bounds into a [[0,0]..[1,1]] range
		const projectedBounds = L.bounds([nw, se]);

		const projectedCenter = projectedBounds.getCenter();
		const projectedSize = projectedBounds.getSize();

		return new mapkit.MapRect(
			projectedCenter.x - projectedSize.x / 2,
			projectedCenter.y - projectedSize.y / 2,
			projectedSize.x,
			projectedSize.y
		);
	},

	// Given an instance of mapkit.MapRect, returns an instance of L.LatLngBounds
	// This depends on the current map center, as to shift the bounds on
	// multiples of 360 in order to prevent artifacts when crossing the
	// antimeridian.
	_mapkitRectToLeafletBounds: function (rect) {
		// Ask MapkitJS to provide the lat-lng coords of the rect's corners
		var nw = new mapkit.MapPoint(rect.minX(), rect.maxY()).toCoordinate();
		var se = new mapkit.MapPoint(rect.maxX(), rect.minY()).toCoordinate();

		var lw = nw.longitude + Math.floor(rect.minX()) * 360;
		var le = se.longitude + Math.floor(rect.maxX()) * 360;

		var centerLng = this._map.getCenter().lng;

		// Shift the bounding box on the easting axis so it contains the map center
		if (centerLng < lw) {
			// Shift the whole thing to the west
			var offset = Math.floor((centerLng - lw) / 360) * 360;
			lw += offset;
			le += offset;
		} else if (centerLng > le) {
			// Shift the whole thing to the east
			var offset = Math.ceil((centerLng - le) / 360) * 360;
			lw += offset;
			le += offset;
		}

		return L.latLngBounds([
			L.latLng(nw.latitude, lw),
			L.latLng(se.latitude, le),
		]);
	},

	_update: function () {
		if (this._map && this._mutant) {
			this._mutant.setVisibleMapRectAnimated(
				this._leafletBoundsToMapkitRect(),
				false
			);
		}
	},

	_resize: function () {
		var size = this._map.getSize();
		if (
			this._mutantContainer.style.width === size.x &&
			this._mutantContainer.style.height === size.y
		)
			return;
		this.setElementSize(this._mutantContainer, size);
		if (!this._mutant) return;
	},

	_onRegionChangeEnd: function (ev) {
		// console.log(ev.target.region.toString());

		if (!this._mutantCanvas) {
			this._mutantCanvas =
				this._mutantContainer.querySelector("canvas.syrup-canvas");
		}

		if (this._map && this._mutantCanvas) {
			// Despite the event name and this method's name, fetch the mutant's
			// visible MapRect, not the mutant's region. It uses projected
			// coordinates (i.e. scaled EPSG:3957 coordinates). This prevents
			// latitude shift artifacts.
			var bounds = this._mapkitRectToLeafletBounds(
				this._mutant.visibleMapRect
			);

			// The mutant will take one frame to re-stitch its tiles, so
			// repositioning the mutant's overlay has to take place one frame
			// after the 'region-change-end' event, in order to avoid graphical
			// glitching.

			L.Util.cancelAnimFrame(this._requestedFrame);

			this._requestedFrame = L.Util.requestAnimFrame(function () {
				if (!this._canvasOverlay) {
					this._canvasOverlay = L.imageOverlay(null, bounds);

					// Hack the ImageOverlay's _image property so that it doesn't
					// create a HTMLImageElement
					var img = (this._canvasOverlay._image = L.DomUtil.create("div"));

					L.DomUtil.addClass(img, "leaflet-image-layer");
					L.DomUtil.addClass(img, "leaflet-zoom-animated");

					// Move the mutant's canvas out of its container, and into
					// the L.ImageOverlay's _image
					this._mutantCanvas.parentElement.removeChild(this._mutantCanvas);
					img.appendChild(this._mutantCanvas);

					this._canvasOverlay.addTo(this._map);
					this._updateOpacity();
				} else {
					this._canvasOverlay.setBounds(bounds);
				}
				this._mutantCanvas.style.width = "100%";
				this._mutantCanvas.style.height = "100%";
				this._mutantCanvas.style.position = "absolute";

				if (this.options.debugRectangle) {
					if (!this.rectangle) {
						this.rectangle = L.rectangle(bounds, {
							fill: false,
						}).addTo(this._map);
					} else {
						this.rectangle.setBounds(bounds);
					}
				}
			}, this);
		}
	},

	// 🍂method setOpacity(opacity: Number): this
	// Sets the opacity of the MapkitMutant.
	/**
	 * Sets the opacity of the MapkitMutant.
	 * @param opacity The new opacity value.
	 */
	setOpacity: function (opacity: number) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	_updateOpacity: function () {
		if (this._mutantCanvas) {
			L.DomUtil.setOpacity(this._mutantCanvas, this.options.opacity);
		}
	},

	_onRegionChangeStart: function (ev) {
		/// TODO: check if there's any use to this event handler, clean up
		//         console.timeStamp('region-change-start');
	},

	setElementSize: function (e, size) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},
});

(L as any).mapkitMutant = function mapkitMutant(options) {
	return new (L as any).MapkitMutant(options);
};

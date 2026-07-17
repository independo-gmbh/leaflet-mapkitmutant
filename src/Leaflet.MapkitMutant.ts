/**
 * Default options forwarded to the MapKit JS `mapkit.Map` constructor. These
 * are merged with (and can be overridden by) the layer's `mapkitOptions`.
 */
const _defaultMapkitOptions = {
	/** Whether the map displays a control that lets users pan the map. */
	showsUserLocationControl: false,

	/**
	 * Feature visibility setting that determines when the compass is visible.
	 * @defaultValue `mapkit.FeatureVisibility.Hidden`
	 */
	showsCompass: mapkit.FeatureVisibility.Hidden,

	/**
	 * Whether to display a control that lets users choose the map type.
	 * @defaultValue false
	 */
	showsMapTypeControl: false,

	/**
	 * MapKit JS map type. Valid values are:
	 * - `mapkit.Map.MapTypes.Standard` — a street map showing roads and some names.
	 * - `mapkit.Map.MapTypes.MutedStandard` — a street map with your data emphasized.
	 * - `mapkit.Map.MapTypes.Hybrid` — satellite imagery with roads layered on top.
	 * - `mapkit.Map.MapTypes.Satellite` — satellite imagery.
	 * @defaultValue `mapkit.Map.MapTypes.Standard`
	 */
	mapType: mapkit.Map.MapTypes.Standard,

	/**
	 * The map's color scheme when displaying standard or muted standard map
	 * types. Valid values are `"light"` and `"dark"`.
	 */
	colorScheme: "light",

	/**
	 * Whether the user may rotate the map using the compass control or a rotate
	 * gesture.
	 * @defaultValue false
	 */
	isRotationEnabled: false,

	/** Feature visibility setting that determines when the map's scale is shown. */
	showsScale: mapkit.FeatureVisibility.Hidden,

	/**
	 * Whether to show the user's location on the map.
	 * @defaultValue false
	 */
	showsUserLocation: false,

	/** Whether to show the zoom control. */
	showsZoomControl: false,
};

(L as any).MapkitMutant = L.Layer.extend({
	options: {
		/**
		 * Minimum zoom level at which the MapKit basemap is displayed.
		 * @defaultValue 3
		 */
		minZoom: 3,

		/**
		 * Maximum zoom level at which the MapKit basemap is displayed.
		 * @defaultValue 23
		 */
		maxZoom: 23,

		/** Options forwarded to MapKit JS to customize the map. */
		mapkitOptions: {},

		/**
		 * MapKit JS authorization callback. Invoke the provided `done` callback
		 * with a valid MapKit JS token.
		 * @see https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init
		 */
		authorizationCallback: function () {},

		/**
		 * A BCP-47 language code. Defaults to the browser's locale when omitted.
		 * @see https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init
		 */
		language: undefined,

		/**
		 * The opacity of the MapkitMutant, from 0 to 1.
		 * @defaultValue 1
		 */
		opacity: 1,

		/**
		 * Whether to draw a rectangle around the mutant's bounds. Intended for
		 * debugging, most useful at low zoom levels.
		 * @defaultValue false
		 */
		debugRectangle: false,
	},

	/**
	 * Initializes MapKit JS with the configured authorization callback and
	 * language.
	 */
	initialize: function (options: L.LayerOptions) {
		L.Util.setOptions(this, options);

		// TODO: add a this._mapkitPromise, just like GoogleMutant.
		mapkit.init({
			authorizationCallback: this.options.authorizationCallback,
			language: this.options.language,
		});
	},

	onAdd: function (map: L.Map) {
		this._map = map;

		this._initMutantContainer();

		this._initMutant();

		map.on("move zoom moveend zoomend", this._update, this);
		map.on("resize", this._resize, this);
		this._resize();
	},

	onRemove: function (map: L.Map) {
		(map as any)._container.removeChild(this._mutantContainer);
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

		// Drop references to the torn-down mutant so a later onAdd() rebuilds
		// from scratch instead of reusing a detached canvas/overlay.
		this._mutant = undefined;
		this._mutantCanvas = undefined;
		this._canvasOverlay = undefined;
	},

	/**
	 * Creates the container element for the mutant map and appends it to the
	 * Leaflet map container.
	 */
	_initMutantContainer: function () {
		if (!this._mutantContainer) {
			this._mutantContainer = L.DomUtil.create("div", "leaflet-mapkit-mutant");
			this._mutantContainer.id =
				"_MutantContainer_" + L.Util.stamp(this._mutantContainer);
			this._mutantContainer.style.zIndex = "200"; // leaflet map pane at 400, controls at 1000
			this._mutantContainer.style.pointerEvents = "none";

			this._map.getContainer().appendChild(this._mutantContainer);
		}

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._mutantContainer, this._map.getSize());
	},

	/** Creates the MapKit map inside the mutant container. */
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

		// Fires the `spawned` event once the mutant map has been created.
		this.fire("spawned", { mapObject: map });

		// Call _update once so it can fetch the mutant's canvas and create the
		// L.ImageOverlay.
		L.Util.requestAnimFrame(this._update, this);
	},

	/**
	 * Fetches the map's current projected (EPSG:3857) bounds and returns them as
	 * a `mapkit.MapRect`.
	 * @returns The current viewport as a MapKit MapRect.
	 */
	_leafletBoundsToMapkitRect: function () {
		const bounds = this._map.getPixelBounds();
		const scale = this._map.options.crs.scale(this._map.getZoom());

		const nw = bounds.getTopLeft().divideBy(scale);
		const se = bounds.getBottomRight().divideBy(scale);

		// Map those bounds into a [[0,0]..[1,1]] range.
		const projectedBounds = L.bounds([nw, se]);

		const projectedCenter = projectedBounds.getCenter();
		const projectedSize = projectedBounds.getSize();

		if (!this._mapRect) {
			this._mapRect = new mapkit.MapRect(
				projectedCenter.x - projectedSize.x / 2,
				projectedCenter.y - projectedSize.y / 2,
				projectedSize.x,
				projectedSize.y
			);
		} else {
			this._mapRect.origin.x = projectedCenter.x - projectedSize.x / 2;
			this._mapRect.origin.y = projectedCenter.y - projectedSize.y / 2;
			this._mapRect.size.width = projectedSize.x;
			this._mapRect.size.height = projectedSize.y;
		}
		return this._mapRect;
	},

	/**
	 * Converts a `mapkit.MapRect` into `L.LatLngBounds`. The result is shifted by
	 * multiples of 360° so it contains the current map center, which prevents
	 * artifacts when crossing the antimeridian.
	 * @param rect - The MapKit MapRect to convert.
	 * @returns The equivalent Leaflet bounds.
	 */
	_mapkitRectToLeafletBounds: function (rect: mapkit.MapRect) {
		let offset;
		// Ask MapkitJS to provide the lat-lng coords of the rect's corners.
		const nw = new mapkit.MapPoint(rect.minX(), rect.maxY()).toCoordinate();
		const se = new mapkit.MapPoint(rect.maxX(), rect.minY()).toCoordinate();

		let lw = nw.longitude + Math.floor(rect.minX()) * 360;
		let le = se.longitude + Math.floor(rect.maxX()) * 360;

		const centerLng = this._map.getCenter().lng;

		// Shift the bounding box on the easting axis so it contains the map center.
		if (centerLng < lw) {
			// Shift the whole thing to the west.
			offset = Math.floor((centerLng - lw) / 360) * 360;
			lw += offset;
			le += offset;
		} else if (centerLng > le) {
			// Shift the whole thing to the east.
			offset = Math.ceil((centerLng - le) / 360) * 360;
			lw += offset;
			le += offset;
		}

		return L.latLngBounds([
			L.latLng(nw.latitude, lw),
			L.latLng(se.latitude, le),
		]);
	},

	/** Repositions the mutant to match the Leaflet map's current view. */
	_update: function () {
		if (this._map && this._mutant) {
			this._mutant.setVisibleMapRectAnimated(
				this._leafletBoundsToMapkitRect(),
				false
			);
		}
	},

	/** Resizes the mutant container to match the Leaflet map size. */
	_resize: function () {
		const size = this._map.getSize();
		const container = this._mutantContainer;
		if (
			parseInt(container.style.width, 10) === size.x &&
			parseInt(container.style.height, 10) === size.y
		)
			return;
		this.setElementSize(container, size);
	},

	/**
	 * Handles MapKit's `region-change-end` event: repositions (and, on first
	 * run, builds) the `L.ImageOverlay` wrapping the mutant's canvas.
	 */
	_onRegionChangeEnd: function () {
		if (!this._mutantCanvas) {
			this._mutantCanvas =
				this._mutantContainer.querySelector("canvas.syrup-canvas");
		}

		if (this._map && this._mutantCanvas) {
			// Despite the event name and this method's name, fetch the mutant's
			// visible MapRect, not the mutant's region. It uses projected
			// coordinates (i.e. scaled EPSG:3857 coordinates). This prevents
			// latitude shift artifacts.
			const bounds = this._mapkitRectToLeafletBounds(
				this._mutant.visibleMapRect
			);

			// The mutant takes one frame to re-stitch its tiles, so repositioning
			// the overlay has to happen one frame after the 'region-change-end'
			// event to avoid graphical glitching.
			L.Util.cancelAnimFrame(this._requestedFrame);

			this._requestedFrame = L.Util.requestAnimFrame(function (this: any) {
				if (!this._canvasOverlay) {
					this._canvasOverlay = L.imageOverlay(null as any, bounds);

					// Hack the ImageOverlay's _image property so that it doesn't
					// create a HTMLImageElement.
					const img = (this._canvasOverlay._image =
						L.DomUtil.create("div"));

					L.DomUtil.addClass(img, "leaflet-image-layer");
					L.DomUtil.addClass(img, "leaflet-zoom-animated");

					// Move the mutant's canvas out of its container and into the
					// L.ImageOverlay's _image.
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

	/**
	 * Sets the opacity of the MapkitMutant.
	 * @param opacity - The new opacity value, from 0 to 1.
	 * @returns This layer, for chaining.
	 */
	setOpacity: function (opacity: number) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	/** Applies the current opacity option to the mutant's canvas. */
	_updateOpacity: function () {
		if (this._mutantCanvas) {
			L.DomUtil.setOpacity(this._mutantCanvas, this.options.opacity);
		}
	},

	/** Sets the pixel size of an element from an `L.Point`. */
	setElementSize: function (e: HTMLElement, size: L.Point) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},
});

/**
 * Creates a {@link MapkitMutant} layer.
 * @param options - Layer and MapKit JS options.
 */
(L as any).mapkitMutant = function mapkitMutant(options: any) {
	return new (L as any).MapkitMutant(options);
};

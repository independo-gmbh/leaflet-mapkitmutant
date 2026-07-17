import * as L from "leaflet";
import { defaultMapkitOptions } from "./defaultMapkitOptions";
import { leafletBoundsToMapkitRect, mapkitRectToLeafletBounds } from "./projection";

// Leaflet's typings model `L.Layer` with fixed method signatures and no index
// signature; this plugin's dynamic `this._mutant`/`this._map` state doesn't fit
// them. Extend an `any`-typed base so the internals stay as loosely typed as the
// original L.Layer.extend() version, while keeping method parameter types.
const LayerBase = L.Layer as any;

/**
 * A Leaflet layer that renders Apple MapKit JS tiles as a basemap by wrapping a
 * hidden `mapkit.Map`'s canvas in an `L.ImageOverlay`.
 */
export class MapkitMutant extends LayerBase {
	/**
	 * Initializes MapKit JS with the configured authorization callback and
	 * language. Called by Leaflet's constructor.
	 */
	initialize(options: L.LayerOptions) {
		L.Util.setOptions(this, options);

		// TODO: add a this._mapkitPromise, just like GoogleMutant.
		mapkit.init({
			authorizationCallback: this.options.authorizationCallback,
			language: this.options.language,
		});
	}

	onAdd(map: L.Map) {
		this._map = map;

		this._initMutantContainer();

		this._initMutant();

		map.on("move zoom moveend zoomend", this._update, this);
		map.on("resize", this._resize, this);
		this._resize();
	}

	onRemove(map: L.Map) {
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
	}

	/**
	 * Creates the container element for the mutant map and appends it to the
	 * Leaflet map container.
	 */
	_initMutantContainer() {
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
	}

	/** Creates the MapKit map inside the mutant container. */
	_initMutant() {
		if (!this._mutantContainer) return;
		const mapConfig = {
			...defaultMapkitOptions,
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
	}

	/**
	 * Fetches the map's current projected (EPSG:3857) bounds as a
	 * `mapkit.MapRect`, reusing this instance's cached rect.
	 * @returns The current viewport as a MapKit MapRect.
	 */
	_leafletBoundsToMapkitRect() {
		this._mapRect = leafletBoundsToMapkitRect(this._map, this._mapRect);
		return this._mapRect;
	}

	/**
	 * Converts a `mapkit.MapRect` into `L.LatLngBounds`, shifted to contain the
	 * current map center (see {@link mapkitRectToLeafletBounds}).
	 * @param rect - The MapKit MapRect to convert.
	 * @returns The equivalent Leaflet bounds.
	 */
	_mapkitRectToLeafletBounds(rect: mapkit.MapRect) {
		return mapkitRectToLeafletBounds(rect, this._map.getCenter().lng);
	}

	/** Repositions the mutant to match the Leaflet map's current view. */
	_update() {
		if (this._map && this._mutant) {
			this._mutant.setVisibleMapRectAnimated(
				this._leafletBoundsToMapkitRect(),
				false
			);
		}
	}

	/** Resizes the mutant container to match the Leaflet map size. */
	_resize() {
		const size = this._map.getSize();
		const container = this._mutantContainer;
		if (
			parseInt(container.style.width, 10) === size.x &&
			parseInt(container.style.height, 10) === size.y
		)
			return;
		this.setElementSize(container, size);
	}

	/**
	 * Handles MapKit's `region-change-end` event: repositions (and, on first
	 * run, builds) the `L.ImageOverlay` wrapping the mutant's canvas.
	 */
	_onRegionChangeEnd() {
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
	}

	/**
	 * Sets the opacity of the MapkitMutant.
	 * @param opacity - The new opacity value, from 0 to 1.
	 * @returns This layer, for chaining.
	 */
	setOpacity(opacity: number) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	}

	/** Applies the current opacity option to the mutant's canvas. */
	_updateOpacity() {
		if (this._mutantCanvas) {
			L.DomUtil.setOpacity(this._mutantCanvas, this.options.opacity);
		}
	}

	/** Sets the pixel size of an element from an `L.Point`. */
	setElementSize(e: HTMLElement, size: L.Point) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	}
}

/**
 * Default layer options. Assigned to the prototype (merged over L.Layer's
 * options) the way Leaflet's `L.Layer.extend({ options })` would, so
 * `L.Util.setOptions` merges user options over these.
 */
(MapkitMutant.prototype as any).options = {
	...((L.Layer.prototype as any).options ?? {}),

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
	 * MapKit JS authorization callback. Invoke the provided `done` callback with
	 * a valid MapKit JS token.
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
};

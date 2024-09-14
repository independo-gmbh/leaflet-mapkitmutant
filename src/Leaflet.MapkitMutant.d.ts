import L from "leaflet";

export interface MapkitMutantOptions extends L.LayerOptions {
	/**
	 * @inheritDoc L.LayerOptions
	 */
	minZoom: number;
	/**
	 * @inheritDoc L.LayerOptions
	 */
	maxZoom: number;

	/**
	 *   MapKit JS map type. Valid values are strings 'standard' (default),
	 *   'satellite' or 'hybrid'.
	 *   @default 'standard'
	 *   @type {String}
	 */
	type: "standard" | "satellite" | "hybrid" | "muted";

	/**
	 *  An authorization callback function, as described in Apple's MapKit JS documentation (https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init).
	 *  @type {Function} authorizationCallback
	 *  @default null
	 */
	authorizationCallback: () => void;

	/**
	 * A language code, as described in Apple's MapKit JS documentation (https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init).
	 * By default, Mapkit will use the locale setting from the web browser.
	 * @type {String}
	 */
	language?: string;

	/**
	 * The opacity of the MapkitMutant.
	 * @type {Number}
	 * @default 1.0
	 */
	opacity: number;
}

declare namespace leaflet {
	export class MapkitMutant extends L.Layer {
		/**
		 * @inheritDoc L.Layer.onAdd
		 * @param map
		 */
		onAdd(map: L.Map): this;

		/**
		 * @inheritDoc L.Layer.onRemove
		 * @param map
		 */
		onRemove(map: L.Map): this;

		setOpacity(opacity: number): this;

		private _initMutantContainer(): void;

		private _initMutant(): void;

		private _leafletBoundsToMapkitRect(): mapkit.MapRect;

		private _mapkitRectToLeafletBounds(rect: mapkit.MapRect): L.LatLngBounds;

		private _update(): void;

		private _resize(): void;

		private _onRegionChangeEnd(): void;

		private _onRegionChangeStart(): void;

		private _updateOpacity(): void;

		private setElementSize(e: HTMLElement, size: L.Point): void;
	}
}

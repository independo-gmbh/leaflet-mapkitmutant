import * as L from "leaflet";

/**
 * Type definitions for the Leaflet.MapkitMutant plugin.
 *
 * The plugin augments Leaflet's `L` namespace at runtime, so these declarations
 * augment the `leaflet` module — importing the package makes `L.mapkitMutant`,
 * `L.MapkitMutant` and `L.MapkitMutantOptions` available to TypeScript.
 */
declare module "leaflet" {
	interface MapkitMutantOptions extends L.LayerOptions {
		/**
		 * Minimum zoom level at which the MapKit basemap is displayed.
		 * @defaultValue 3
		 */
		minZoom?: number;

		/**
		 * Maximum zoom level at which the MapKit basemap is displayed.
		 * @defaultValue 23
		 */
		maxZoom?: number;

		/**
		 * Options passed verbatim to the MapKit JS `mapkit.Map` constructor,
		 * such as `mapType`, `colorScheme` or `pointOfInterestFilter`.
		 * @see https://developer.apple.com/documentation/mapkitjs/mapconstructoroptions
		 */
		mapkitOptions?: Record<string, unknown>;

		/**
		 * MapKit JS authorization callback. Invoke the provided `done` callback
		 * with a valid MapKit JS token.
		 * @see https://developer.apple.com/documentation/mapkitjs/mapkit/2974045-init
		 */
		authorizationCallback?: (done: (token: string) => void) => void;

		/**
		 * A BCP-47 language code. Defaults to the browser's locale when omitted.
		 */
		language?: string;

		/**
		 * Opacity of the MapkitMutant layer, from 0 to 1.
		 * @defaultValue 1
		 */
		opacity?: number;

		/**
		 * Whether to draw a rectangle around the mutant's bounds. Intended for
		 * debugging, most useful at low zoom levels.
		 * @defaultValue false
		 */
		debugRectangle?: boolean;
	}

	/**
	 * A Leaflet layer that renders Apple MapKit JS tiles as a basemap.
	 */
	class MapkitMutant extends L.Layer {
		constructor(options?: MapkitMutantOptions);

		/**
		 * Sets the opacity of the MapkitMutant.
		 * @param opacity - The new opacity value, from 0 to 1.
		 */
		setOpacity(opacity: number): this;
	}

	/**
	 * Creates a {@link MapkitMutant} layer.
	 * @param options - Layer and MapKit JS options.
	 */
	function mapkitMutant(options?: MapkitMutantOptions): MapkitMutant;
}

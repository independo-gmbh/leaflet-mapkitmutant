/**
 * Default options forwarded to the MapKit JS `mapkit.Map` constructor. These
 * are merged with (and can be overridden by) the layer's `mapkitOptions`.
 */
export const defaultMapkitOptions = {
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

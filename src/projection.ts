import * as L from "leaflet";

/**
 * Coordinate conversions between Leaflet and MapKit JS.
 *
 * These are pure functions of their arguments (and the ambient `L` / `mapkit`
 * globals); they hold no state, which makes the projection math independently
 * testable.
 */

/**
 * Fetches a Leaflet map's current projected (EPSG:3857) bounds and returns them
 * as a `mapkit.MapRect`.
 *
 * @param map - The Leaflet map to read the viewport from.
 * @param prevRect - An existing MapRect to mutate in place, or `null` to
 *   allocate a new one. Reusing the instance avoids per-frame allocations.
 * @returns The current viewport as a MapKit MapRect.
 */
export function leafletBoundsToMapkitRect(
	map: any,
	prevRect: mapkit.MapRect | null
): mapkit.MapRect {
	const bounds = map.getPixelBounds();
	const scale = map.options.crs.scale(map.getZoom());

	const nw = bounds.getTopLeft().divideBy(scale);
	const se = bounds.getBottomRight().divideBy(scale);

	// Map those bounds into a [[0,0]..[1,1]] range.
	const projectedBounds = L.bounds([nw, se]);

	const projectedCenter = projectedBounds.getCenter();
	const projectedSize = projectedBounds.getSize();

	if (!prevRect) {
		return new mapkit.MapRect(
			projectedCenter.x - projectedSize.x / 2,
			projectedCenter.y - projectedSize.y / 2,
			projectedSize.x,
			projectedSize.y
		);
	}

	prevRect.origin.x = projectedCenter.x - projectedSize.x / 2;
	prevRect.origin.y = projectedCenter.y - projectedSize.y / 2;
	prevRect.size.width = projectedSize.x;
	prevRect.size.height = projectedSize.y;
	return prevRect;
}

/**
 * Converts a `mapkit.MapRect` into `L.LatLngBounds`. The result is shifted by
 * multiples of 360° so it contains `centerLng`, which prevents artifacts when
 * crossing the antimeridian.
 *
 * @param rect - The MapKit MapRect to convert.
 * @param centerLng - The current map center longitude, used to pick the 360°
 *   window the bounds should fall in.
 * @returns The equivalent Leaflet bounds.
 */
export function mapkitRectToLeafletBounds(
	rect: mapkit.MapRect,
	centerLng: number
): L.LatLngBounds {
	let offset;
	// Ask MapkitJS to provide the lat-lng coords of the rect's corners.
	const nw = new mapkit.MapPoint(rect.minX(), rect.maxY()).toCoordinate();
	const se = new mapkit.MapPoint(rect.maxX(), rect.minY()).toCoordinate();

	let lw = nw.longitude + Math.floor(rect.minX()) * 360;
	let le = se.longitude + Math.floor(rect.maxX()) * 360;

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

	return L.latLngBounds([L.latLng(nw.latitude, lw), L.latLng(se.latitude, le)]);
}

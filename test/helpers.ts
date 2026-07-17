import * as LeafletNS from "leaflet";

// Vite resolves Leaflet to its ESM build, whose namespace object is sealed.
// The plugin augments the global `L` (adds `L.MapkitMutant`), so hand it a
// mutable copy that still shares Leaflet's real classes and utilities.
const source: any = (LeafletNS as any).default ?? LeafletNS;
const L: any = { ...source };

// ---------------------------------------------------------------------------
// Minimal MapKit JS stub.
//
// The plugin references the `mapkit` global both at module-eval time (default
// options) and at runtime (creating the map, coordinate math). None of that
// talks to Apple's servers here — we record what the plugin does to the map so
// tests can assert on it.
// ---------------------------------------------------------------------------

export class MapRectStub {
	origin: { x: number; y: number };
	size: { width: number; height: number };

	constructor(x: number, y: number, width: number, height: number) {
		this.origin = { x, y };
		this.size = { width, height };
	}

	minX() {
		return this.origin.x;
	}
	maxX() {
		return this.origin.x + this.size.width;
	}
	minY() {
		return this.origin.y;
	}
	maxY() {
		return this.origin.y + this.size.height;
	}
}

export class MapPointStub {
	constructor(
		public x: number,
		public y: number
	) {}

	// Not a real EPSG:3857 -> lng/lat projection; enough for structural tests.
	toCoordinate() {
		return { latitude: this.y, longitude: this.x };
	}
}

export class MapStub {
	added: Array<[string, unknown]> = [];
	removed: Array<[string, unknown]> = [];
	visibleMapRect: unknown = null;

	addEventListener(type: string, handler: unknown) {
		this.added.push([type, handler]);
	}
	removeEventListener(type: string, handler: unknown) {
		this.removed.push([type, handler]);
	}
	setVisibleMapRectAnimated(rect: unknown) {
		this.visibleMapRect = rect;
	}
}

function makeMapkitStub() {
	function MapCtor(this: MapStub) {
		return new MapStub();
	}
	(MapCtor as any).MapTypes = { Standard: "standard" };

	return {
		init: () => {},
		Map: MapCtor,
		MapRect: MapRectStub,
		MapPoint: MapPointStub,
		FeatureVisibility: { Hidden: "hidden", Visible: "visible" },
		PointOfInterestFilter: {},
	};
}

// Install globals BEFORE importing the plugin (it reads `mapkit` at eval time),
// then load the plugin so it augments the global `L`.
(globalThis as any).L = L;
(globalThis as any).mapkit = makeMapkitStub();

await import("../src/Leaflet.MapkitMutant.ts");

// The plugin schedules async frame callbacks; make them deterministic no-ops so
// tests don't race against requestAnimationFrame.
L.Util.requestAnimFrame = (() => 0) as unknown as typeof L.Util.requestAnimFrame;
L.Util.cancelAnimFrame = (() => {}) as unknown as typeof L.Util.cancelAnimFrame;

export { L };

// A typed handle to the plugin's factory / class living on the global L.
export const mapkitMutant = (options?: unknown): any =>
	(L as any).mapkitMutant(options);
export const MapkitMutant = (): any => (L as any).MapkitMutant;

/**
 * Build a stand-in for an L.Map exposing exactly the methods the plugin calls.
 * `px` is the map's pixel bounds (top-left, bottom-right); `scale` is the CRS
 * scale at the current zoom. These drive `_leafletBoundsToMapkitRect`.
 */
export function makeMapStub(
	opts: {
		px?: [[number, number], [number, number]];
		scale?: number;
		zoom?: number;
		size?: [number, number];
		center?: [number, number];
	} = {}
) {
	const container = document.createElement("div");
	const px = opts.px ?? [
		[256, 256],
		[1280, 1024],
	];
	const size = opts.size ?? [1024, 768];
	const center = opts.center ?? [0, 0];
	return {
		_container: container,
		getContainer: () => container,
		getSize: () => L.point(size[0], size[1]),
		getZoom: () => opts.zoom ?? 5,
		getCenter: () => L.latLng(center[0], center[1]),
		getPixelBounds: () => L.bounds(L.point(px[0]), L.point(px[1])),
		options: { crs: { scale: () => opts.scale ?? 256 } },
		on: () => {},
		off: () => {},
	};
}

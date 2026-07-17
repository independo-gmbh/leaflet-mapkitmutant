import { MapkitMutant } from "./MapkitMutant";

// Register the plugin on the page's global Leaflet (`L`). Leaflet is loaded via
// a <script> tag and resolved as the global at runtime (see tsup.config.ts), so
// we augment `globalThis.L` rather than the read-only imported namespace.
const runtimeL = (globalThis as any).L;

runtimeL.MapkitMutant = MapkitMutant;

/**
 * Creates a {@link MapkitMutant} layer.
 * @param options - Layer and MapKit JS options.
 */
runtimeL.mapkitMutant = function mapkitMutant(options?: unknown) {
	// Leaflet constructs via `initialize`; the base is `any`-typed, so cast to
	// reach the options-taking constructor.
	return new (MapkitMutant as any)(options);
};

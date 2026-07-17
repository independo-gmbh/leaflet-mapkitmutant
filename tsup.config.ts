import { defineConfig, type Options } from "tsup";

/**
 * Resolve `import ... from "leaflet"` to the page's global `L` instead of
 * bundling Leaflet. Leaflet is a peer dependency loaded via a <script> tag, so
 * the plugin must share that single instance (and not ship its own copy).
 */
const leafletAsGlobal: NonNullable<Options["esbuildPlugins"]>[number] = {
	name: "leaflet-as-global",
	setup(build) {
		build.onResolve({ filter: /^leaflet$/ }, () => ({
			path: "leaflet",
			namespace: "leaflet-global",
		}));
		build.onLoad({ filter: /.*/, namespace: "leaflet-global" }, () => ({
			contents: "module.exports = globalThis.L;",
			loader: "js",
		}));
	},
};

export default defineConfig({
	// Object form pins the output basename to Leaflet.MapkitMutant.js (the public
	// unpkg URL) even though the entry module is index.ts.
	entry: { "Leaflet.MapkitMutant": "src/index.ts" },
	outDir: "dist",
	platform: "browser",
	format: ["iife"],
	// Keep the historical filename (dist/Leaflet.MapkitMutant.js). The public
	// unpkg/`main` URL points here, so tsup must not add a `.global.js` suffix.
	outExtension: () => ({ js: ".js" }),
	minify: true,
	sourcemap: true,
	clean: true,
	esbuildPlugins: [leafletAsGlobal],
	// `mapkit` is referenced as an ambient global (also loaded via <script>).
	// Declarations are hand-authored in src/*.d.ts and copied in the build script,
	// so tsup does not generate them.
	dts: false,
});

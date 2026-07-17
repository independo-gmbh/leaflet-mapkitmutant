import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/Leaflet.MapkitMutant.ts"],
	outDir: "dist",
	platform: "browser",
	format: ["iife"],
	// Keep the historical filename (dist/Leaflet.MapkitMutant.js). The public
	// unpkg/`main` URL points here, so tsup must not add a `.global.js` suffix.
	outExtension: () => ({ js: ".js" }),
	minify: true,
	sourcemap: true,
	clean: true,
	// The source references global `L` and `mapkit` (loaded via <script>). It has
	// no imports, so there is nothing to bundle — this just transpiles + minifies.
	// Declarations are hand-authored in src/*.d.ts and copied in the build script,
	// so tsup does not generate them.
	dts: false,
});

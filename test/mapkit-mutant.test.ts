import { describe, it, expect } from "vitest";
import { L, mapkitMutant, makeMapStub } from "./helpers";

describe("MapkitMutant public API", () => {
	it("registers the L.mapkitMutant factory and L.MapkitMutant class", () => {
		expect(typeof (L as any).mapkitMutant).toBe("function");
		expect(typeof (L as any).MapkitMutant).toBe("function");
	});

	it("factory returns a MapkitMutant that is an L.Layer", () => {
		const layer = mapkitMutant();
		expect(layer).toBeInstanceOf((L as any).MapkitMutant);
		expect(layer).toBeInstanceOf(L.Layer);
	});

	it("exposes the documented default options", () => {
		const layer = mapkitMutant();
		expect(layer.options.minZoom).toBe(3);
		expect(layer.options.maxZoom).toBe(23);
		expect(layer.options.opacity).toBe(1);
		expect(layer.options.debugRectangle).toBe(false);
	});

	it("setOpacity updates the option and is chainable", () => {
		const layer = mapkitMutant();
		expect(layer.setOpacity(0.25)).toBe(layer);
		expect(layer.options.opacity).toBe(0.25);
	});
});

describe("_leafletBoundsToMapkitRect", () => {
	it("projects the map's pixel bounds into a MapKit MapRect", () => {
		const layer = mapkitMutant();
		layer._map = makeMapStub({
			px: [
				[256, 256],
				[1280, 1024],
			],
			scale: 256,
		});

		const rect = layer._leafletBoundsToMapkitRect();

		// nw = (1,1), se = (5,4) -> center (3, 2.5), size (4, 3)
		expect(rect.origin.x).toBeCloseTo(1);
		expect(rect.origin.y).toBeCloseTo(1);
		expect(rect.size.width).toBeCloseTo(4);
		expect(rect.size.height).toBeCloseTo(3);
	});
});

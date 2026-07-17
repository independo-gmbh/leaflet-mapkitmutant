import { describe, it, expect, vi } from "vitest";
import { L, mapkitMutant, makeMapStub } from "./helpers";

describe("per-instance state", () => {
	it("does not share its cached MapRect across instances", () => {
		const a = mapkitMutant();
		const b = mapkitMutant();
		// Distinct pixel bounds -> distinct projected rects (origin.x 1 vs 10).
		a._map = makeMapStub({
			px: [
				[256, 256],
				[1280, 1024],
			],
			scale: 256,
		});
		b._map = makeMapStub({
			px: [
				[2560, 256],
				[3584, 1024],
			],
			scale: 256,
		});

		const rectA = a._leafletBoundsToMapkitRect();
		const xA = rectA.origin.x;
		const rectB = b._leafletBoundsToMapkitRect();

		expect(rectB.origin.x).not.toBe(xA); // sanity: the two maps differ
		expect(rectA).not.toBe(rectB); // must be separate objects
		expect(rectA.origin.x).toBe(xA); // A's rect untouched by B
	});
});

describe("listener lifecycle", () => {
	it("removes every MapKit listener it registered when removed", () => {
		const layer = mapkitMutant();
		const map = makeMapStub();
		layer.onAdd(map);
		const mutant = layer._mutant;

		layer.onRemove(map);

		expect(mutant.added.length).toBeGreaterThan(0);
		for (const [type, handler] of mutant.added) {
			expect(mutant.removed).toContainEqual([type, handler]);
		}
	});
});

describe("re-adding a removed layer", () => {
	it("clears mutant state on remove and rebuilds it on re-add", () => {
		const layer = mapkitMutant();
		const map = makeMapStub();
		layer.onAdd(map);
		const firstMutant = layer._mutant;
		// Simulate the canvas/overlay the layer acquires once tiles render.
		layer._mutantCanvas = document.createElement("canvas");
		layer._canvasOverlay = { remove: () => {} };

		layer.onRemove(map);

		expect(layer._mutant).toBeUndefined();
		expect(layer._mutantCanvas).toBeUndefined();
		expect(layer._canvasOverlay).toBeUndefined();

		layer.onAdd(map); // must build a fresh mutant, not reuse the stale one
		expect(layer._mutant).not.toBe(firstMutant);
	});
});

describe("_resize", () => {
	it("skips resizing the container when the map size is unchanged", () => {
		const layer = mapkitMutant();
		const map = makeMapStub({ size: [640, 480] });
		layer.onAdd(map); // initial layout runs _resize once

		const spy = vi.spyOn(layer, "setElementSize");
		layer._resize(); // same size -> should be a no-op
		expect(spy).not.toHaveBeenCalled();

		map.getSize = () => L.point(800, 600);
		layer._resize(); // changed size -> resizes exactly once
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

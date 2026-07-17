import { describe, it, expect, vi } from "vitest";
import { L, MapRectStub, mapkitMutant, makeMapStub } from "./helpers";

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

describe("viewport projection (_leafletBoundsToMapkitRect)", () => {
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

	it("caches the MapRect per instance rather than sharing one globally", () => {
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

describe("layer lifecycle (onAdd / onRemove)", () => {
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

	it("cancels and ignores a queued region-change frame after remove", () => {
		const layer = mapkitMutant();
		const map = makeMapStub();
		layer.onAdd(map);

		const canvas = document.createElement("canvas");
		canvas.className = "syrup-canvas";
		layer._mutantContainer.appendChild(canvas);
		layer._mutant.visibleMapRect = new MapRectStub(0, 0, 1, 1);

		let queuedFrame:
			| {
					callback: FrameRequestCallback;
					context: unknown;
			  }
			| undefined;
		const requestAnimFrame = vi
			.spyOn(L.Util, "requestAnimFrame")
			.mockImplementation(((cb: FrameRequestCallback, context: unknown) => {
				queuedFrame = { callback: cb, context };
				return 123;
			}) as typeof L.Util.requestAnimFrame);
		const cancelAnimFrame = vi
			.spyOn(L.Util, "cancelAnimFrame")
			.mockImplementation(() => {});

		layer._onRegionChangeEnd();
		expect(queuedFrame?.callback).toBeTypeOf("function");

		layer.onRemove(map);

		expect(cancelAnimFrame).toHaveBeenCalledWith(123);
		expect(() =>
			queuedFrame?.callback.call(queuedFrame?.context, 0)
		).not.toThrow();
		expect(layer._canvasOverlay).toBeUndefined();

		requestAnimFrame.mockRestore();
		cancelAnimFrame.mockRestore();
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

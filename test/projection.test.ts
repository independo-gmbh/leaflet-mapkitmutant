import { describe, it, expect } from "vitest";
import { makeMapStub, MapRectStub } from "./helpers";
import {
	leafletBoundsToMapkitRect,
	mapkitRectToLeafletBounds,
} from "../src/projection";

describe("leafletBoundsToMapkitRect", () => {
	it("projects the map's pixel bounds into a MapRect", () => {
		const map = makeMapStub({
			px: [
				[256, 256],
				[1280, 1024],
			],
			scale: 256,
		});

		const rect = leafletBoundsToMapkitRect(map, null);

		// nw = (1,1), se = (5,4) -> center (3, 2.5), size (4, 3)
		expect(rect.origin.x).toBeCloseTo(1);
		expect(rect.origin.y).toBeCloseTo(1);
		expect(rect.size.width).toBeCloseTo(4);
		expect(rect.size.height).toBeCloseTo(3);
	});

	it("reuses the previous MapRect instance when given one", () => {
		const map = makeMapStub({
			px: [
				[256, 256],
				[1280, 1024],
			],
			scale: 256,
		});
		const prev = new MapRectStub(0, 0, 0, 0);

		const rect = leafletBoundsToMapkitRect(map, prev);

		expect(rect).toBe(prev); // same object, mutated in place
		expect(rect.origin.x).toBeCloseTo(1);
		expect(rect.size.width).toBeCloseTo(4);
	});
});

describe("mapkitRectToLeafletBounds", () => {
	it("converts a rect to bounds when the center is already inside", () => {
		const rect = new MapRectStub(0.1, 0.1, 0.2, 0.2);

		const bounds = mapkitRectToLeafletBounds(rect, 0.2);

		expect(bounds.getSouthWest().lat).toBeCloseTo(0.1);
		expect(bounds.getSouthWest().lng).toBeCloseTo(0.1);
		expect(bounds.getNorthEast().lat).toBeCloseTo(0.3);
		expect(bounds.getNorthEast().lng).toBeCloseTo(0.3);
	});

	it("shifts the bounds eastward by 360-degree steps to contain the center", () => {
		const rect = new MapRectStub(0.1, 0.1, 0.2, 0.2);

		const bounds = mapkitRectToLeafletBounds(rect, 720.2);

		expect(bounds.getSouthWest().lng).toBeCloseTo(720.1);
		expect(bounds.getNorthEast().lng).toBeCloseTo(720.3);
		// latitude is unaffected by the longitudinal shift
		expect(bounds.getSouthWest().lat).toBeCloseTo(0.1);
		expect(bounds.getNorthEast().lat).toBeCloseTo(0.3);
	});
});

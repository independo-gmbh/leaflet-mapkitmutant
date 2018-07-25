# Leaflet.MapkitMutant

A [LeafletJS](http://leafletjs.com/) plugin to use [Apple's mapkitJS](https://developer.apple.com/documentation/mapkitjs) basemaps.

The name comes from [GoogleMutant](https://gitlab.com/IvanSanchez/Leaflet.GridLayer.GoogleMutant). It's catchy, even if MapkitMutant doesn't use DOM mutation observers.

I do not have any authorization tokens, so there's no live demo for this.
(hint hint: somebody please provide me with one)

## Usage

Include the mapkitJS API in your HTML, plus Leaflet:

```html
<script src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.3/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.3.3/dist/leaflet.js"></script>
```

Include the MapkitMutant javascript file:

```html
<script src='https://unpkg.com/leaflet.mapkitmutant@latest/Leaflet.MapkitMutant.js'></script>
```

Then, you can create an instance of `L.GridLayer.MapkitMutant` on your JS code:

```javascript
var roads = L.mapkitMutant({
	// valid values for 'type' are 'default', 'satellite' and 'hybrid'
	type: 'hybrid',

	authorizationCallback: function(done) {
		done("Your authorization token goes here")
	},
	language: 'en',

	// For debugging purposes only. Displays a L.Rectangle on the
	// visible bounds ("region") of the mutant.
	debugRectangle: false
}).addTo(map);
```


## Known issues

* "I only see a rectangle when zooming out"

This happens because MapkitJS has a very particular behaviour for very low
zoom levels: it will refuse to use the given `CoordinateSpan` if that would
mean displaying over 180 degrees of longitude or so.

The current workaround is to scale down the size of the MapkitMutant so it overlaps
the region it reports to cover.

In practical terms, this means that users should add `minZoom: 3` to their maps.
Else, users will not see parts of the map as grey.

* "Things have a vertical offset at low-ish zoom levels"

This happens because MapkitJS has a weird way of returning the visible bounds
("region" in mapkitJS parlance) - they don't exactly fit the bounds ("region")
that was requested before.

There's no workaround for this - I just refuse to calculate their buggy latitude
offsets. I recommend complaining to the MapkitJS devs so that they get their
projections right.


* "I want routing, and placename search, and traffic, and streetview"

Nope. this plugin is **only** for the mapkitjs basemaps. It doesn't provide
routing, nor search, nor POIs. If you want that, consider implementing it
yourself.

## Legalese

Licensed under LGPL3. Because why not. See the LICENSE file for details.


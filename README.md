# Leaflet.MapkitMutant

A [LeafletJS](http://leafletjs.com/) plugin to use [Apple's mapkitJS](https://developer.apple.com/documentation/mapkitjs) basemaps.

The name comes from [GoogleMutant](https://gitlab.com/IvanSanchez/Leaflet.GridLayer.GoogleMutant). It's catchy, even if MapkitMutant doesn't use DOM mutation observers.


## Usage

Include the mapkitJS API in your HTML, plus Leaflet:

```html
<script src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.3/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.0.3/dist/leaflet.js"></script>
```

Include the MapkitMutant javascript file:

```html
<script src='https://unpkg.com/leaflet.mapkitmutant@latest/Leaflet.MapkitMutant.js'></script>
```

Then, you can create an instance of `L.GridLayer.MapkitMutant` on your JS code:

```javascript
var roads = L.mapkitMutant({
	type: 'hybrid',	// valid values are 'default', 'satellite' and 'hybrid'
	authorizationCallback: function(done) {
		done("Your authorization token goes here")
	},
	language: 'en'
}).addTo(map);
```


## Known issues

* MapkitJS has a very particular behaviour for very low zoom levels: it will refuse
to use the given `CoordinateSpan` if that would mean displaying over 180 degrees of
longitude or so.

  The current workaround is to scale down the size of the MapkitMutant so it overlaps
the region it reports to cover.

  In practical terms, this means that users should add `minZoom: 3` to their maps.
Else, users will not see parts of the map as grey.

* Also, this plugin is **only** for the mapkitjs basemaps. It doesn't provide routing, nor search, nor POIs.

* The compass is still seen, even though MapkitMutant's code specifies
the `showsCompass` option with a value of `false`.

* Visibility and z-index issues. A feature in the TODO is to grab the `syrup-canvas`
from the mutant and move inside a `L.ImageOverlay`.

## Legalese

Licensed under LGPL3. Because why not. See the LICENSE file for details.


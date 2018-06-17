
// https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js
// https://codepen.io/ping13/pen/xzLOqe


L.MapkitMutant = L.Layer.extend({

	options: {
		minZoom: 3,
		maxZoom: 23,
		tileSize: 256,
// 		opacity: 1,

		// 🍂option type: String = 'standard'
		// mapkit's map type. Valid values are strings 'standard' (default),
		// 'satellite' or 'hybrid'.
		type: 'standard',
	},


    initialize: function (options) {

        /// TODO: Add a this._mapkitPromise, just like GoogleMutant

        mapkit.init({
            // If you plan to use this code please use your own JWT key
            authorizationCallback: function(done) {
                done("eyJhbGciOiJFUzI1NiIsImFsZyI6IkVTMjU2Iiwia2lkIjoiREJMQ0JQRlBMNiJ9.eyJpc3MiOiI2M05HRDc0R040IiwiaWF0IjoxNTI4NzUxNjg1LCJleHAiOjE1NjAyODc2ODV9.wr1vqwjkc43-x6D-go1LLgUHBz6S5HpZeyFjalrRfSwg0yCRTb1tAEGkY4hh-ORiCOmu2PYREAxgrKHcwOdRAw");
            },
            language: "en"
        });
    },


    onAdd: function(map) {
		this._map = map;

		this._initMutantContainer();

        this._initMutant();

		map.on('move zoom moveend zoomend', this._update, this);
		map.on('resize', this._resize, this);
		this._resize();
    },

	onRemove: function (map) {
		L.Layer.prototype.onRemove.call(this, map);

		map._container.removeChild(this._mutantContainer);
		this._mutantContainer = undefined;
		map.off('move zoom moveend zoomend', this._update, this);
		map.off('resize', this._resize, this);
    },


	_initMutantContainer: function () {
		if (!this._mutantContainer) {
			this._mutantContainer = L.DomUtil.create('div', 'leaflet-mapkit-mutant leaflet-top leaflet-left');
			this._mutantContainer.id = '_MutantContainer_' + L.Util.stamp(this._mutantContainer);
			this._mutantContainer.style.zIndex = '200'; //leaflet map pane at 400, controls at 1000
			this._mutantContainer.style.pointerEvents = 'none';

			this._map.getContainer().appendChild(this._mutantContainer);
		}

// 		this.setOpacity(this.options.opacity);
		this.setElementSize(this._mutantContainer, this._map.getSize());

		//this._attachObserver(this._mutantContainer);
	},

    _initMutant: function () {
		if (/*!this._ready || */!this._mutantContainer) return;

		var mapType = mapkit.Map.MapTypes.Standard;
		if (this.options.maptype === 'hybrid') {
			mapType = mapkit.Map.MapTypes.Hybrid;
		} else if (this.options.maptype === 'satellite') {
			mapType = mapkit.Map.MapTypes.Satellite;
		}

		var map = new mapkit.Map(this._mutantContainer, {
            region: this._leafletBoundsToMapkitRegion(),
            showsUserLocation: false,
            showsUserLocationControl: false,
			showsCompass: false,
			showsZoomControl: false,
			showsUserLocationControl: false,
			showsScale: false,
			showsMapTypeControl: false,
            mapType: mapkit.Map.MapTypes.Hybrid
        });

		this._mutant = map;

		// 🍂event spawned
		// Fired when the mutant has been created.
		this.fire('spawned', {mapObject: map});
	},

	_leafletBoundsToMapkitRegion: function() {
		var bounds = this._map.getBounds();
		var center = bounds.getCenter();
		var width = bounds.getEast() - bounds.getWest();
		var height = bounds.getNorth() - bounds.getSouth();
		return new mapkit.CoordinateRegion(
			// Center
			new mapkit.Coordinate(center.lat, center.lng)
			,
			// Span
			new mapkit.CoordinateSpan(height, width)
		);
	},

	_update: function(){
		if (this._mutant) {

			console.log('', this._leafletBoundsToMapkitRegion().toString(), 'vs', this._mutant.region);

			this._mutant.setRegionAnimated(this._leafletBoundsToMapkitRegion(), false);
		}
	},


	_resize: function () {
		var size = this._map.getSize();
		if (this._mutantContainer.style.width === size.x &&
			this._mutantContainer.style.height === size.y)
			return;
		this.setElementSize(this._mutantContainer, size);
		if (!this._mutant) return;
// 		google.maps.event.trigger(this._mutant, 'resize');
	},


	setElementSize: function (e, size) {
		e.style.width = size.x + 'px';
		e.style.height = size.y + 'px';
	},

});


var map = L.map('map', {}).setView([0, 0], 3);

(new L.MapkitMutant()).addTo(map)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	'attribution': 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
	opacity: 0.2
}).addTo(map)




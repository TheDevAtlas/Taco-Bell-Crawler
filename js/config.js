const MAP_CONFIG = {
    initialView: {
        lat: 39.8283,
        lng: -98.5795,
        zoom: 4
    },
    mapOptions: {
        preferCanvas: true,
        renderer: L.canvas({ tolerance: 5 }),
        zoomControl: false,
        zoomSnap: 0.5,
        wheelPxPerZoomLevel: 120
    },
    tileLayer: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        options: {
            attribution: '© OpenStreetMap contributors © CARTO',
            maxZoom: 19,
            subdomains: 'abcd',
            updateWhenIdle: false,
            updateWhenZooming: false,
            keepBuffer: 2
        }
    },    markerStyle: {
        radius: 6,
        fillColor: "#7B3FF2",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
        bubblingMouseEvents: true
    },    collegeMarkerStyle: {
        radius: 8,
        fillColor: "#1E90FF",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7,
        bubblingMouseEvents: true
    },
    civicsMarkerStyle: {
        radius: 7,
        fillColor: "#FFD700",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        bubblingMouseEvents: true
    },    dataPath: 'data/locations.csv',
    collegePath: 'data/colleges.csv',
    civicsPath: 'data/civics.csv',
    statesGeoJsonPath: 'data/us-states.json',
    roadsGeoJsonPath: 'https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/test/integration/assets/interstate-highway.geojson'
};

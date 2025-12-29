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
    },
    markerStyle: {
        radius: 6,
        fillColor: "#7B3FF2",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        renderer: L.canvas({ tolerance: 5 })
    },
    dataPath: 'data/locations.csv'
};

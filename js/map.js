class TacoBellMap {
    constructor() {
        this.map = null;
        this.markerLayer = null;
        this.locations = [];
        this.panelOpen = true;
    }

    initialize() {
        this.initializeMap();
        this.loadAndDisplayLocations();
        this.initializePanelToggle();
    }

    initializePanelToggle() {
        const toggleBtn = document.getElementById('panelToggle');
        const panel = document.getElementById('leftPanel');

        toggleBtn.addEventListener('click', () => {
            this.panelOpen = !this.panelOpen;
            panel.classList.toggle('collapsed');
            toggleBtn.classList.toggle('panel-open');
        });
    }

    initializeMap() {
        this.map = L.map('map', MAP_CONFIG.mapOptions)
            .setView([MAP_CONFIG.initialView.lat, MAP_CONFIG.initialView.lng], MAP_CONFIG.initialView.zoom);
        
        // Add zoom control to top right
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        
        L.tileLayer(MAP_CONFIG.tileLayer.url, MAP_CONFIG.tileLayer.options).addTo(this.map);
    }

    createPopupContent(location) {
        return `
            <div class="popup-title">${location.location}</div>
            <div class="popup-id">Store ID: ${location.storeId}</div>
            <div class="popup-links">
                <a href="${location.page}" target="_blank">Store Page</a>
                <a href="${location.mapUrl}" target="_blank">Directions</a>
            </div>
        `;
    }

    createMarker(location) {
        return L.circleMarker([location.lat, location.lng], MAP_CONFIG.markerStyle)
            .bindPopup(() => this.createPopupContent(location), {
                maxWidth: 300,
                autoPan: false
            });
    }

    async loadAndDisplayLocations() {
        this.locations = await CSVParser.loadLocations(MAP_CONFIG.dataPath);
        
        document.getElementById('loading').style.display = 'none';
        
        if (this.locations.length === 0) return;
        
        const markers = this.locations.map(loc => this.createMarker(loc));
        this.markerLayer = L.layerGroup(markers).addTo(this.map);
        
        const bounds = L.latLngBounds(this.locations.map(loc => [loc.lat, loc.lng]));
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const tacoBellMap = new TacoBellMap();
    tacoBellMap.initialize();
});

class TacoBellMap {
    constructor() {
        this.map = null;
        this.markerLayer = null;
        this.locations = [];
        this.panelOpen = true;
        this.priceColorEnabled = false;
    }

    initialize() {
        this.initializeMap();
        this.loadAndDisplayLocations();
        this.initializePanelToggle();
        this.initializePriceColorToggle();
        this.initializeMenuManager();
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

    initializePriceColorToggle() {
        const toggle = document.getElementById('priceColorToggle');
        toggle.addEventListener('change', (e) => {
            this.priceColorEnabled = e.target.checked;
            this.updateMarkerColors();
        });
    }

    async initializeMenuManager() {
        menuManager = new MenuManager();
        await menuManager.initialize();
        
        // Listen for order updates to refresh marker colors
        const originalUpdateUI = menuManager.updateUI.bind(menuManager);
        menuManager.updateUI = () => {
            originalUpdateUI();
            if (this.priceColorEnabled) {
                this.updateMarkerColors();
            }
        };
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
        const marker = L.circleMarker([location.lat, location.lng], MAP_CONFIG.markerStyle)
            .bindPopup(() => this.createPopupContent(location), {
                maxWidth: 300,
                autoPan: false
            });
        
        // Store location reference for later updates
        marker.locationData = location;
        return marker;
    }

    getPriceColor(price, minPrice, maxPrice) {
        if (minPrice === maxPrice) {
            return '#FFD700'; // Gold if all prices are the same
        }
        
        // Normalize price to 0-1 range
        const normalized = (price - minPrice) / (maxPrice - minPrice);
        
        // Create gradient: green -> yellow -> orange -> red
        let r, g, b;
        
        if (normalized < 0.33) {
            // Green to Yellow
            const t = normalized / 0.33;
            r = Math.round(0 + (255 * t));
            g = Math.round(255);
            b = 0;
        } else if (normalized < 0.67) {
            // Yellow to Orange
            const t = (normalized - 0.33) / 0.34;
            r = 255;
            g = Math.round(255 - (100 * t));
            b = 0;
        } else {
            // Orange to Red
            const t = (normalized - 0.67) / 0.33;
            r = 255;
            g = Math.round(165 - (165 * t));
            b = 0;
        }
        
        return `rgb(${r}, ${g}, ${b})`;
    }

    updateMarkerColors() {
        if (!this.markerLayer) return;
        
        const layers = this.markerLayer.getLayers();
        
        if (!this.priceColorEnabled) {
            // Reset to default purple color
            layers.forEach(marker => {
                marker.setStyle(MAP_CONFIG.markerStyle);
            });
            return;
        }
        
        // Get price range for color gradient
        const prices = [];
        layers.forEach(marker => {
            const price = menuManager.getLocationPriceForColoring(marker.locationData.storeId);
            if (price !== null) {
                prices.push(price);
            }
        });
        
        if (prices.length === 0) {
            // No prices available, reset to default
            layers.forEach(marker => {
                marker.setStyle(MAP_CONFIG.markerStyle);
            });
            return;
        }
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        // Update each marker color based on price
        layers.forEach(marker => {
            const price = menuManager.getLocationPriceForColoring(marker.locationData.storeId);
            
            if (price !== null) {
                const color = this.getPriceColor(price, minPrice, maxPrice);
                marker.setStyle({
                    ...MAP_CONFIG.markerStyle,
                    fillColor: color,
                    color: color
                });
            } else {
                // Location doesn't have all items, keep default color
                marker.setStyle(MAP_CONFIG.markerStyle);
            }
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

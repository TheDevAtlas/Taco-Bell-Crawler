class TacoBellMap {    constructor() {
        this.map = null;
        this.markerLayer = null;
        this.collegeLayer = null;
        this.statesLayer = null;
        this.roadsLayer = null;
        this.locations = [];
        this.colleges = [];
        this.povertyData = {};
        this.statesGeoJson = null;
        this.roadsGeoJson = null;
        this.panelOpen = true;
        this.priceColorEnabled = true;
        this.collegesVisible = false;
        this.civicsVisible = false;
        this.roadsVisible = false;
    }    async initialize() {
        this.initializeMap();
        await this.loadStatesData(); // Load states GeoJSON first (bottom layer)
        await this.loadRoadsData(); // Load roads second
        await this.loadAndDisplayColleges(); // Load colleges third (middle layer)
        await this.loadAndDisplayLocations(); // Then load Taco Bells last (top layer)
        this.initializePanelToggle();
        this.initializePriceColorToggle();
        this.initializeCollegeToggle();
        this.initializeCivicsToggle();
        this.initializeRoadsToggle();
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

    initializeCollegeToggle() {
        const toggle = document.getElementById('collegeToggle');
        toggle.addEventListener('change', (e) => {
            this.collegesVisible = e.target.checked;
            this.toggleCollegeMarkers();
        });
    }    initializeCivicsToggle() {
        const toggle = document.getElementById('civicsToggle');
        toggle.addEventListener('change', (e) => {
            this.civicsVisible = e.target.checked;
            this.toggleStatesOverlay();
        });
    }

    initializeRoadsToggle() {
        const toggle = document.getElementById('roadsToggle');
        toggle.addEventListener('change', (e) => {
            this.roadsVisible = e.target.checked;
            this.toggleRoadsOverlay();
        });
    }

    toggleCollegeMarkers() {
        if (!this.collegeLayer) return;
        
        if (this.collegesVisible) {
            this.map.addLayer(this.collegeLayer);
        } else {
            this.map.removeLayer(this.collegeLayer);
        }
    }    toggleStatesOverlay() {
        if (!this.statesLayer) return;
        
        if (this.civicsVisible) {
            this.map.addLayer(this.statesLayer);
        } else {
            this.map.removeLayer(this.statesLayer);
        }
    }    toggleRoadsOverlay() {
        console.log('toggleRoadsOverlay called:', {
            roadsLayer: !!this.roadsLayer,
            roadsVisible: this.roadsVisible,
            layerCount: this.roadsLayer ? this.roadsLayer.getLayers().length : 0
        });
        
        if (!this.roadsLayer) return;
        
        if (this.roadsVisible) {
            this.map.addLayer(this.roadsLayer);
            console.log('Roads layer added to map');
        } else {
            this.map.removeLayer(this.roadsLayer);
            console.log('Roads layer removed from map');
        }
    }

    async initializeMenuManager() {
        menuManager = new MenuManager();
        await menuManager.initialize();
        
        // Listen for order updates to refresh marker colors and popups
        const originalUpdateUI = menuManager.updateUI.bind(menuManager);
        menuManager.updateUI = () => {
            originalUpdateUI();
            if (this.priceColorEnabled) {
                this.updateMarkerColors();
            }
            this.updateOpenPopups();
        };
    }

    updateOpenPopups() {
        if (!this.markerLayer) return;
        
        // Update any open popups with new price information
        this.markerLayer.eachLayer(marker => {
            if (marker.isPopupOpen()) {
                const popup = marker.getPopup();
                popup.setContent(this.createPopupContent(marker.locationData));
            }
        });
    }    initializeMap() {
        this.map = L.map('map', MAP_CONFIG.mapOptions)
            .setView([MAP_CONFIG.initialView.lat, MAP_CONFIG.initialView.lng], MAP_CONFIG.initialView.zoom);
        
        // Create custom panes for layer ordering
        // Lower z-index = rendered below
        this.map.createPane('statesPane');
        this.map.getPane('statesPane').style.zIndex = 200; // Below markers (default is 400)
        
        this.map.createPane('roadsPane');
        this.map.getPane('roadsPane').style.zIndex = 350; // Above states, below markers
        
        // Add zoom control to top right
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        
        // Add reset view button to the zoom control
        this.addResetViewControl();
        
        L.tileLayer(MAP_CONFIG.tileLayer.url, MAP_CONFIG.tileLayer.options).addTo(this.map);
    }

    addResetViewControl() {
        // Wait for zoom control to be added, then append reset button to it
        setTimeout(() => {
            const zoomControl = document.querySelector('.leaflet-control-zoom.leaflet-bar.leaflet-control');
            if (zoomControl) {
                const button = L.DomUtil.create('a', 'leaflet-control-reset-view', zoomControl);
                button.innerHTML = '⟲';
                button.href = '#';
                button.title = 'Reset View';
                button.setAttribute('role', 'button');
                button.setAttribute('aria-label', 'Reset map view');
                
                L.DomEvent.on(button, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    L.DomEvent.stopPropagation(e);
                    this.resetView();
                });
            }
        }, 0);
    }

    resetView() {
        if (this.locations.length > 0) {
            const bounds = L.latLngBounds(this.locations.map(loc => [loc.lat, loc.lng]));
            this.map.fitBounds(bounds, { padding: [50, 50], animate: true });
        }
    }

    createPopupContent(location) {
        // Get the price for this specific location
        const price = menuManager?.getLocationPriceForColoring(location.storeId);
        const priceHTML = price !== null && price !== undefined 
            ? `<div class="popup-price">Your Order: $${price.toFixed(2)}</div>`
            : '';
        
        return `
            <div class="popup-title">${location.location}</div>
            <div class="popup-id">Store ID: ${location.storeId}</div>
            ${priceHTML}
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
    }    createCollegeMarker(college) {
        const marker = L.circleMarker([college.lat, college.lng], MAP_CONFIG.collegeMarkerStyle)
            .bindPopup(this.createCollegePopupContent(college), {
                maxWidth: 300,
                autoPan: false
            });
        
        return marker;
    }    createCollegePopupContent(college) {
        const studentsFormatted = college.students.toLocaleString();
        return `
            <div class="popup-title">${college.name}</div>
            <div class="popup-id">${college.city}, ${college.state}</div>
            <div class="popup-price">Students: ${studentsFormatted}</div>
        `;
    }

    getPovertyColor(povertyRate) {
        // Low poverty (good) = green, High poverty (bad) = red
        // Range typically 7-20%
        const minRate = 7;
        const maxRate = 20;
        
        // Clamp the rate
        const clampedRate = Math.max(minRate, Math.min(maxRate, povertyRate));
        
        // Normalize to 0-1 (0 = low poverty, 1 = high poverty)
        const normalized = (clampedRate - minRate) / (maxRate - minRate);
        
        let r, g, b;
        
        if (normalized < 0.5) {
            // Green to Yellow
            const t = normalized / 0.5;
            r = Math.round(100 + (155 * t)); // 100 -> 255
            g = Math.round(200 - (50 * t));  // 200 -> 150
            b = 0;
        } else {
            // Yellow to Red
            const t = (normalized - 0.5) / 0.5;
            r = 255;
            g = Math.round(150 - (150 * t)); // 150 -> 0
            b = 0;
        }
        
        return `rgb(${r}, ${g}, ${b})`;
    }    getStateStyle(feature) {
        const stateCode = feature.id;
        const povertyInfo = this.povertyData[stateCode];
        
        if (!povertyInfo) {
            return {
                fillColor: '#666',
                weight: 1,
                opacity: 0.5,
                color: 'white',
                fillOpacity: 0.2
            };
        }
        
        return {
            fillColor: this.getPovertyColor(povertyInfo.povertyRate),
            weight: 1,
            opacity: 0.6,
            color: 'white',
            fillOpacity: 0.5
        };
    }    onEachState(feature, layer) {
        const stateCode = feature.id;
        const povertyInfo = this.povertyData[stateCode];
        
        if (povertyInfo) {
            layer.bindPopup(`
                <div class="popup-title">${povertyInfo.name}</div>
                <div class="popup-price">Poverty Rate: ${povertyInfo.povertyRate}%</div>
            `, {
                maxWidth: 300,
                autoPan: false
            });
        }
        
        // Highlight on hover
        layer.on({
            mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.7
                });
            },
            mouseout: (e) => {
                this.statesLayer.resetStyle(e.target);
            }
        });
    }

    getPriceColor(price, minPrice, maxPrice) {
        if (minPrice === maxPrice) {
            return '#B8860B'; // Dark gold if all prices are the same
        }
        
        // Normalize price to 0-1 range
        const normalized = (price - minPrice) / (maxPrice - minPrice);
        
        // Create gradient: dark green -> dark yellow -> burgundy -> dark red
        let r, g, b;
        
        if (normalized < 0.33) {
            // Dark Green to Dark Yellow
            const t = normalized / 0.33;
            r = Math.round(0 + (180 * t));
            g = Math.round(150 + (30 * t));
            b = 0;
        } else if (normalized < 0.67) {
            // Dark Yellow to Burgundy
            const t = (normalized - 0.33) / 0.34;
            r = Math.round(180 - (40 * t));
            g = Math.round(180 - (140 * t));
            b = Math.round(0 + (40 * t));
        } else {
            // Burgundy to Dark Red
            const t = (normalized - 0.67) / 0.33;
            r = Math.round(140 + (40 * t));
            g = Math.round(40 - (40 * t));
            b = Math.round(40 - (40 * t));
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
                    fillColor: color
                    // Keep the white outline from MAP_CONFIG.markerStyle
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
    }    async loadAndDisplayColleges() {
        this.colleges = await CSVParser.loadColleges(MAP_CONFIG.collegePath);
        
        if (this.colleges.length === 0) return;
        
        const markers = this.colleges.map(college => this.createCollegeMarker(college));
        this.collegeLayer = L.layerGroup(markers);
        
        // Don't add to map by default, wait for toggle
    }    async loadStatesData() {
        // Load poverty data
        this.povertyData = await CSVParser.loadCivics(MAP_CONFIG.civicsPath);
        
        // Load GeoJSON
        try {
            const response = await fetch(MAP_CONFIG.statesGeoJsonPath);
            this.statesGeoJson = await response.json();
            
            // Create states layer with custom pane to ensure it renders below markers
            this.statesLayer = L.geoJSON(this.statesGeoJson, {
                style: (feature) => this.getStateStyle(feature),
                onEachFeature: (feature, layer) => this.onEachState(feature, layer),
                pane: 'statesPane' // Use custom pane with z-index 200 (below default 400)
            });
            
            // Don't add to map by default, wait for toggle
        } catch (error) {
            console.error('Error loading states GeoJSON:', error);
        }
    }    async loadRoadsData() {
        try {
            // Create a simple representation of major interstates
            this.roadsLayer = L.layerGroup();
            
            // Create Interstate Highway lines (simplified major routes)
            const interstates = this.createInterstateHighways();
            interstates.forEach(road => {
                const line = L.polyline(road.coords, {
                    color: '#FFA500',
                    weight: 2,
                    opacity: 0.8,
                    pane: 'roadsPane'
                }).bindPopup(`<div class="popup-title">${road.name}</div>`, {
                    maxWidth: 200,
                    autoPan: false
                });
                this.roadsLayer.addLayer(line);
            });
            
            console.log('Roads layer created with', interstates.length, 'interstate highways');
            // Don't add to map by default, wait for toggle
        } catch (error) {
            console.error('Error loading roads data:', error);
        }
    }    createInterstateHighways() {
        // Major Interstate Highways with approximate coordinates (high resolution)
        return [
            // I-95 (East Coast - Maine to Florida)
            {
                name: 'Interstate 95',
                coords: [
                    [47.2, -68.8], // Houlton, ME
                    [46.9, -68.9],
                    [46.5, -69.0],
                    [46.1, -69.2],
                    [45.7, -69.4],
                    [45.3, -69.5],
                    [45.0, -69.8],
                    [44.7, -69.9],
                    [44.4, -70.0],
                    [44.0, -70.1],
                    [43.7, -70.3], // Portland, ME
                    [43.4, -70.5],
                    [43.1, -70.6],
                    [42.9, -70.8],
                    [42.7, -70.9],
                    [42.4, -71.1], // Boston, MA
                    [42.2, -71.3],
                    [42.0, -71.6],
                    [41.8, -72.0],
                    [41.8, -72.4],
                    [41.8, -72.7], // New Haven, CT
                    [41.7, -73.0],
                    [41.5, -73.3],
                    [41.3, -73.5],
                    [41.0, -73.7],
                    [40.7, -74.0], // New York, NY
                    [40.5, -74.3],
                    [40.3, -74.6],
                    [40.0, -75.0],
                    [40.0, -75.2], // Philadelphia, PA
                    [39.8, -75.5],
                    [39.6, -75.8],
                    [39.5, -76.1],
                    [39.4, -76.4],
                    [39.3, -76.6], // Baltimore, MD
                    [39.2, -76.8],
                    [39.0, -76.9],
                    [38.9, -77.0], // Washington, DC
                    [38.7, -77.1],
                    [38.5, -77.2],
                    [38.3, -77.3],
                    [38.0, -77.4],
                    [37.7, -77.4],
                    [37.5, -77.4], // Richmond, VA
                    [37.3, -77.3],
                    [37.1, -77.1],
                    [37.0, -76.8],
                    [36.9, -76.5],
                    [36.9, -76.2], // Norfolk, VA
                    [36.7, -76.5],
                    [36.5, -76.9],
                    [36.4, -77.3],
                    [36.3, -77.7],
                    [36.2, -78.1],
                    [36.1, -78.5],
                    [36.0, -78.9],
                    [36.0, -79.2],
                    [36.1, -79.4], // Greensboro, NC
                    [35.9, -79.6],
                    [35.7, -79.9],
                    [35.5, -80.2],
                    [35.3, -80.5],
                    [35.2, -80.8], // Charlotte, NC
                    [35.0, -80.8],
                    [34.7, -80.8],
                    [34.5, -80.9],
                    [34.2, -80.9],
                    [34.0, -81.0], // Columbia, SC
                    [33.8, -81.2],
                    [33.6, -81.5],
                    [33.5, -81.8],
                    [33.5, -82.0], // Augusta, GA
                    [33.3, -81.8],
                    [33.0, -81.6],
                    [32.7, -81.4],
                    [32.4, -81.3],
                    [32.1, -81.1], // Savannah, GA
                    [31.8, -81.2],
                    [31.5, -81.3],
                    [31.2, -81.4],
                    [30.9, -81.5],
                    [30.6, -81.6],
                    [30.3, -81.7], // Jacksonville, FL
                    [30.1, -81.6],
                    [29.9, -81.5],
                    [29.7, -81.3], // Daytona Beach, FL
                    [29.5, -81.3],
                    [29.2, -81.3],
                    [29.0, -81.4],
                    [28.7, -81.4],
                    [28.5, -81.4], // Orlando, FL
                    [28.2, -81.3],
                    [27.9, -81.1],
                    [27.6, -80.9],
                    [27.3, -80.7],
                    [27.0, -80.5],
                    [26.7, -80.4],
                    [26.4, -80.2],
                    [26.1, -80.1]  // Miami, FL
                ]
            },            // I-10 (Southern - California to Florida)
            {
                name: 'Interstate 10',
                coords: [
                    [34.1, -118.2], // Los Angeles, CA
                    [34.0, -117.9],
                    [33.9, -117.6],
                    [33.9, -117.4], // Riverside, CA
                    [33.8, -117.1],
                    [33.8, -116.8],
                    [33.7, -116.5],
                    [33.7, -116.2],
                    [33.7, -115.9],
                    [33.6, -115.6],
                    [33.6, -115.3],
                    [33.5, -115.0],
                    [33.5, -114.7],
                    [33.5, -114.4],
                    [33.5, -114.1],
                    [33.5, -113.8],
                    [33.5, -113.5],
                    [33.5, -113.2],
                    [33.5, -112.9],
                    [33.5, -112.6],
                    [33.5, -112.3],
                    [33.5, -112.1], // Phoenix, AZ
                    [33.4, -111.8],
                    [33.3, -111.5],
                    [33.1, -111.2],
                    [32.9, -111.0],
                    [32.6, -110.9],
                    [32.4, -110.9],
                    [32.2, -110.9], // Tucson, AZ
                    [32.1, -110.5],
                    [32.1, -110.1],
                    [32.1, -109.7],
                    [32.2, -109.3],
                    [32.2, -108.9],
                    [32.2, -108.5],
                    [32.3, -108.1],
                    [32.3, -107.7],
                    [32.3, -107.3],
                    [32.3, -106.9],
                    [32.3, -106.8], // Las Cruces, NM
                    [32.2, -106.7],
                    [32.0, -106.6],
                    [31.9, -106.5],
                    [31.8, -106.4], // El Paso, TX
                    [31.7, -106.2],
                    [31.6, -106.0],
                    [31.4, -105.7],
                    [31.3, -105.4],
                    [31.2, -105.1],
                    [31.1, -104.8],
                    [31.0, -104.5],
                    [31.0, -104.2],
                    [31.0, -103.9],
                    [31.0, -103.5], // Fort Stockton, TX
                    [30.8, -103.1],
                    [30.6, -102.7],
                    [30.4, -102.3],
                    [30.2, -101.9],
                    [30.0, -101.5],
                    [29.9, -101.1],
                    [29.7, -100.7],
                    [29.6, -100.3],
                    [29.5, -99.9],
                    [29.5, -99.5],
                    [29.4, -99.1],
                    [29.4, -98.9],
                    [29.4, -98.5], // San Antonio, TX
                    [29.5, -98.1],
                    [29.6, -97.7],
                    [29.6, -97.3],
                    [29.7, -96.9],
                    [29.7, -96.5],
                    [29.8, -96.1],
                    [29.8, -95.8],
                    [29.8, -95.4], // Houston, TX
                    [29.9, -95.0],
                    [30.0, -94.6],
                    [30.1, -94.2],
                    [30.1, -93.8],
                    [30.2, -93.4],
                    [30.2, -93.0],
                    [30.3, -92.6],
                    [30.3, -92.2],
                    [30.3, -91.8],
                    [30.4, -91.4],
                    [30.4, -91.1], // Baton Rouge, LA
                    [30.5, -90.7],
                    [30.5, -90.3],
                    [30.6, -89.9],
                    [30.6, -89.5],
                    [30.6, -89.1],
                    [30.7, -88.7],
                    [30.7, -88.4],
                    [30.7, -88.0], // Mobile, AL
                    [30.6, -87.7],
                    [30.5, -87.5],
                    [30.4, -87.2], // Pensacola, FL
                    [30.4, -86.9],
                    [30.4, -86.6],
                    [30.4, -86.3],
                    [30.4, -86.0],
                    [30.4, -85.7],
                    [30.4, -85.4],
                    [30.4, -85.1],
                    [30.4, -84.8],
                    [30.4, -84.6],
                    [30.4, -84.3], // Tallahassee, FL
                    [30.4, -84.0],
                    [30.4, -83.7],
                    [30.4, -83.4],
                    [30.3, -83.1],
                    [30.3, -82.8],
                    [30.3, -82.5],
                    [30.3, -82.2],
                    [30.3, -81.9],
                    [30.3, -81.7]  // Jacksonville, FL
                ]
            },            // I-80 (Northern - California to New Jersey)
            {
                name: 'Interstate 80',
                coords: [
                    [37.8, -122.4], // San Francisco, CA
                    [37.9, -122.2],
                    [38.0, -122.0],
                    [38.2, -121.8],
                    [38.4, -121.7],
                    [38.6, -121.5], // Sacramento, CA
                    [38.8, -121.3],
                    [39.0, -121.1],
                    [39.2, -120.9],
                    [39.3, -120.7],
                    [39.4, -120.5],
                    [39.5, -120.3],
                    [39.5, -120.1],
                    [39.5, -119.8], // Reno, NV
                    [39.8, -119.5],
                    [40.0, -119.2],
                    [40.2, -118.9],
                    [40.4, -118.6],
                    [40.5, -118.3],
                    [40.6, -118.0],
                    [40.7, -117.7],
                    [40.7, -117.4],
                    [40.8, -117.1],
                    [40.8, -116.8],
                    [40.8, -116.5],
                    [40.8, -116.2],
                    [40.8, -115.8], // Elko, NV
                    [40.9, -115.5],
                    [41.0, -115.2],
                    [41.1, -114.9],
                    [41.1, -114.6],
                    [41.2, -114.3],
                    [41.2, -114.0],
                    [41.2, -113.7],
                    [41.2, -113.4],
                    [41.2, -113.1],
                    [41.2, -112.8],
                    [41.2, -112.5],
                    [41.2, -112.2],
                    [41.2, -112.0], // Salt Lake City, UT
                    [41.2, -111.7],
                    [41.2, -111.4],
                    [41.2, -111.1],
                    [41.2, -110.8],
                    [41.2, -110.5],
                    [41.2, -110.2],
                    [41.2, -109.9],
                    [41.2, -109.6],
                    [41.2, -109.3],
                    [41.2, -109.0],
                    [41.2, -108.7],
                    [41.2, -108.4],
                    [41.2, -108.1],
                    [41.2, -107.8],
                    [41.2, -107.5],
                    [41.2, -107.2],
                    [41.2, -106.9],
                    [41.2, -106.6],
                    [41.3, -106.3],
                    [41.3, -106.0],
                    [41.3, -105.6], // Cheyenne, WY
                    [41.2, -105.3],
                    [41.2, -105.0],
                    [41.1, -104.8], // Sidney, NE
                    [41.2, -104.5],
                    [41.2, -104.2],
                    [41.2, -103.9],
                    [41.2, -103.6],
                    [41.2, -103.3],
                    [41.2, -103.0],
                    [41.2, -102.7],
                    [41.2, -102.4],
                    [41.2, -102.1],
                    [41.2, -101.8],
                    [41.2, -101.5],
                    [41.2, -101.2],
                    [41.2, -100.9],
                    [41.2, -100.6],
                    [41.2, -100.3],
                    [41.2, -100.0],
                    [41.2, -99.7],
                    [41.2, -99.4],
                    [41.2, -99.1],
                    [41.2, -98.8],
                    [41.2, -98.5],
                    [41.2, -98.2],
                    [41.2, -97.9],
                    [41.2, -97.6],
                    [41.2, -97.3],
                    [41.2, -97.0],
                    [41.2, -96.7],
                    [41.2, -96.4],
                    [41.3, -96.0], // Omaha, NE
                    [41.4, -95.7],
                    [41.5, -95.4],
                    [41.5, -95.1],
                    [41.5, -94.8],
                    [41.5, -94.5],
                    [41.6, -94.2],
                    [41.6, -93.9],
                    [41.6, -93.6], // Des Moines, IA
                    [41.6, -93.3],
                    [41.6, -93.0],
                    [41.7, -92.7],
                    [41.7, -92.4],
                    [41.7, -92.1],
                    [41.7, -91.8],
                    [41.7, -91.5],
                    [41.7, -91.2],
                    [41.7, -90.9],
                    [41.7, -90.6],
                    [41.7, -90.3],
                    [41.7, -90.0],
                    [41.7, -89.7],
                    [41.7, -89.4],
                    [41.8, -89.1],
                    [41.8, -88.8],
                    [41.8, -88.5],
                    [41.8, -88.3], // Chicago, IL
                    [41.7, -88.0],
                    [41.7, -87.7],
                    [41.6, -87.4],
                    [41.6, -87.1],
                    [41.6, -86.8],
                    [41.5, -86.5],
                    [41.5, -86.2],
                    [41.5, -85.9],
                    [41.5, -85.6],
                    [41.5, -85.3],
                    [41.5, -85.0], // South Bend, IN
                    [41.4, -84.7],
                    [41.4, -84.4],
                    [41.3, -84.1],
                    [41.3, -83.8],
                    [41.2, -83.5],
                    [41.2, -83.2],
                    [41.2, -82.9],
                    [41.2, -82.6],
                    [41.1, -82.3],
                    [41.1, -82.0],
                    [41.1, -81.7],
                    [41.1, -81.4],
                    [41.1, -81.1],
                    [41.1, -80.9],
                    [41.1, -80.6], // Youngstown, OH
                    [41.0, -80.3],
                    [41.0, -80.0],
                    [41.0, -79.7],
                    [41.0, -79.4],
                    [41.0, -79.1],
                    [41.0, -78.8],
                    [41.0, -78.5],
                    [41.0, -78.2],
                    [41.0, -77.8], // State College, PA
                    [41.0, -77.5],
                    [40.9, -77.2],
                    [40.9, -76.9],
                    [40.9, -76.6],
                    [40.9, -76.3],
                    [40.9, -76.0],
                    [40.9, -75.7],
                    [40.9, -75.4],
                    [40.9, -75.2], // Allentown, PA
                    [40.9, -75.0],
                    [40.8, -74.8],
                    [40.8, -74.6],
                    [40.7, -74.4],
                    [40.7, -74.2]  // New York area, NJ
                ]
            },            // I-90 (Northern - Seattle to Boston)
            {
                name: 'Interstate 90',
                coords: [
                    [47.6, -122.3], // Seattle, WA
                    [47.6, -122.0], [47.6, -121.7], [47.6, -121.4], [47.6, -121.1], [47.6, -120.8],
                    [47.6, -120.5], [47.6, -120.2], [47.6, -119.9], [47.7, -119.6], [47.7, -119.3],
                    [47.7, -119.0], [47.7, -118.7], [47.7, -118.4], [47.7, -118.1], [47.7, -117.8],
                    [47.7, -117.4], // Spokane, WA
                    [47.6, -117.0], [47.6, -116.6], [47.5, -116.2], [47.5, -115.8], [47.5, -115.4],
                    [47.5, -115.0], [47.5, -114.6], [47.5, -114.2], [47.5, -113.8], [47.5, -113.4],
                    [47.5, -113.0], [47.5, -112.6], [47.5, -112.2], [47.5, -111.8], [47.5, -111.3], // Great Falls, MT
                    [47.3, -110.9], [47.1, -110.5], [46.9, -110.1], [46.7, -109.7], [46.5, -109.3],
                    [46.3, -109.0], [46.1, -108.7], [45.9, -108.5], [45.8, -108.5], // Billings, MT
                    [45.6, -108.2], [45.4, -107.8], [45.2, -107.4], [45.0, -107.0], [44.8, -106.6],
                    [44.6, -106.2], [44.4, -105.8], [44.3, -105.4], [44.2, -105.0], [44.1, -104.6],
                    [44.1, -104.2], [44.1, -103.8], [44.1, -103.5], [44.1, -103.2], // Rapid City, SD
                    [44.0, -102.8], [43.9, -102.4], [43.8, -102.0], [43.7, -101.6], [43.7, -101.2],
                    [43.6, -100.8], [43.6, -100.4], [43.6, -100.0], [43.5, -99.6], [43.5, -99.2],
                    [43.5, -98.8], [43.5, -98.4], [43.5, -98.0], [43.5, -97.6], [43.5, -97.2],
                    [43.5, -96.9], [43.5, -96.7], // Sioux Falls, SD
                    [43.5, -96.4], [43.5, -96.0], [43.5, -95.6], [43.5, -95.2], [43.5, -94.8],
                    [43.6, -94.4], [43.6, -94.0], [43.6, -93.6], [43.6, -93.2], // Austin, MN
                    [43.7, -92.9], [43.8, -92.7], [43.9, -92.6], [44.0, -92.5], // La Crosse, WI
                    [43.8, -92.2], [43.6, -91.9], [43.5, -91.6], [43.4, -91.3], [43.3, -91.0],
                    [43.2, -90.7], [43.1, -90.4], [43.1, -90.1], [43.0, -89.8], [43.0, -89.5],
                    [43.0, -89.2], [43.0, -88.9], [43.0, -88.6], [43.0, -88.3], [43.0, -88.0],
                    [43.0, -87.9], // Milwaukee, WI
                    [42.7, -87.8], [42.4, -87.7], [42.1, -87.7], [41.9, -87.6], // Chicago, IL
                    [41.8, -87.4], [41.7, -87.2], [41.7, -87.0], [41.7, -86.8], [41.7, -86.6],
                    [41.7, -86.4], [41.7, -86.2], // South Bend, IN
                    [41.6, -86.0], [41.6, -85.8], [41.5, -85.6], [41.5, -85.4], [41.5, -85.2],
                    [41.5, -85.0], [41.5, -84.8], [41.5, -84.6], [41.5, -84.4], [41.5, -84.2],
                    [41.5, -84.0], [41.5, -83.8], [41.5, -83.6], [41.5, -83.4], [41.5, -83.2],
                    [41.5, -83.0], [41.5, -82.8], [41.5, -82.6], [41.5, -82.4], [41.5, -82.2],
                    [41.5, -82.0], [41.5, -81.9], [41.5, -81.7], // Cleveland, OH
                    [41.6, -81.5], [41.7, -81.3], [41.8, -81.1], [41.9, -80.9], [42.0, -80.7],
                    [42.0, -80.5], [42.1, -80.3], [42.1, -80.1], // Erie, PA
                    [42.2, -80.0], [42.3, -79.8], [42.4, -79.7], [42.5, -79.5], [42.6, -79.4],
                    [42.7, -79.2], [42.8, -79.1], [42.9, -78.9], // Buffalo, NY
                    [43.0, -78.6], [43.0, -78.3], [43.1, -78.0], [43.1, -77.8], [43.2, -77.6], // Rochester, NY
                    [43.1, -77.3], [43.0, -77.0], [42.9, -76.7], [42.8, -76.4], [42.7, -76.1],
                    [42.7, -75.8], [42.6, -75.5], [42.6, -75.2], [42.6, -74.9], [42.6, -74.6],
                    [42.6, -74.3], [42.6, -74.0], [42.6, -73.8], // Albany, NY
                    [42.6, -73.5], [42.5, -73.2], [42.5, -72.9], [42.5, -72.6], [42.4, -72.3],
                    [42.4, -72.0], [42.4, -71.7], [42.4, -71.4], [42.4, -71.1]   // Boston, MA
                ]
            },            // I-5 (West Coast - California to Washington)
            {
                name: 'Interstate 5',
                coords: [
                    [32.7, -117.2], // San Diego, CA
                    [32.9, -117.3], [33.1, -117.4], [33.3, -117.5], [33.5, -117.6], [33.7, -117.7],
                    [33.9, -117.9], [34.1, -118.2], // Los Angeles, CA
                    [34.3, -118.4], [34.5, -118.5], [34.7, -118.7], [34.9, -118.8], [35.1, -119.0],
                    [35.3, -119.1], [35.5, -119.3], [35.7, -119.4], [35.9, -119.5], [36.1, -119.6],
                    [36.3, -119.6], [36.5, -119.7], [36.7, -119.8], // Fresno, CA
                    [36.9, -119.9], [37.1, -120.0], [37.3, -120.2], [37.5, -120.4], [37.7, -120.6],
                    [37.9, -120.8], [38.1, -121.0], [38.3, -121.2], [38.5, -121.4], [38.6, -121.5], // Sacramento, CA
                    [38.8, -121.7], [39.0, -121.8], [39.2, -122.0], [39.4, -122.1], [39.6, -122.2],
                    [39.8, -122.2], [40.0, -122.3], [40.2, -122.3], [40.4, -122.3], [40.6, -122.4], // Redding, CA
                    [40.8, -122.5], [41.0, -122.6], [41.2, -122.6], [41.4, -122.7], [41.6, -122.7],
                    [41.8, -122.8], [42.0, -122.8], [42.2, -122.9], [42.3, -122.9], // Medford, OR
                    [42.5, -123.0], [42.7, -123.0], [42.9, -122.8], [43.1, -122.6], [43.3, -122.4],
                    [43.5, -122.2], [43.6, -122.1], // Eugene, OR
                    [43.8, -122.2], [44.0, -122.4], [44.2, -122.5], [44.4, -122.7], [44.6, -122.8],
                    [44.8, -122.9], [44.9, -123.0], // Salem, OR
                    [45.1, -123.0], [45.3, -123.0], [45.4, -122.8], [45.5, -122.7], // Portland, OR
                    [45.6, -122.7], [45.7, -122.7], [45.8, -122.7], [45.9, -122.8], [46.0, -122.8],
                    [46.1, -122.8], [46.2, -122.9], // Olympia, WA
                    [46.4, -122.9], [46.6, -122.9], [46.8, -122.8], [47.0, -122.6], [47.2, -122.5],
                    [47.4, -122.4], [47.6, -122.3]  // Seattle, WA
                ]
            },            // I-75 (Southeast - Michigan to Florida)
            {
                name: 'Interstate 75',
                coords: [
                    [46.5, -84.3],  // Sault Ste. Marie, MI
                    [46.2, -84.3], [45.9, -84.3], [45.6, -84.3], [45.3, -84.3], [45.0, -84.3],
                    [44.7, -84.3], [44.4, -84.2], [44.1, -84.2], [43.8, -84.2], [43.6, -84.2], // Bay City, MI
                    [43.3, -84.1], [43.0, -84.0], [42.7, -83.8], [42.5, -83.5], [42.3, -83.0], // Detroit, MI
                    [42.1, -83.2], [41.9, -83.4], [41.7, -83.6], // Toledo, OH
                    [41.5, -83.6], [41.3, -83.6], [41.1, -83.5], [40.9, -83.4], [40.8, -83.4], // Findlay, OH
                    [40.6, -83.5], [40.4, -83.6], [40.2, -83.8], [40.0, -84.0], [39.8, -84.2], // Dayton, OH
                    [39.6, -84.3], [39.4, -84.4], [39.2, -84.5], [39.1, -84.5], // Cincinnati, OH
                    [38.9, -84.5], [38.7, -84.5], [38.5, -84.5], [38.3, -84.5], [38.1, -84.5],
                    [38.0, -84.5], // Lexington, KY
                    [37.8, -84.4], [37.6, -84.3], [37.4, -84.2], [37.2, -84.1], [37.0, -84.1], // Knoxville, TN
                    [36.8, -84.3], [36.6, -84.5], [36.4, -84.7], [36.2, -84.9], [36.0, -85.1],
                    [35.8, -85.2], [35.6, -85.2], [35.4, -85.3], [35.2, -85.3], [35.0, -85.3], // Chattanooga, TN
                    [34.8, -85.2], [34.6, -85.1], [34.4, -85.0], [34.2, -84.8], [34.0, -84.6],
                    [33.8, -84.5], [33.7, -84.4], // Atlanta, GA
                    [33.5, -84.3], [33.3, -84.2], [33.1, -84.1], [32.9, -83.9], [32.8, -83.7],
                    [32.8, -83.6], // Macon, GA
                    [32.6, -83.5], [32.4, -83.5], [32.2, -83.5], [32.0, -83.5], [31.8, -83.6],
                    [31.6, -83.6], [31.4, -83.7], [31.2, -83.7], [31.0, -83.7], [30.8, -83.7],
                    [30.6, -83.8], [30.4, -83.8], // Valdosta, GA
                    [30.3, -83.6], [30.2, -83.3], [30.2, -83.0], [30.2, -82.7], [30.2, -82.4],
                    [30.2, -82.0], // Lake City, FL
                    [30.1, -82.1], [30.0, -82.2], [29.8, -82.3], [29.7, -82.3], // Gainesville, FL
                    [29.5, -82.3], [29.3, -82.3], [29.1, -82.4], [28.9, -82.4], [28.7, -82.5],
                    [28.5, -82.5], // Tampa, FL
                    [28.3, -82.5], [28.1, -82.5], [27.9, -82.5], [27.7, -82.4], [27.5, -82.4],
                    [27.3, -82.4], [27.1, -82.4], [27.0, -82.4], // Sarasota, FL
                    [26.8, -82.3], [26.6, -82.2], [26.4, -82.0], [26.3, -81.9], [26.1, -81.8]   // Naples, FL
                ]
            },            // I-40 (Southern Central - California to North Carolina)
            {
                name: 'Interstate 40',
                coords: [
                    [34.0, -118.2], // Los Angeles, CA (via I-15)
                    [34.1, -117.9], [34.2, -117.6], [34.3, -117.3], [34.4, -117.0], [34.5, -116.7],
                    [34.6, -116.4], [34.7, -116.1], [34.7, -115.8], [34.8, -115.5], [34.8, -115.2],
                    [34.8, -114.9], [34.9, -114.6], // Needles, CA
                    [35.0, -114.3], [35.0, -114.0], [35.1, -113.7], [35.1, -113.4], [35.1, -113.1],
                    [35.1, -112.8], [35.2, -112.5], [35.2, -112.2], [35.2, -111.9], [35.2, -111.7], // Flagstaff, AZ
                    [35.2, -111.4], [35.2, -111.1], [35.2, -110.8], [35.2, -110.5], [35.2, -110.2],
                    [35.2, -109.9], [35.2, -109.6], [35.2, -109.3], [35.2, -109.0], [35.2, -108.7],
                    [35.2, -108.4], [35.2, -108.1], [35.2, -107.8], [35.2, -107.5], [35.2, -107.2],
                    [35.2, -106.9], [35.2, -106.7], // Albuquerque, NM
                    [35.2, -106.4], [35.2, -106.1], [35.2, -105.8], [35.2, -105.5], [35.2, -105.2],
                    [35.2, -104.9], [35.2, -104.6], [35.2, -104.3], [35.2, -104.0], [35.2, -103.7],
                    [35.2, -103.4], [35.2, -103.1], [35.2, -102.8], [35.2, -102.5], [35.2, -102.2],
                    [35.2, -101.8], // Amarillo, TX
                    [35.2, -101.5], [35.2, -101.2], [35.3, -100.9], [35.3, -100.6], [35.3, -100.3],
                    [35.3, -100.0], [35.3, -99.7], [35.4, -99.4], [35.4, -99.1], [35.4, -98.8],
                    [35.4, -98.5], [35.4, -98.2], [35.5, -97.9], [35.5, -97.7], [35.5, -97.5], // Oklahoma City, OK
                    [35.4, -97.2], [35.4, -96.9], [35.3, -96.6], [35.3, -96.3], [35.3, -96.0],
                    [35.2, -95.7], [35.2, -95.4], [35.2, -95.1], [35.2, -94.8], [35.2, -94.5],
                    [35.2, -94.2], [35.2, -93.9], [35.2, -93.6], [35.2, -93.3], [35.2, -93.0],
                    [35.2, -92.7], [35.2, -92.4], [35.2, -92.1], [35.2, -91.8], [35.2, -91.5],
                    [35.1, -91.2], [35.1, -90.9], [35.1, -90.6], [35.1, -90.3], [35.1, -90.0], // Memphis, TN
                    [35.2, -89.7], [35.3, -89.4], [35.4, -89.1], [35.5, -88.8], [35.6, -88.5],
                    [35.7, -88.2], [35.8, -87.9], [35.9, -87.6], [36.0, -87.3], [36.1, -87.0],
                    [36.2, -86.8], // Nashville, TN
                    [36.1, -86.5], [36.0, -86.2], [35.9, -85.9], [35.8, -85.7], [35.6, -85.5],
                    [35.4, -85.4], [35.2, -85.3], [35.0, -85.3], // Chattanooga, TN
                    [35.1, -85.1], [35.2, -84.9], [35.2, -84.7], [35.3, -84.5], [35.3, -84.3],
                    [35.4, -84.1], [35.4, -83.9], [35.5, -83.7], [35.5, -83.5], [35.5, -83.3],
                    [35.6, -83.1], [35.6, -82.9], [35.6, -82.7], [35.6, -82.6], // Asheville, NC
                    [35.6, -82.3], [35.7, -82.0], [35.7, -81.7], [35.7, -81.4], [35.7, -81.1],
                    [35.7, -80.8], [35.7, -80.5], [35.8, -80.2], [35.8, -79.9], [35.8, -79.6],
                    [35.8, -79.3], [35.8, -79.0], [35.8, -78.8], [35.8, -78.6]   // Raleigh, NC
                ]
            },            // I-35 (Central - Texas to Minnesota)
            {
                name: 'Interstate 35',
                coords: [
                    [27.8, -97.4],  // Corpus Christi, TX
                    [28.0, -97.5], [28.2, -97.6], [28.4, -97.7], [28.6, -97.8], [28.8, -98.0],
                    [29.0, -98.2], [29.2, -98.3], [29.4, -98.5], // San Antonio, TX
                    [29.5, -98.4], [29.6, -98.3], [29.7, -98.2], [29.8, -98.1], [29.9, -98.0],
                    [30.0, -97.9], [30.1, -97.8], [30.3, -97.7], // Austin, TX
                    [30.4, -97.6], [30.6, -97.5], [30.7, -97.4], [30.9, -97.3], [31.1, -97.2],
                    [31.3, -97.1], [31.5, -97.1], // Waco, TX
                    [31.7, -97.1], [31.9, -97.1], [32.1, -97.1], [32.3, -97.2], [32.5, -97.2],
                    [32.7, -97.3], [32.8, -97.3], // Fort Worth, TX
                    [33.0, -97.3], [33.2, -97.3], [33.4, -97.3], [33.6, -97.4], [33.8, -97.4],
                    [34.0, -97.4], [34.2, -97.4], [34.4, -97.4], [34.6, -97.4], [34.8, -97.5],
                    [35.0, -97.5], [35.2, -97.5], [35.4, -97.5], [35.5, -97.5], // Oklahoma City, OK
                    [35.7, -97.4], [35.9, -97.4], [36.1, -97.4], [36.3, -97.4], [36.5, -97.3],
                    [36.7, -97.3], [36.9, -97.3], [37.1, -97.3], [37.3, -97.3], [37.5, -97.3],
                    [37.7, -97.3], // Wichita, KS
                    [37.9, -97.2], [38.1, -97.1], [38.3, -97.0], [38.5, -96.9], [38.7, -96.8],
                    [38.9, -96.7], [39.0, -96.5], [39.1, -96.2], [39.1, -95.9], [39.1, -95.6],
                    [39.1, -95.3], [39.1, -95.0], [39.1, -94.8], [39.1, -94.6], // Kansas City, MO
                    [39.2, -94.5], [39.3, -94.4], [39.5, -94.3], [39.7, -94.2], [39.9, -94.1],
                    [40.1, -94.0], [40.3, -93.9], [40.5, -93.9], [40.7, -93.8], [40.9, -93.8],
                    [41.1, -93.7], [41.3, -93.7], [41.5, -93.6], [41.6, -93.6], // Des Moines, IA
                    [41.8, -93.5], [42.0, -93.5], [42.2, -93.5], [42.4, -93.5], [42.6, -93.4],
                    [42.8, -93.4], [43.0, -93.4], [43.2, -93.4], [43.4, -93.3], [43.6, -93.3],
                    [43.8, -93.3], [44.0, -93.3], // Minneapolis, MN
                    [44.2, -93.2], [44.4, -93.1], [44.6, -93.0], [44.8, -92.9], [45.0, -92.7],
                    [45.2, -92.6], [45.4, -92.5], [45.6, -92.4], [45.8, -92.3], [46.0, -92.2],
                    [46.2, -92.2], [46.4, -92.1], [46.6, -92.1], [46.8, -92.1]   // Duluth, MN
                ]
            },            // I-70 (Central - Utah to Maryland)
            {
                name: 'Interstate 70',
                coords: [
                    [38.6, -109.5], // Green River, UT
                    [38.7, -109.2], [38.8, -109.0], [38.9, -108.8], [39.0, -108.6], // Grand Junction, CO
                    [39.1, -108.4], [39.2, -108.2], [39.2, -108.0], [39.3, -107.8], [39.4, -107.6],
                    [39.4, -107.4], [39.5, -107.2], [39.5, -107.0], [39.5, -106.8], [39.6, -106.6],
                    [39.6, -106.4], [39.6, -106.2], [39.6, -106.0], [39.7, -105.8], [39.7, -105.6],
                    [39.7, -105.4], [39.7, -105.2], [39.7, -105.0], // Denver, CO
                    [39.6, -104.8], [39.6, -104.6], [39.5, -104.4], [39.5, -104.2], [39.4, -104.0],
                    [39.4, -103.8], [39.3, -103.6], [39.3, -103.4], [39.2, -103.2], [39.2, -103.0],
                    [39.2, -102.8], [39.1, -102.6], [39.1, -102.4], [39.1, -102.2], [39.0, -102.0],
                    [39.0, -101.8], [39.0, -101.6], [39.0, -101.4], [39.0, -101.2], [39.0, -101.0],
                    [39.0, -100.8], [39.0, -100.6], [39.0, -100.4], [39.0, -100.2], [39.0, -100.0],
                    [39.0, -99.8], [39.0, -99.6], [39.0, -99.4], [39.0, -99.2], [39.0, -99.0],
                    [39.0, -98.8], [39.0, -98.6], [39.0, -98.4], [39.0, -98.2], [39.0, -98.0],
                    [39.0, -97.8], [39.0, -97.6], [39.0, -97.4], [39.0, -97.2], [39.0, -97.0],
                    [39.0, -96.8], [39.0, -96.6], [39.0, -96.4], [39.0, -96.2], [39.0, -96.0],
                    [39.0, -95.9], [39.0, -95.7], // Kansas City, KS
                    [39.0, -95.5], [39.0, -95.3], [39.0, -95.1], [39.0, -94.9], [39.0, -94.7],
                    [39.0, -94.6], // Kansas City, MO
                    [38.9, -94.4], [38.9, -94.2], [38.9, -94.0], [38.8, -93.8], [38.8, -93.6],
                    [38.7, -93.4], [38.7, -93.2], [38.7, -93.0], [38.7, -92.8], [38.6, -92.6],
                    [38.6, -92.4], [38.6, -92.2], [38.6, -92.0], [38.6, -91.8], [38.6, -91.6],
                    [38.6, -91.4], [38.6, -91.2], [38.6, -91.0], [38.6, -90.8], [38.6, -90.6],
                    [38.6, -90.4], [38.6, -90.2], // St. Louis, MO
                    [38.7, -90.0], [38.7, -89.8], [38.8, -89.6], [38.8, -89.4], [38.9, -89.2],
                    [38.9, -89.0], [39.0, -88.8], [39.0, -88.6], [39.1, -88.4], [39.2, -88.2],
                    [39.3, -88.0], [39.3, -87.8], [39.4, -87.6], [39.5, -87.4], [39.5, -87.2],
                    [39.6, -87.0], [39.7, -86.8], [39.7, -86.6], [39.8, -86.4], [39.8, -86.2],
                    [39.8, -86.1], // Indianapolis, IN
                    [39.8, -85.9], [39.8, -85.7], [39.8, -85.5], [39.8, -85.3], [39.8, -85.1],
                    [39.8, -84.9], [39.8, -84.7], [39.8, -84.5], [39.8, -84.3], [39.8, -84.2], // Dayton, OH
                    [39.8, -84.0], [39.8, -83.8], [39.8, -83.6], [39.8, -83.4], [39.9, -83.2],
                    [39.9, -83.0], [39.9, -82.9], // Columbus, OH
                    [39.9, -82.7], [39.9, -82.5], [39.9, -82.3], [40.0, -82.1], [40.0, -81.9],
                    [40.0, -81.7], [40.0, -81.5], [40.0, -81.3], [40.0, -81.1], [40.0, -80.9],
                    [40.0, -80.7], // Wheeling, WV
                    [39.9, -80.5], [39.9, -80.3], [39.8, -80.1], [39.7, -80.0], [39.6, -79.9], // Morgantown, WV
                    [39.6, -79.7], [39.6, -79.5], [39.6, -79.3], [39.6, -79.1], [39.6, -78.9],
                    [39.6, -78.8], // Cumberland, MD
                    [39.5, -78.6], [39.5, -78.4], [39.5, -78.2], [39.4, -78.0], [39.4, -77.9],
                    [39.3, -77.8], [39.3, -77.7]   // Frederick, MD
                ]
            },            // I-25 (Mountain - Wyoming to New Mexico)
            {
                name: 'Interstate 25',
                coords: [
                    [41.1, -104.8], // Cheyenne, WY
                    [41.0, -104.9], [40.9, -105.0], [40.8, -105.0], [40.7, -105.1], [40.6, -105.1], // Fort Collins, CO
                    [40.5, -105.1], [40.4, -105.0], [40.3, -105.0], [40.2, -105.0], [40.1, -105.0],
                    [40.0, -105.0], [39.9, -105.0], [39.8, -105.0], [39.7, -105.0], // Denver, CO
                    [39.6, -104.9], [39.5, -104.9], [39.4, -104.8], [39.3, -104.8], [39.2, -104.8],
                    [39.1, -104.8], [39.0, -104.8], [38.9, -104.8], [38.8, -104.8], // Colorado Springs, CO
                    [38.7, -104.8], [38.6, -104.8], [38.5, -104.9], [38.4, -104.9], [38.3, -104.9],
                    [38.2, -105.0], [38.1, -105.1], [38.0, -105.2], [37.9, -105.3], [37.8, -105.4],
                    [37.7, -105.5], [37.6, -105.6], [37.5, -105.7], [37.4, -105.8], [37.3, -105.9], // Trinidad, CO
                    [37.2, -105.8], [37.1, -105.7], [37.0, -105.6], [36.9, -105.5], [36.8, -105.3],
                    [36.7, -105.1], [36.7, -104.9], // Raton, NM
                    [36.6, -104.9], [36.5, -105.0], [36.4, -105.1], [36.3, -105.2], [36.2, -105.3],
                    [36.1, -105.4], [36.0, -105.5], [35.9, -105.6], [35.8, -105.7], [35.7, -105.9], // Santa Fe, NM
                    [35.6, -105.9], [35.5, -106.0], [35.4, -106.1], [35.3, -106.2], [35.2, -106.3],
                    [35.1, -106.5], [35.1, -106.6], // Albuquerque, NM
                    [35.0, -106.6], [34.9, -106.6], [34.8, -106.7], [34.7, -106.7], [34.6, -106.7],
                    [34.5, -106.7], [34.4, -106.8], [34.3, -106.8], [34.2, -106.8], [34.1, -106.9],
                    [34.0, -106.9], [33.9, -106.9], [33.8, -106.9], [33.7, -107.0], [33.6, -107.0],
                    [33.5, -107.0], [33.4, -107.0], // Socorro, NM
                    [33.3, -107.0], [33.2, -106.9], [33.1, -106.9], [33.0, -106.9], [32.9, -106.9],
                    [32.8, -106.9], [32.7, -106.8], [32.6, -106.8], [32.5, -106.8], [32.4, -106.8],
                    [32.3, -106.8]  // Las Cruces, NM
                ]
            }
        ];
    }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const tacoBellMap = new TacoBellMap();
    tacoBellMap.initialize();
});

// Initialize the map focused on Florida
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
    dragging: true,
    doubleClickZoom: true
}).setView([27.9944, -81.7603], 7); // Center on Florida

// Add OpenStreetMap satellite/terrain tiles
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
}).addTo(map);

// Function to interpolate color based on price
function getColorForPrice(price, minPrice, maxPrice) {
    // Handle edge case where all prices are the same
    if (maxPrice === minPrice) {
        return 'rgb(180, 180, 180)'; // Grey
    }
    
    // Normalize price to 0-1 range
    const normalized = (price - minPrice) / (maxPrice - minPrice);
    
    console.log(`Price: $${price}, Normalized: ${normalized.toFixed(2)}, Min: $${minPrice}, Max: $${maxPrice}`);
    
    // Grey (cheapest) to Red (most expensive)
    // Grey: rgb(180, 180, 180) -> Red: rgb(255, 0, 0)
    const r = Math.round(180 + (75 * normalized)); // 180 -> 255
    const g = Math.round(180 * (1 - normalized)); // 180 -> 0
    const b = Math.round(180 * (1 - normalized)); // 180 -> 0
    
    const color = `rgb(${r}, ${g}, ${b})`;
    console.log(`Color: ${color}`);
    return color;
}

// Load Florida locations with Classic Luxe Box pricing
async function loadFloridaHeatmap() {
    console.log('Loading Florida locations and menu data...');
    
    try {
        // Load all locations
        const locationsResponse = await fetch('Data/locations.json');
        const allLocations = await locationsResponse.json();
        
        // Filter for Florida locations
        const floridaLocations = allLocations.filter(loc => loc.state === 'FL');
        console.log(`Found ${floridaLocations.length} Florida locations`);
        
        // Process each location to get Classic Luxe Box price
        const heatmapData = [];
        
        for (const location of floridaLocations) {
            const storeNumber = location.store_number;
            const menuFile = `Menu/fl_${storeNumber}_menu.json`;
            
            try {
                const menuResponse = await fetch(menuFile);
                if (!menuResponse.ok) continue;
                
                const menuData = await menuResponse.json();
                
                // Search for Classic Luxe Box
                let price = null;
                for (const [category, items] of Object.entries(menuData.categories || {})) {
                    for (const item of items) {
                        if (item.name === 'Meal for 2') {
                            // Extract price from string like "$5.00"
                            const priceMatch = item.price.match(/\$?(\d+\.?\d*)/);
                            if (priceMatch) {
                                price = parseFloat(priceMatch[1]);
                            }
                            break;
                        }
                    }
                    if (price !== null) break;
                }
                
                if (price !== null) {
                    heatmapData.push({
                        ...location,
                        price: price
                    });
                }
            } catch (error) {
                // Menu file doesn't exist or error reading it
                continue;
            }
        }
          console.log(`Found ${heatmapData.length} locations with Classic Luxe Box pricing`);
        
        if (heatmapData.length === 0) {
            console.error('No pricing data found!');
            return;
        }
        
        // Find min and max prices
        const prices = heatmapData.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
          console.log(`Price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
        console.log('Sample prices:', prices.slice(0, 10));
          // Update legend with actual prices
        const legend = document.querySelector('.legend');
        legend.innerHTML = `
            <h4>Meal for 2 Price</h4>
            <div class="legend-item">
                <div class="legend-color" style="background: rgb(0, 0, 255);"></div>
                <div class="legend-label">$${minPrice.toFixed(2)} (Cheapest)</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgb(255, 128, 0);"></div>
                <div class="legend-label">$${((minPrice + maxPrice) / 2).toFixed(2)} (Mid)</div>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: rgb(255, 0, 0);"></div>
                <div class="legend-label">$${maxPrice.toFixed(2)} (Most Expensive)</div>
            </div>
            <div style="margin-top: 10px; font-size: 11px; color: #666;">
                Total locations: ${heatmapData.length}
            </div>
        `;
          // Create heatmap data with intensity based on price
        console.log('Creating heatmap...');
        
        // Check if L.heatLayer is available
        if (typeof L.heatLayer === 'undefined') {
            console.error('L.heatLayer is not defined! The leaflet-heat plugin may not have loaded.');
            alert('Heatmap plugin failed to load. Please refresh the page.');
            return;
        }
        
        const heatmapPoints = heatmapData.map((location, index) => {
            // Normalize price to 0-1 range for intensity
            const intensity = (location.price - minPrice) / (maxPrice - minPrice);
            
            if (index < 5) {
                console.log(`Point ${index}: Store ${location.store_number}, Price: $${location.price}, Intensity: ${intensity.toFixed(2)}`);
            }
            
            // Return [lat, lng, intensity] format for leaflet-heat
            // Higher intensity = more expensive (red)
            return [location.lat, location.lng, intensity];
        });
        
        console.log(`Total heatmap points: ${heatmapPoints.length}`);
        console.log('Sample points:', heatmapPoints.slice(0, 3));
          // Add heatmap layer with blue to red gradient
        const heatLayer = L.heatLayer(heatmapPoints, {
            radius: 30,
            blur: 40,
            maxZoom: 17,
            max: 1.0,
            minOpacity: 0.6,  // Increased opacity from 0.3 to 0.6
            gradient: {
                0.0: 'rgb(0, 0, 255)',      // Blue (cheapest)
                0.25: 'rgb(128, 0, 200)',   // Purple-ish
                0.5: 'rgb(255, 128, 0)',    // Orange (mid-range)
                0.75: 'rgb(255, 64, 0)',    // Red-orange
                1.0: 'rgb(255, 0, 0)'       // Red (most expensive)
            }
        });
        
        heatLayer.addTo(map);
        console.log('Heatmap layer added to map');
        
        // Optional: Add invisible markers for popups (click to see details)
        heatmapData.forEach((location) => {
            L.circleMarker([location.lat, location.lng], {
                radius: 6,
                fillColor: 'transparent',
                color: 'transparent',
                weight: 0,
                opacity: 0,
                fillOpacity: 0
            })
            .bindPopup(`
                <strong>Store #${location.store_number}</strong><br>
                ${location.county}<br>
                <strong>Meal for 2: $${location.price.toFixed(2)}</strong><br>
                <a href="${location.url}" target="_blank">View Details</a>
            `)
            .addTo(map);
        });
        
        console.log('Heatmap loaded successfully!');
        
    } catch (error) {
        console.error('Error loading heatmap:', error);
    }
}

// Load the heatmap
loadFloridaHeatmap();

class CSVParser {
    static parseCSVLine(line) {
        const matches = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
        if (!matches) return null;
        
        return matches.map(field => {
            field = field.replace(/^,/, '');
            if (field.startsWith('"') && field.endsWith('"')) {
                field = field.slice(1, -1).replace(/""/g, '"');
            }
            return field;
        });
    }

    static extractCoordinates(mapUrl) {
        if (!mapUrl) return null;
        
        const coordMatch = mapUrl.match(/destination=([-\d.]+),([-\d.]+)/);
        if (!coordMatch) return null;
        
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        return (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
    }

    static async loadLocations(csvPath) {
        try {
            const response = await fetch(csvPath);
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            const locations = [];
            
            for (let i = 1; i < lines.length; i++) {
                const fields = this.parseCSVLine(lines[i]);
                if (!fields || fields.length < 4) continue;
                
                const [storeId, location, page, mapUrl] = fields;
                const coords = this.extractCoordinates(mapUrl);
                
                if (coords) {
                    locations.push({
                        storeId,
                        location,
                        page,
                        mapUrl,
                        lat: coords.lat,
                        lng: coords.lng
                    });
                }
            }
            
            return locations;
        } catch (error) {
            console.error('Error loading locations:', error);
            return [];
        }
    }

    static async loadMenu(csvPath) {
        try {
            const response = await fetch(csvPath);
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            
            if (lines.length < 2) return { headers: [], data: [] };
            
            // Parse headers (menu items)
            const headers = this.parseCSVLine(lines[0]);
            const menuItems = headers.slice(1); // Skip store_id column
            
            // Parse data (store prices)
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const fields = this.parseCSVLine(lines[i]);
                if (!fields || fields.length < 2) continue;
                
                const storeId = fields[0];
                const prices = {};
                
                for (let j = 1; j < fields.length && j < headers.length; j++) {
                    const itemName = headers[j];
                    const priceStr = fields[j];
                    const price = priceStr && priceStr !== '' ? parseFloat(priceStr) : null;
                    if (price !== null && !isNaN(price)) {
                        prices[itemName] = price;
                    }
                }
                
                data.push({ storeId, prices });
            }
            
            return { headers: menuItems, data };
        } catch (error) {
            console.error('Error loading menu:', error);
            return { headers: [], data: [] };
        }
    }
}

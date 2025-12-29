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
}

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

    static async loadColleges(csvPath) {
        try {
            const response = await fetch(csvPath);
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            const colleges = [];
            
            for (let i = 1; i < lines.length; i++) {
                const fields = this.parseCSVLine(lines[i]);
                if (!fields || fields.length < 6) continue;
                
                const [name, lat, lng, students, city, state] = fields;
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lng);
                
                if (!isNaN(latitude) && !isNaN(longitude)) {
                    colleges.push({
                        name,
                        lat: latitude,
                        lng: longitude,
                        students: parseInt(students) || 0,
                        city,
                        state
                    });
                }
            }
            
            return colleges;
        } catch (error) {
            console.error('Error loading colleges:', error);
            return [];
        }
    }    static async loadCivics(csvPath) {
        try {
            // Mapping from state abbreviations to FIPS codes (for GeoJSON matching)
            const stateToFips = {
                'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
                'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
                'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
                'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
                'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
                'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
                'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
                'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
                'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
                'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
                'WY': '56'
            };
            
            const response = await fetch(csvPath);
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            const povertyData = {};
            
            for (let i = 1; i < lines.length; i++) {
                const fields = this.parseCSVLine(lines[i]);
                if (!fields || fields.length < 3) continue;
                
                const [stateCode, stateName, povertyRate] = fields;
                const rate = parseFloat(povertyRate);
                
                if (!isNaN(rate)) {
                    const fipsCode = stateToFips[stateCode];
                    if (fipsCode) {
                        povertyData[fipsCode] = {
                            name: stateName,
                            povertyRate: rate
                        };
                    }
                }
            }
            
            return povertyData;
        } catch (error) {
            console.error('Error loading civics:', error);
            return {};
        }
    }
}

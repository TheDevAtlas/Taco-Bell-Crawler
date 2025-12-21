import json
import os
import re

# Load all locations
with open('Data/locations.json', 'r', encoding='utf-8') as f:
    all_locations = json.load(f)

# Filter for Florida locations
florida_locations = [loc for loc in all_locations if loc['state'] == 'FL']
print(f"Found {len(florida_locations)} Florida locations")

# Create a list to store locations with pricing
heatmap_data = []

# Process each Florida location
for location in florida_locations:
    store_number = location['store_number']
    menu_file = f"Menu/fl_{store_number}_menu.json"
    
    if os.path.exists(menu_file):
        try:
            with open(menu_file, 'r', encoding='utf-8') as f:
                menu_data = json.load(f)
            
            # Search for Classic Luxe Box in all categories
            classic_luxe_price = None
            for category, items in menu_data.get('categories', {}).items():
                for item in items:
                    if item.get('name') == 'Classic Luxe Box':
                        price_str = item.get('price', '')
                        # Extract numeric price from string like "$5.00"
                        price_match = re.search(r'\$?(\d+\.?\d*)', price_str)
                        if price_match:
                            classic_luxe_price = float(price_match.group(1))
                        break
                if classic_luxe_price is not None:
                    break
            
            if classic_luxe_price is not None:
                heatmap_data.append({
                    'store_number': store_number,
                    'lat': location['lat'],
                    'lng': location['lng'],
                    'price': classic_luxe_price,
                    'county': location['county'],
                    'url': location['url']
                })
                print(f"Store {store_number}: ${classic_luxe_price}")
        except Exception as e:
            print(f"Error processing {menu_file}: {e}")

print(f"\nTotal stores with Classic Luxe Box pricing: {len(heatmap_data)}")

# Find min and max prices
if heatmap_data:
    prices = [item['price'] for item in heatmap_data]
    print(f"Price range: ${min(prices)} - ${max(prices)}")

# Save the heatmap data
with open('Data/florida_luxe_heatmap.json', 'w', encoding='utf-8') as f:
    json.dump(heatmap_data, f, indent=2)

print(f"\nSaved heatmap data to Data/florida_luxe_heatmap.json")

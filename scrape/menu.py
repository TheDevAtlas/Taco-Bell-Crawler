import requests
import csv
import os
import json
import re
from bs4 import BeautifulSoup

def load_first_location():
    """Load the first store from locations.csv"""
    if not os.path.exists('data/locations.csv'):
        print("Error: data/locations.csv not found!")
        return None
    
    with open('data/locations.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        # Get the first row
        for row in reader:
            return row
    
    return None

def fetch_menu_page(store_id):
    """Fetch the menu page for a given store ID"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    url = f"https://www.tacobell.com/food?store={store_id}"
    print(f"Fetching menu from: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error fetching page: {e}")
        return None

def parse_categories(html_content, store_id):
    """Parse the category data from the HTML content"""
    try:
        # Find the __NEXT_DATA__ script tag which contains all the menu data
        soup = BeautifulSoup(html_content, 'html.parser')
        next_data_script = soup.find('script', {'id': '__NEXT_DATA__'})
        
        if not next_data_script:
            print("Error: Could not find __NEXT_DATA__ script tag")
            return None
        
        # Parse the JSON data
        data = json.loads(next_data_script.string)
        
        # Navigate to the product categories
        product_categories = data.get('props', {}).get('pageProps', {}).get('productCategories', [])
        
        categories = []
        for category in product_categories:
            label = category.get('label', 'Unknown')
            slug = category.get('slug', '')
            subtitle = category.get('subtitle', '')
            
            # Build the full URL with store parameter
            if slug:
                url = f"https://www.tacobell.com{slug}?store={store_id}"
            else:
                url = ''
            
            categories.append({
                'name': label,
                'url': url,
                'description': subtitle
            })
        
        return categories
        
    except Exception as e:
        print(f"Error parsing category data: {e}")
        return None

def display_categories(categories):
    """Display all categories with their links"""
    if not categories:
        print("No categories found")
        return
    
    print("\n" + "="*80)
    print("TACO BELL MENU CATEGORIES")
    print("="*80 + "\n")
    
    for i, category in enumerate(categories, 1):
        print(f"{i}. {category['name']}")
        print(f"   Description: {category['description']}")
        print(f"   URL: {category['url']}")
        print()
    
    print("="*80)
    print(f"Total categories: {len(categories)}")
    print("="*80 + "\n")

def main():
    """Main function to fetch and display the menu categories"""
    # Load the first location
    location = load_first_location()
    
    if not location:
        print("No locations found in data/locations.csv")
        return
    
    store_id = location['store_id']
    location_name = location['location']
    
    print(f"\nProcessing store: {location_name}")
    print(f"Store ID: {store_id}\n")
    
    # Fetch the menu page
    html_content = fetch_menu_page(store_id)
    
    if not html_content:
        print("Failed to fetch menu page")
        return
    
    # Parse the categories
    categories = parse_categories(html_content, store_id)
    
    if not categories:
        print("Failed to parse categories")
        return
    
    # Display the categories
    display_categories(categories)

if __name__ == "__main__":
    main()

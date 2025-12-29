import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os

def clean_name(name):
    """Remove the count numbers in parentheses from names"""
    return re.sub(r'\(\d+\)$', '', name).strip()

def scrape_locations_from_state(state_url, state_name):
    """Scrape all location links from a state page"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(state_url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        directory_container = soup.find('div', class_='directory-container')
        
        locations = {}
        
        if directory_container:
            location_links = directory_container.find_all('a', class_='DirLinks')
            
            for link in location_links:
                location_name = clean_name(link.get_text(strip=True))
                location_url = f"https://locations.tacobell.com{link.get('href', '')}"
                locations[location_name] = location_url
        
        print(f"Found {len(locations)} locations in {state_name}")
        return locations
        
    except Exception as e:
        print(f"Error scraping {state_name}: {e}")
        return {}

def scrape_all_locations():
    """Loop through all states and scrape their locations"""
    # Load the states from data/states.json
    with open('data/states.json', 'r') as f:
        states = json.load(f)
    
    all_locations = {}
    
    # Loop through each state
    for state_name, state_url in states.items():
        clean_state = clean_name(state_name)
        print(f"\nScraping {clean_state}...")
        locations = scrape_locations_from_state(state_url, clean_state)
        all_locations[clean_state] = locations
          # Be polite and add a small delay between requests
        time.sleep(1)
    
    # Create data folder if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Save all locations to data/group.json
    with open('data/groups.json', 'w') as f:
        json.dump(all_locations, f, indent=2)
    
    total_count = sum(len(locs) for locs in all_locations.values())
    print(f"\nScraping complete! Total locations found: {total_count}")
    print(f"Data saved to data/group.json")

if __name__ == "__main__":
    scrape_all_locations()

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
import csv
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

def clean_name(name):
    """Remove the count numbers in parentheses from names"""
    return re.sub(r'\(\d+\)$', '', name).strip()

def get_store_id_from_page(store_page_url):
    """Visit a store page and extract the store ID from the 'Start Your Order' link"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(store_page_url, headers=headers)
        response.raise_for_status()
        
        # Search the raw HTML for store ID in the pattern store=XXXXXX
        # The store ID appears in the JSON-LD schema: "menu":"https://www.tacobell.com/food?store=019953"
        matches = re.findall(r'store=(\d+)', response.text)
        if matches:
            # Return the first match (should be the store ID)
            return matches[0]
        
        # If regex didn't work, try parsing with BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for the "Start Your Order" link
        order_link = soup.find('a', string=re.compile(r'start your order', re.IGNORECASE))
        
        # Also try finding by href pattern
        if not order_link:
            order_link = soup.find('a', href=re.compile(r'tacobell\.com/food\?store='))
        
        if order_link:
            href = str(order_link.get('href', ''))
            # Extract store ID from URL like "https://www.tacobell.com/food?store=019953"
            match = re.search(r'store=(\d+)', href)
            if match:
                return match.group(1)
        
        return None
        
    except Exception as e:
        return None

def scrape_locations_from_city(city_url, state_name, city_name):
    """Scrape all individual Taco Bell locations from a city page"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(city_url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        locations_data = []
        
        # Find all store links - they have the pattern ending in .html
        # Example: ../ak/anchorage/8825-old-seward-hwy.html
        all_links = soup.find_all('a', href=re.compile(r'\.html$'))
        
        # Filter to only store page links (not the same city page)
        # Store links appear twice: once as location name, once as "View Store Page"
        seen_hrefs = set()
        store_links = []
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Skip if already seen or if it's just "View Store Page" text
            if href in seen_hrefs:
                continue
                  # Store links are relative paths with multiple segments
            if href and href != '#' and href.count('/') >= 2:
                seen_hrefs.add(href)
                store_links.append(link)
        
        for store_link in store_links:
            try:
                href = store_link.get('href', '')
                
                # Convert relative URL to absolute
                if href.startswith('../'):
                    # ../ak/anchorage/store.html -> https://locations.tacobell.com/ak/anchorage/store.html
                    href = href.replace('../', '')
                    store_page_url = f"https://locations.tacobell.com/{href}"
                elif href.startswith('/'):
                    store_page_url = f"https://locations.tacobell.com{href}"
                elif not href.startswith('http'):
                    store_page_url = f"https://locations.tacobell.com/{href}"
                else:
                    store_page_url = href
                
                # Get location name from link text
                location_name = clean_name(store_link.get_text(strip=True))
                if not location_name or location_name == "View Store Page":
                    # Try to extract from URL
                    location_name = href.split('/')[-1].replace('.html', '').replace('-', ' ').title()
                
                # Find the "Get Directions" link for this store
                # Look for Google Maps link near this store link
                map_url = None
                parent = store_link.parent
                if parent:
                    # Search for Google Maps link in the parent or nearby elements
                    map_link = parent.find('a', href=re.compile(r'google\.com/maps'))
                    if not map_link:
                        # Try searching in grandparent
                        grandparent = parent.parent
                        if grandparent:
                            map_link = grandparent.find('a', href=re.compile(r'google\.com/maps'))
                    
                    if map_link:
                        map_url = map_link.get('href', '')
                
                # Visit the store page to get the store ID
                store_id = get_store_id_from_page(store_page_url)
                
                if store_id:
                    locations_data.append({
                        'store_id': store_id,
                        'location': f"{location_name}, {city_name}, {state_name}",
                        'page': store_page_url,
                        'map': map_url or ''
                    })
                
                # Be polite with rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                continue
        
        return locations_data
        
    except Exception as e:
        return []

def load_existing_locations():
    """Load existing locations from CSV if it exists"""
    if os.path.exists('data/locations.csv'):
        existing = []
        with open('data/locations.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing.append(row)
        return existing
    return []

def get_completed_groups(existing_locations):
    """Extract set of completed (state, city) tuples from existing locations"""
    completed = set()
    for loc in existing_locations:
        # Parse location string: "location_name, city, state"
        parts = loc['location'].rsplit(', ', 2)
        if len(parts) >= 2:
            city = parts[-2]
            state = parts[-1]
            completed.add((state, city))
    return completed

def save_locations(all_locations, lock):
    """Save all locations to CSV (thread-safe)"""
    with lock:
        with open('data/locations.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['store_id', 'location', 'page', 'map'])
            writer.writeheader()
            writer.writerows(all_locations)

def process_city(state_name, city_name, city_url, all_locations, lock, pbar):
    """Process a single city and update shared data structures"""
    try:
        locations = scrape_locations_from_city(city_url, state_name, city_name)
        
        # Thread-safe update of all_locations
        with lock:
            all_locations.extend(locations)
            total_count = len(all_locations)
        
        # Save progress after each group
        save_locations(all_locations, lock)
        
        # Update progress bar
        pbar.update(1)
        pbar.set_postfix({"Found": len(locations), "Total": total_count})
        
        # Be polite and add a small delay between city requests
        time.sleep(0.3)
        
        return True
        
    except Exception as e:
        pbar.update(1)
        return False

def scrape_all_taco_bell_locations():
    """Loop through all cities in groups.json and scrape individual locations with parallel processing"""
    # Load the groups from data/groups.json
    with open('data/groups.json', 'r') as f:
        groups = json.load(f)
    
    # Create data folder if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Load existing progress
    all_locations = load_existing_locations()
    completed_groups = get_completed_groups(all_locations)
    
    # Count total groups and groups to process
    total_groups = sum(len(cities) for cities in groups.values())
    
    if completed_groups:
        print(f"Resuming from previous run. Already completed {len(completed_groups)} groups.")
    
    # Create a list of tasks to process
    tasks = []
    for state_name, cities in groups.items():
        for city_name, city_url in cities.items():
            # Skip if already completed
            if (state_name, city_name) not in completed_groups:
                tasks.append((state_name, city_name, city_url))
    
    # Create a lock for thread-safe operations
    lock = threading.Lock()
    
    # Create progress bar
    pbar = tqdm(total=total_groups, desc="Scraping locations", unit="city", initial=len(completed_groups))
    
    # Process cities in parallel with 3 workers
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for state_name, city_name, city_url in tasks:
            future = executor.submit(
                process_city, 
                state_name, 
                city_name, 
                city_url, 
                all_locations, 
                lock, 
                pbar
            )
            futures.append(future)
        
        # Wait for all tasks to complete
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                pass
    
    pbar.close()
    
    print(f"\nScraping complete! Total locations found: {len(all_locations)}")
    print(f"Data saved to data/locations.csv")

if __name__ == "__main__":
    scrape_all_taco_bell_locations()

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import csv
import os
import json
import re
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm

# Create a global session with connection pooling and retries
def create_session():
    """Create a requests session with connection pooling and retries"""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.3,
        status_forcelist=[500, 502, 503, 504]
    )
    adapter = HTTPAdapter(
        max_retries=retry,
        pool_connections=100,
        pool_maxsize=100
    )
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session

# Create global session for reuse
SESSION = create_session()

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

def load_all_locations():
    """Load all stores from locations.csv"""
    if not os.path.exists('data/locations.csv'):
        print("Error: data/locations.csv not found!")
        return []
    
    locations = []
    with open('data/locations.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            locations.append(row)
    
    return locations

def load_processed_store_ids():
    """Load the list of store IDs that have already been processed"""
    csv_path = 'data/menu.csv'
    
    if not os.path.exists(csv_path):
        return set()
    
    processed_ids = set()
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'store_id' in row:
                    processed_ids.add(row['store_id'])
        
        return processed_ids
    except Exception as e:
        print(f"Warning: Could not read existing CSV: {e}")
        return set()

def load_existing_menu_data():
    """Load existing menu data from CSV if it exists"""
    csv_path = 'data/menu.csv'
    
    if not os.path.exists(csv_path):
        return [], set()
    
    try:
        existing_rows = []
        all_menu_items = set()
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            
            if fieldnames and len(fieldnames) > 1:
                # All columns except store_id are menu items
                all_menu_items = set(fieldnames[1:])
            
            for row in reader:
                existing_rows.append(row)
        
        return existing_rows, all_menu_items
    except Exception as e:
        print(f"Warning: Could not read existing CSV: {e}")
        return [], set()

def fetch_menu_page(store_id):
    """Fetch the menu page for a given store ID"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    url = f"https://www.tacobell.com/food?store={store_id}"
    
    try:
        response = SESSION.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except Exception as e:
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

def fetch_category_page(category):
    """Fetch the HTML content for a single category page"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    category_name = category['name']
    category_url = category['url']
    
    try:
        response = SESSION.get(category_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        return {
            'category': category,
            'html': response.text,
            'success': True,
            'error': None
        }
        
    except requests.exceptions.HTTPError as e:
        return {
            'category': category,
            'html': None,
            'success': False,
            'error': str(e)
        }
    except requests.exceptions.Timeout:
        return {
            'category': category,
            'html': None,
            'success': False,
            'error': 'Timeout'
        }
    except Exception as e:
        return {
            'category': category,
            'html': None,
            'success': False,
            'error': str(e)
        }

def fetch_all_categories_parallel(categories, max_workers=5):
    """Fetch all category pages in parallel"""
    results = []
    
    # Use ThreadPoolExecutor to fetch pages in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all fetch tasks
        future_to_category = {
            executor.submit(fetch_category_page, category): category 
            for category in categories
        }
        
        # Process completed tasks as they finish
        for future in as_completed(future_to_category):
            result = future.result()
            results.append(result)
    
    return results

def parse_menu_items(html_content, category_name=''):
    """Parse menu items, prices, and image URLs from HTML content"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        next_data_script = soup.find('script', {'id': '__NEXT_DATA__'})
        
        if not next_data_script:
            return []
        
        data = json.loads(next_data_script.string)
        
        # Navigate to products in the page data
        products = data.get('props', {}).get('pageProps', {}).get('products', [])
        
        menu_items = []
        for product in products:
            name = product.get('name', '')
            # Price is in the price object
            price_obj = product.get('price', {})
            
            # Image URL - try different possible locations
            image_url = None
            if 'image' in product:
                if isinstance(product['image'], dict):
                    image_url = product['image'].get('url') or product['image'].get('src')
                elif isinstance(product['image'], str):
                    image_url = product['image']
            
            # Also try 'imageUrl' or 'images' fields
            if not image_url:
                image_url = product.get('imageUrl') or product.get('img')
                if not image_url and 'images' in product:
                    images = product['images']
                    if isinstance(images, list) and len(images) > 0:
                        if isinstance(images[0], dict):
                            image_url = images[0].get('url') or images[0].get('src')
                        else:
                            image_url = images[0]
            
            if name and price_obj and isinstance(price_obj, dict):
                price = price_obj.get('value')
                if price is not None:
                    menu_items.append({
                        'name': name,
                        'price': float(price),
                        'image_url': image_url,
                        'category': category_name
                    })
        
        return menu_items
        
    except Exception as e:
        return []

def parse_all_menu_items_parallel(category_results):
    """Parse menu items from all category results in parallel"""
    all_items = {}
    
    def parse_result(result):
        if not result['success'] or not result['html']:
            return []
        
        category_name = result['category'].get('name', '')
        items = parse_menu_items(result['html'], category_name)
        return items
    
    # Parse all results in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(parse_result, result) for result in category_results]
        
        for future in as_completed(futures):
            items = future.result()
            # Add items to dictionary (item name -> {price, image_url, category})
            for item in items:
                # If item already exists, keep the first one we found
                if item['name'] not in all_items:
                    all_items[item['name']] = {
                        'price': item['price'],
                        'image_url': item.get('image_url'),
                        'category': item.get('category', '')
                    }
    

    return all_items

def download_image(url, filepath):
    """Download an image from a URL and save it to filepath"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = SESSION.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        return True
    except Exception as e:
        return False

def sanitize_filename(name):
    """Sanitize a string to be used as a filename"""
    # Remove or replace invalid characters
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    
    # Remove leading/trailing spaces and periods
    name = name.strip('. ')
    
    # Limit length
    if len(name) > 200:
        name = name[:200]
    
    return name

def save_menu_item_images(menu_items):
    """Download and save images for all menu items"""
    # Create images directory structure
    images_dir = 'images'
    os.makedirs(images_dir, exist_ok=True)
    
    # Track statistics
    downloaded = 0
    skipped = 0
    failed = 0
    
    def download_task(item_name, item_data):
        nonlocal downloaded, skipped, failed
        
        image_url = item_data.get('image_url')
        category = item_data.get('category', 'uncategorized')
        
        if not image_url:
            skipped += 1
            return False
        
        # Create category folder
        category_dir = os.path.join(images_dir, sanitize_filename(category))
        os.makedirs(category_dir, exist_ok=True)
        
        # Determine file extension from URL
        ext = '.jpg'  # default
        if '.' in image_url:
            url_ext = image_url.split('.')[-1].split('?')[0].lower()
            if url_ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                ext = '.' + url_ext
        
        # Create filename from item name
        filename = sanitize_filename(item_name) + ext
        filepath = os.path.join(category_dir, filename)
        
        # Skip if already exists
        if os.path.exists(filepath):
            skipped += 1
            return True
        
        # Download the image
        if download_image(image_url, filepath):
            downloaded += 1
            return True
        else:
            failed += 1
            return False
    
    # Download images in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(download_task, item_name, item_data)
            for item_name, item_data in menu_items.items()
        ]
        
        for future in as_completed(futures):
            future.result()
    
    return downloaded, skipped, failed

def write_menu_csv(store_id, menu_items):
    """Write menu items to CSV file"""
    if not menu_items:
        print("No menu items to write")
        return
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    csv_path = 'data/menu.csv'
    
    # Sort items by name for consistent ordering
    sorted_items = sorted(menu_items.items())
    
    # Prepare headers and data row
    headers = ['store_id'] + [item_name for item_name, _ in sorted_items]
    data_row = [store_id] + [price for _, price in sorted_items]
    
    print("\n" + "="*80)
    print("WRITING MENU CSV")
    print("="*80)
    print(f"Output file: {csv_path}")
    print(f"Total columns: {len(headers)}")
    print(f"Store ID: {store_id}")
    print(f"Menu items: {len(menu_items)}")
    
    try:
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerow(data_row)
        
        print(f"✓ Successfully wrote menu data to {csv_path}")
        print("="*80 + "\n")
        
        # Display sample of items
        print("Sample menu items (first 10):")
        for i, (item_name, price) in enumerate(sorted_items[:10], 1):
            print(f"  {i}. {item_name}: ${price:.2f}")
        
        if len(sorted_items) > 10:
            print(f"  ... and {len(sorted_items) - 10} more items")
        print()
        
    except Exception as e:
        print(f"✗ Error writing CSV: {e}")
        print("="*80 + "\n")

def fetch_and_parse_store(location):
    """Fetch and parse the main menu page for a store"""
    store_id = location['store_id']
    location_name = location['location']
    
    try:
        html_content = fetch_menu_page(store_id)
        if not html_content:
            return {
                'store_id': store_id,
                'location': location_name,
                'success': False
            }
        
        categories = parse_categories(html_content, store_id)
        if not categories:
            return {
                'store_id': store_id,
                'location': location_name,
                'success': False
            }
        
        return {
            'store_id': store_id,
            'location': location_name,
            'categories': categories,
            'success': True
        }
        
    except Exception as e:
        return {
            'store_id': store_id,
            'location': location_name,
            'success': False
        }

def process_batch_fully_parallel(batch):
    """Process a batch of stores with fully parallel category fetching"""
    all_store_categories = {}
    
    # Step 1: Fetch main menu pages for all stores in parallel
    with ThreadPoolExecutor(max_workers=len(batch)) as executor:
        future_to_store = {
            executor.submit(fetch_and_parse_store, location): location
            for location in batch
        }
        
        for future in as_completed(future_to_store):
            location = future_to_store[future]
            result = future.result()
            if result['success']:
                all_store_categories[result['store_id']] = result
    
    # Step 2: Collect all category URLs from all stores
    all_category_tasks = []
    for store_id, store_data in all_store_categories.items():
        for category in store_data['categories']:
            all_category_tasks.append({
                'store_id': store_id,
                'category': category
            })
    
    # Step 3: Fetch ALL category pages in parallel (across all stores)
    category_results = {}
    with ThreadPoolExecutor(max_workers=50) as executor:
        future_to_task = {
            executor.submit(fetch_category_page, task['category']): task
            for task in all_category_tasks
        }
        
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            result = future.result()
            store_id = task['store_id']
            
            if store_id not in category_results:
                category_results[store_id] = []
            category_results[store_id].append(result)
    
    # Step 4: Parse menu items for each store
    batch_results = []
    all_batch_items = {}
    
    for store_id, store_data in all_store_categories.items():
        store_category_results = category_results.get(store_id, [])
        menu_items = parse_all_menu_items_parallel(store_category_results)
        
        # Collect all unique items from this batch for image downloading
        for item_name, item_data in menu_items.items():
            if item_name not in all_batch_items and item_data.get('image_url'):
                all_batch_items[item_name] = item_data
        
        batch_results.append({
            'store_id': store_id,
            'location': store_data['location'],
            'menu_items': menu_items,
            'success': True
        })
    
    # Download images for all unique items in this batch
    if all_batch_items:
        save_menu_item_images(all_batch_items)
    
    return batch_results

def process_single_store(location):
    """Process a single store and return its menu items"""
    store_id = location['store_id']
    location_name = location['location']
    
    print(f"\n{'='*80}")
    print(f"Processing: {location_name} (Store ID: {store_id})")
    print(f"{'='*80}")
    
    try:
        # Fetch the menu page
        html_content = fetch_menu_page(store_id)
        if not html_content:
            print(f"✗ Failed to fetch menu page for {store_id}")
            return {
                'store_id': store_id,
                'location': location_name,
                'menu_items': {},
                'success': False
            }
        
        # Parse the categories
        categories = parse_categories(html_content, store_id)
        if not categories:
            print(f"✗ Failed to parse categories for {store_id}")
            return {
                'store_id': store_id,
                'location': location_name,
                'menu_items': {},
                'success': False
            }
        
        print(f"Found {len(categories)} categories")
        
        # Fetch all category pages in parallel
        category_results = fetch_all_categories_parallel(categories, max_workers=5)
        
        # Parse all menu items in parallel
        menu_items = parse_all_menu_items_parallel(category_results)
        
        print(f"✓ Successfully processed {store_id}: {len(menu_items)} unique items")
        
        return {
            'store_id': store_id,
            'location': location_name,
            'menu_items': menu_items,
            'success': True
        }
        
    except Exception as e:
        print(f"✗ Error processing store {store_id}: {e}")
        return {
            'store_id': store_id,
            'location': location_name,
            'menu_items': {},
            'success': False
        }

def process_stores_in_batches(locations, batch_size=5):
    """Process all stores in batches, saving after each batch"""
    # Load only menu items (not all rows) to track what columns exist
    _, existing_items = load_existing_menu_data()
    current_menu_items = existing_items
    
    # Calculate total batches
    total_batches = (len(locations) + batch_size - 1) // batch_size
    
    # Process stores in batches with main progress bar
    with tqdm(total=total_batches, desc="Processing batches", unit="batch") as pbar:
        for i in range(0, len(locations), batch_size):
            batch = locations[i:i+batch_size]
            
            # Process batch with fully parallelized category fetching
            batch_results = process_batch_fully_parallel(batch)
            
            # Check if new menu items were discovered
            batch_menu_items = set()
            for result in batch_results:
                if result['success']:
                    batch_menu_items.update(result['menu_items'].keys())
            
            new_items_found = batch_menu_items - current_menu_items
            
            # Save CSV after each batch
            if new_items_found:
                # New columns found - need to rewrite entire CSV
                existing_rows, _ = load_existing_menu_data()
                current_menu_items = write_comprehensive_menu_csv(batch_results, existing_rows, current_menu_items)
            else:
                # No new columns - just append new rows
                current_menu_items = append_to_menu_csv(batch_results, current_menu_items)
            
            pbar.update(1)

def append_to_menu_csv(store_results, existing_items):
    """Append new store rows to CSV without rewriting entire file"""
    if not store_results:
        return existing_items
    
    csv_path = 'data/menu.csv'
    
    if not os.path.exists(csv_path):
        # If CSV doesn't exist, create it with these results
        return write_comprehensive_menu_csv(store_results, None, existing_items)
    
    # Sort menu items alphabetically for consistent ordering
    sorted_menu_items = sorted(existing_items)
    
    try:
        # Append new rows to existing CSV
        with open(csv_path, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            for result in store_results:
                if result['success']:
                    # Build row with prices or empty string for missing items
                    row = [result['store_id']]
                    for item_name in sorted_menu_items:
                        item_data = result['menu_items'].get(item_name)
                        # Extract price from nested dictionary
                        if item_data:
                            price = item_data.get('price') if isinstance(item_data, dict) else item_data
                        else:
                            price = None
                        row.append(price if price is not None else '')
                    writer.writerow(row)
        
        return set(existing_items)  # Ensure we return a set
        
    except Exception as e:
        print(f"Error appending to CSV: {e}")
        return set(existing_items)

def write_comprehensive_menu_csv(store_results, existing_rows=None, existing_items=None):
    """Write comprehensive CSV with all stores and all menu items"""
    if not store_results and not existing_rows:
        print("No store results to write")
        return
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    csv_path = 'data/menu.csv'
    
    # Start with existing menu items if any
    all_menu_items = set(existing_items) if existing_items else set()
    
    # Add new menu items from current batch
    for result in store_results:
        if result['success']:
            # menu_items is now a dict of {name: {price, image_url, category}}
            all_menu_items.update(result['menu_items'].keys())
    
    # Sort menu items alphabetically for consistent ordering
    sorted_menu_items = sorted(all_menu_items)
    
    # Prepare headers
    headers = ['store_id'] + sorted_menu_items
    
    # Start with existing rows, updated with new columns if needed
    rows = []
    if existing_rows:
        for existing_row in existing_rows:
            row = [existing_row['store_id']]
            for item_name in sorted_menu_items:
                # Use existing value or empty string for new items
                price = existing_row.get(item_name, '')
                row.append(price)
            rows.append(row)
    
    # Add new rows from current batch
    successful_stores = 0
    failed_stores = 0
    
    for result in store_results:
        if result['success']:
            successful_stores += 1
            # Build row with prices or empty string for missing items
            row = [result['store_id']]
            for item_name in sorted_menu_items:
                item_data = result['menu_items'].get(item_name)
                # Extract price from nested dictionary
                if item_data:
                    price = item_data.get('price') if isinstance(item_data, dict) else item_data
                else:
                    price = None
                row.append(price if price is not None else '')
            rows.append(row)
        else:
            failed_stores += 1
    
    try:
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        
        return all_menu_items  # Return set, not sorted list
        
    except Exception as e:
        return existing_items if existing_items else set()

def main():
    """Main function to fetch and display the menu categories"""
    # Load all locations
    all_locations = load_all_locations()
    
    if not all_locations:
        print("No locations found in data/locations.csv")
        return
    
    print(f"\nFound {len(all_locations)} total locations")
    
    # Check for already processed stores
    processed_store_ids = load_processed_store_ids()
    
    if processed_store_ids:
        print(f"Found {len(processed_store_ids)} already processed stores")
        print(f"Resuming from where we left off...\n")
        
        # Filter out already processed stores
        locations_to_process = [loc for loc in all_locations if loc['store_id'] not in processed_store_ids]
        
        print(f"Remaining stores to process: {len(locations_to_process)}")
        
        if not locations_to_process:
            print("\nAll stores have already been processed!")
            return
    else:
        print("Starting fresh - no existing data found\n")
        locations_to_process = all_locations
    
    # Process remaining stores in batches
    process_stores_in_batches(locations_to_process, batch_size=1)
    
    print("\n" + "="*80)
    print("PROCESSING COMPLETE!")
    print("="*80)

if __name__ == "__main__":
    main()

import requests
from bs4 import BeautifulSoup
import json
import re
import os

def clean_name(name):
    """Remove the count numbers in parentheses from names"""
    return re.sub(r'\(\d+\)$', '', name).strip()

def scrape_states():
    url = "https://locations.tacobell.com/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    print("Fetching states from Taco Bell website...")
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    directory_container = soup.find('div', class_='directory-container')
    
    states = {}
    
    if directory_container:
        state_links = directory_container.find_all('a', class_='DirLinks')
        
        for link in state_links:
            state_name = clean_name(link.get_text(strip=True))
            state_url = f"https://locations.tacobell.com/{link.get('href', '')}"
            states[state_name] = state_url
          print(f"Found {len(states)} states")
    
    # Create data folder if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    with open('data/states.json', 'w') as f:
        json.dump(states, f, indent=2)
    
    print("States saved to data/states.json")

if __name__ == "__main__":
    scrape_states()

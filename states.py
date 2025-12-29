import requests
from bs4 import BeautifulSoup
import json

def scrape_states():
    url = "https://locations.tacobell.com/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    directory_container = soup.find('div', class_='directory-container')
    
    states = {}
    
    if directory_container:
        state_links = directory_container.find_all('a', class_='DirLinks')
        
        for link in state_links:
            state_name = link.get_text(strip=True)
            state_url = f"https://locations.tacobell.com/{link.get('href', '')}"
            states[state_name] = state_url
    
    with open('states.json', 'w') as f:
        json.dump(states, f, indent=2)

if __name__ == "__main__":
    scrape_states()

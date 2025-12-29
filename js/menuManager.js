class MenuManager {
    constructor() {
        this.menuData = null;
        this.categories = [];
        this.currentCategory = null;
        this.order = {}; // { itemName: quantity }
    }

    async initialize() {
        await this.loadMenuData();
        await this.loadCategories();
        this.renderCategories();
        
        // Load first category by default
        if (this.categories.length > 0) {
            this.selectCategory(this.categories[0]);
        }
    }

    async loadMenuData() {
        this.menuData = await CSVParser.loadMenu('data/menu.csv');
    }

    async loadCategories() {
        try {
            // Use fallback approach - define items for each category
            const categoryFolders = [
                'Tacos',
                'Burritos',
                'Quesadillas',
                'Specialties',
                'Nachos',
                'Bowls',
                'Sides & Sweets',
                'Drinks',
                'Breakfast',
                'Combos & Boxes',
                'Cravings Value Menu',
                'Cantina Chicken Menu',
                'Veggie Cravings',
                'Best Sellers',
                'New',
                'Online Exclusives',
                'Member Exclusives',
                'Groups'
            ];

            for (const category of categoryFolders) {
                const items = this.getItemsForCategoryFallback(category);
                if (items.length > 0) {
                    this.categories.push({ name: category, items });
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    getItemsForCategoryFallback(category) {
        const categoryMap = {
            'Tacos': [
                'Soft Taco', 'Crunchy Taco', 'Soft Taco Supreme®', 'Crunchy Taco Supreme®',
                'Nacho Cheese Doritos® Locos Tacos', 'Nacho Cheese Doritos® Locos Tacos Supreme®',
                'Chalupa Supreme', 'Chalupa Supreme®', 'Black Bean Chalupa Supreme', 'Black Bean Chalupa Supreme®', 
                'Cheesy Gordita Crunch', 'Doritos® Cheesy Gordita Crunch - Nacho Cheese', 'Double Stacked Taco',
                'Spicy Potato Soft Taco', 'Cantina Chicken Soft Taco', 'Cantina Chicken Crispy Taco',
                'Avocado Ranch Crispy Chicken Soft Taco', 'Creamy Chipotle Crispy Chicken Soft Taco',
                'Frank\'s RedHot® Diablo Crispy Chicken Soft Taco'
            ],
            'Burritos': [
                'Bean Burrito', 'Burrito Supreme®', 'Beefy 5-Layer Burrito', 'Cheesy Bean and Rice Burrito',
                'Cheesy Double Beef Burrito', 'Grilled Cheese Burrito', 'Quesarito', 'Chicken Enchilada Burrito',
                'Black Bean Grilled Cheese Burrito - Black Beans', 'Cantina Chicken Burrito',
                'Avocado Ranch Crispy Chicken Burrito', 'Creamy Chipotle Crispy Chicken Burrito',
                'Frank\'s RedHot® Diablo Crispy Chicken Burrito', 'Slow Roasted Chicken Cheesy Dipping Burritos',
                'Steak Cheesy Dipping Burritos'
            ],
            'Quesadillas': [
                'Cheese Quesadilla', 'Chicken Quesadilla', 'Steak Quesadilla',
                'Cantina Chicken Quesadilla', 'Steak & Poblano Rolled Quesadilla'
            ],
            'Specialties': [
                'Crunchwrap Supreme®', 'Black Bean Crunchwrap Supreme®', 'Mexican Pizza',
                'Veggie Mexican Pizza'
            ],
            'Nachos': [
                'Nachos BellGrande®', 'Chips and Nacho Cheese Sauce', 'Chips and Guacamole',
                'Loaded Beef Nachos', 'Nacho Fries', 'Large Nacho Fries', 'Steak Garlic Nacho Fries',
                'Frank\'s RedHot® Diablo Chicken Nacho Fries'
            ],
            'Bowls': [
                'Cantina Chicken Bowl', 'Veggie Bowl'
            ],
            'Sides & Sweets': [
                'Cheesy Fiesta Potatoes', 'Cheesy Roll Up', 'Black Beans', 'Black Beans and Rice',
                'Pintos N Cheese', 'Cinnamon Twists', 'Cinnabon Delights® 2 Pack',
                'Cinnabon Delights® 12 Pack', 'Hash Brown'
            ],
            'Drinks': [
                'Pepsi®', 'Diet Pepsi®', 'Pepsi® Zero Sugar', 'MTN DEW®', 'MTN DEW® Baja Blast®',
                'MTN DEW® Baja Blast™ Zero Sugar', 'MTN DEW® Zero', 'Dr Pepper®', 'Diet Dr Pepper®',
                'Starry®', 'Mug® Root Beer', 'Cherry Pepsi®', 'Brisk® Mango Fiesta', 'Lipton® Sweet Tea',
                'Lipton® Unsweetened Iced Tea', 'Tropicana® Original Lemonade', 'Tropicana® Orange Juice',
                'Aquafina® Bottled Water', 'Milk', 'MTN DEW® Baja Blast® Freeze', 'Wild Strawberry Freeze',
                'Blue Raspberry Freeze', 'Strawberry Vanilla Cream Soda Freeze', 'Vanilla Cream Soda Freeze',
                'Confetti Cookie Freeze', 'Mountain Dew Baja Midnight™', 'Dragonfruit Agua Refresca',
                'Dragonfruit Berry Agua Refresca', 'Mango Peach Agua Refresca', 'Strawberry Passionfruit Agua Refresca',
                'Premium Hot Coffee', 'Regular Iced Coffee', 'Hot Cinnabon Delights® Coffee',
                'Iced Cinnabon Delights® Coffee', 'Pineapple Lime Rockstar® Energy Refresca',
                'Tropical Punch Rockstar® Energy Refresca', 'G2 Gatorade® Fruit Punch'
            ],
            'Breakfast': [
                'Breakfast Crunchwrap Bacon', 'Breakfast Crunchwrap Sausage', 'Breakfast California Crunchwrap',
                'Breakfast Quesadilla Bacon', 'Breakfast Quesadilla Sausage', 'Breakfast Quesadilla Steak',
                'Cheesy Toasted Breakfast Burrito Bacon', 'Cheesy Toasted Breakfast Burrito Sausage',
                'Cheesy Toasted Breakfast Burrito Potato', 'Grande Toasted Breakfast Burrito Bacon',
                'Grande Toasted Breakfast Burrito Sausage', 'Grande Toasted Breakfast Burrito Steak'
            ],
            'Combos & Boxes': [
                '3 Crunchy Tacos Combo', '3 Crunchy Tacos Supreme Combo', '3 Crunchy Tacos Supreme® Combo',
                '3 Soft Tacos Combo', '3 Soft Tacos Supreme® Combo', '3 Doritos® Locos Tacos Combo',
                '3 Doritos® Locos Tacos Supreme Combo', '2 Chicken Chalupas Supreme Combo',
                'Chicken Quesadilla Combo', 'Crunchwrap Supreme® Combo', 'Nachos BellGrande® Combo',
                'Mexican Pizza Combo', 'Burrito Supreme® Combo', 'Steak Grilled Cheese Burrito Combo',
                'Cantina Chicken Burrito Meal', 'Cantina Chicken Quesadilla Meal', 'Cantina Chicken Crispy Taco Meal',
                'Breakfast Crunchwrap Combo', 'Breakfast Quesadilla Combo', 'Grande Toasted Breakfast Burrito Combo',
                'Classic Luxe Box', 'Supreme Luxe Box', 'Discovery Luxe Box', 'Build Your Own Luxe Cravings Box',
                'Taco Party Pack', 'Soft Taco Party Pack', 'Supreme Taco Party Pack',
                'Supreme Soft Taco Party Pack', 'Variety Taco Party Pack', 'Supreme Variety Taco Party Pack',
                'Taco & Burrito Cravings Pack', 'Meal for 2', 'Meal for 4', 'Veggie Meal for 2',
                'Drinks Party Pack'
            ],
            'Cravings Value Menu': [
                'Cheesy Roll Up', 'Spicy Potato Soft Taco', 'Cheesy Bean and Rice Burrito',
                'Cinnamon Twists', '3 Cheese Chicken Flatbread Melt', 'Classic Stacker'
            ],
            'Cantina Chicken Menu': [
                'Cantina Chicken Bowl', 'Cantina Chicken Burrito', 'Cantina Chicken Quesadilla',
                'Cantina Chicken Soft Taco', 'Cantina Chicken Crispy Taco', 'Cantina Chicken Burrito Meal',
                'Cantina Chicken Quesadilla Meal', 'Cantina Chicken Crispy Taco Meal'
            ],
            'Veggie Cravings': [
                'Black Bean Chalupa Supreme', 'Black Bean Chalupa Supreme®', 'Black Bean Crunchwrap Supreme®',
                'Black Bean Grilled Cheese Burrito - Black Beans', 'Spicy Potato Soft Taco',
                'Veggie Mexican Pizza', 'Veggie Bowl', 'Veggie Meal for 2'
            ],
            'Best Sellers': [
                'Crunchwrap Supreme®', 'Cheesy Gordita Crunch', 'Beefy 5-Layer Burrito',
                'Nachos BellGrande®', 'Mexican Pizza', 'Crunchy Taco', 'Soft Taco'
            ],
            'New': [],
            'Online Exclusives': [],
            'Member Exclusives': [],
            'Groups': []
        };

        const items = [];
        const categoryItems = categoryMap[category] || [];
        
        categoryItems.forEach(itemName => {
            if (this.menuData.headers.includes(itemName)) {
                // Try both .jpg and .png extensions
                const imagePath = `images/${category}/${encodeURIComponent(itemName)}.jpg`;
                items.push({
                    name: itemName,
                    category: category,
                    imagePath: imagePath
                });
            }
        });

        return items;
    }

    renderCategories() {
        const container = document.getElementById('categorySelector');
        container.innerHTML = '';

        this.categories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = category.name;
            btn.addEventListener('click', () => this.selectCategory(category));
            container.appendChild(btn);
        });
    }

    selectCategory(category) {
        this.currentCategory = category;
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === category.name);
        });
        
        this.renderMenuItems();
    }

    renderMenuItems() {
        const container = document.getElementById('menuItems');
        container.innerHTML = '';

        if (!this.currentCategory) return;

        this.currentCategory.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'menu-item';
            
            const quantity = this.order[item.name] || 0;
            
            itemEl.innerHTML = `
                <img src="${item.imagePath}" alt="${item.name}" class="menu-item-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22%23333%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23666%22 font-size=%2212%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                <div class="menu-item-info">
                    <h4 class="menu-item-name">${item.name}</h4>
                    <div class="menu-item-counter">
                        <button class="counter-btn" onclick="menuManager.decrementItem('${item.name.replace(/'/g, "\\'")}')">−</button>
                        <span class="counter-value">${quantity}</span>
                        <button class="counter-btn" onclick="menuManager.incrementItem('${item.name.replace(/'/g, "\\'")}')">+</button>
                    </div>
                </div>
            `;
            
            container.appendChild(itemEl);
        });
    }

    incrementItem(itemName) {
        this.order[itemName] = (this.order[itemName] || 0) + 1;
        this.updateUI();
    }

    decrementItem(itemName) {
        if (this.order[itemName] > 0) {
            this.order[itemName]--;
            if (this.order[itemName] === 0) {
                delete this.order[itemName];
            }
            this.updateUI();
        }
    }

    updateUI() {
        // Update counter display in menu items
        this.renderMenuItems();
        
        // Update order summary
        this.renderOrderSummary();
        
        // Update pricing
        this.calculateAndDisplayPricing();
    }

    renderOrderSummary() {
        const orderList = document.getElementById('orderList');
        const orderItems = Object.entries(this.order).filter(([_, qty]) => qty > 0);
        
        if (orderItems.length === 0) {
            orderList.innerHTML = '<p class="empty-order">No items in order</p>';
            return;
        }
        
        orderList.innerHTML = orderItems.map(([itemName, quantity]) => `
            <div class="order-item">
                <span class="order-item-name">${itemName}</span>
                <span class="order-item-quantity">×${quantity}</span>
            </div>
        `).join('');
    }

    calculateAndDisplayPricing() {
        const orderItems = Object.entries(this.order).filter(([_, qty]) => qty > 0);
        const pricingContainer = document.getElementById('orderPricing');
        
        if (orderItems.length === 0) {
            pricingContainer.style.display = 'none';
            return;
        }
        
        pricingContainer.style.display = 'block';
        
        // Calculate total prices per location
        const locationPrices = {};
        
        this.menuData.data.forEach(storeData => {
            let totalPrice = 0;
            let hasAllItems = true;
            
            orderItems.forEach(([itemName, quantity]) => {
                if (storeData.prices[itemName] !== undefined) {
                    totalPrice += storeData.prices[itemName] * quantity;
                } else {
                    hasAllItems = false;
                }
            });
            
            if (hasAllItems) {
                locationPrices[storeData.storeId] = totalPrice;
            }
        });
        
        const prices = Object.values(locationPrices);
        
        if (prices.length === 0) {
            document.getElementById('minPrice').textContent = 'N/A';
            document.getElementById('avgPrice').textContent = 'N/A';
            document.getElementById('maxPrice').textContent = 'N/A';
            return;
        }
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        document.getElementById('minPrice').textContent = `$${minPrice.toFixed(2)}`;
        document.getElementById('avgPrice').textContent = `$${avgPrice.toFixed(2)}`;
        document.getElementById('maxPrice').textContent = `$${maxPrice.toFixed(2)}`;
        
        // Store for use by map coloring
        this.locationPrices = locationPrices;
    }

    getLocationPriceForColoring(storeId) {
        return this.locationPrices?.[storeId] || null;
    }
}

// Global instance
let menuManager;

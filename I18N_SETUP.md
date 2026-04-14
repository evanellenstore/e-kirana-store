# I18n Translation Guide

This guide explains how to use the internationalization (i18n) system in the e-Kirana Store application to support multiple languages (English and Hindi).

## Setup

The i18n system is configured using:
- **i18next**: Core internationalization framework
- **react-i18next**: React bindings for i18next
- **Translation files**: JSON files in `src/i18n/locales/` directory

### Files:
- `src/i18n/config.ts` - i18next configuration
- `src/i18n/locales/en.json` - English translations
- `src/i18n/locales/hi.json` - Hindi translations
- `src/components/LanguageSwitcher.tsx` - Language switcher component

## Usage

### 1. Basic Translation in Components

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent: React.FC = () => {
  const { t } = useTranslation();

  return <h1>{t('login.title')}</h1>;
};
```

### 2. Language Switching

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <button onClick={() => changeLanguage('hi')}>
      हिंदी
    </button>
  );
};
```

### 3. Get Current Language

```tsx
const { i18n } = useTranslation();
console.log(i18n.language); // 'en' or 'hi'
```

### 4. Add Language Switcher to Your Layout

```tsx
import LanguageSwitcher from '../components/LanguageSwitcher';

const MyLayout: React.FC = () => {
  return (
    <div>
      <LanguageSwitcher />
      {/* Rest of your component */}
    </div>
  );
};
```

## Available Translation Keys

### Common
- `common.language` - "Language" / "भाषा"
- `common.logout` - "Logout" / "लॉगआउट"
- `common.loading` - "Loading..." / "लोड हो रहा है..."
- `common.error` - "Error" / "त्रुटि"
- `common.success` - "Success" / "सफल"
- `common.save` - "Save" / "सहेजें"
- `common.edit` - "Edit" / "संपादित करें"
- `common.delete` - "Delete" / "हटाएँ"

### Login
- `login.title` - "e-Kirana Store Login" / "ई-किराना स्टोर लॉगिन"
- `login.username` - "Username" / "उपयोगकर्ता नाम"
- `login.password` - "Password" / "पासवर्ड"
- `login.loginButton` - "Login" / "लॉगिन"
- `login.loggingIn` - "Logging in..." / "लॉगिन हो रहा है..."
- `login.invalidCredentials` - "Invalid credentials" / "अमान्य साख"

### Admin
- `admin.title` - "Admin Dashboard" / "व्यवस्थापक डैशबोर्ड"
- `admin.welcome` - "Welcome Admin" / "व्यवस्थापक का स्वागत है"
- `admin.dashboard` - "Dashboard" / "डैशबोर्ड"
- `admin.users` - "Users" / "उपयोगकर्ता"
- `admin.products` - "Products" / "उत्पाद"
- `admin.categories` - "Categories" / "श्रेणियाँ"
- `admin.orders` - "Orders" / "ऑर्डर"

### Customer
- `customer.title` - "Customer Dashboard" / "ग्राहक डैशबोर्ड"
- `customer.browse` - "Browse Products" / "उत्पाद ब्राउज़ करें"
- `customer.cart` - "Shopping Cart" / "कार्ट"
- `customer.orders` - "My Orders" / "मेरे ऑर्डर"

### Shopkeeper
- `shopkeeper.title` - "Shopkeeper Dashboard" / "दुकानदार डैशबोर्ड"
- `shopkeeper.inventory` - "Inventory" / "इन्वेंटरी"
- `shopkeeper.sales` - "Sales" / "बिक्री"
- `shopkeeper.analytics` - "Analytics" / "विश्लेषण"

### Products
- `products.name` - "Product Name" / "उत्पाद का नाम"
- `products.price` - "Price" / "कीमत"
- `products.description` - "Description" / "विवरण"
- `products.category` - "Category" / "श्रेणी"
- `products.addToCart` - "Add to Cart" / "कार्ट में जोड़ें"
- `products.quantity` - "Quantity" / "मात्रा"
- `products.stock` - "Stock" / "स्टॉक"
- `products.inStock` - "In Stock" / "स्टॉक में है"
- `products.outOfStock` - "Out of Stock" / "स्टॉक में नहीं है"

### Cart
- `cart.empty` - "Your cart is empty" / "आपकी कार्ट खाली है"
- `cart.total` - "Total" / "कुल"
- `cart.checkout` - "Checkout" / "चेकआउट"

### Orders
- `order.orderId` - "Order ID" / "ऑर्डर आईडी"
- `order.status` - "Status" / "स्थिति"
- `order.pending` - "Pending" / "लंबित"
- `order.processing` - "Processing" / "प्रक्रिया में"
- `order.shipped` - "Shipped" / "भेज दिया गया"
- `order.delivered` - "Delivered" / "सुपुर्द किया गया"

## Adding New Translations

1. **Add key to English file** (`src/i18n/locales/en.json`):
   ```json
   {
     "mySection": {
       "myKey": "My English Text"
     }
   }
   ```

2. **Add key to Hindi file** (`src/i18n/locales/hi.json`):
   ```json
   {
     "mySection": {
       "myKey": "मेरा हिंदी टेक्स्ट"
     }
   }
   ```

3. **Use in component**:
   ```tsx
   const { t } = useTranslation();
   return <p>{t('mySection.myKey')}</p>;
   ```

## Language Persistence

The selected language is automatically saved to localStorage and will be restored when the user revisits the site.

## Browser Language Detection

If no language is saved in localStorage, the system will detect the user's browser language:
- If browser language is Hindi (`hi`), it will default to Hindi
- Otherwise, it will default to English

## Tips

1. Always use the `useTranslation()` hook in functional components
2. Never hardcode strings in JSX - use translation keys instead
3. Keep translation keys organized by section (admin, customer, products, etc.)
4. For dynamic values, use i18next's interpolation feature:
   ```tsx
   // In translation file:
   // "welcome": "Welcome, {{name}}!"
   
   {t('common.welcome', { name: 'John' })}
   ```

5. Add the LanguageSwitcher component to your main layout for easy access

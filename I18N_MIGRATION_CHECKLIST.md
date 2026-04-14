# I18n Migration Checklist

This checklist helps you migrate pages to support multiple languages.

## Per-Page Checklist

For each page you want to update, follow these steps:

### Phase 1: Setup
- [ ] Import `useTranslation` hook
  ```tsx
  import { useTranslation } from 'react-i18next';
  ```

- [ ] Import LanguageSwitcher if adding to header
  ```tsx
  import LanguageSwitcher from '../../components/LanguageSwitcher';
  ```

- [ ] Call the hook in your component
  ```tsx
  const { t } = useTranslation();
  ```

### Phase 2: Replace Hardcoded Strings
- [ ] Replace all page titles
  ```tsx
  // Before: <h1>Admin Dashboard</h1>
  // After:
  <h1>{t('admin.title')}</h1>
  ```

- [ ] Replace button labels
  ```tsx
  // Before: <Button>Save</Button>
  // After:
  <Button>{t('common.save')}</Button>
  ```

- [ ] Replace form labels
  ```tsx
  // Before: <Form.Label>Username</Form.Label>
  // After:
  <Form.Label>{t('login.username')}</Form.Label>
  ```

- [ ] Replace placeholders
  ```tsx
  // Before: placeholder="Enter username"
  // After:
  placeholder={t('login.enterUsername')}
  ```

- [ ] Replace alert/error messages
  ```tsx
  // Before: setError("Invalid credentials")
  // After:
  setError(t('login.invalidCredentials'))
  ```

- [ ] Replace table headers
  ```tsx
  // Before: <th>Product Name</th>
  // After:
  <th>{t('products.name')}</th>
  ```

### Phase 3: Add Language Switcher
- [ ] Add LanguageSwitcher to page header or layout

### Phase 4: Testing
- [ ] Test page in English (en)
- [ ] Test page in Hindi (hi)
- [ ] Check for text overflow in Hindi (usually longer)
- [ ] Verify all buttons/labels display correctly
- [ ] Test language switching without page reload

## Pages Updated ✅
- [x] LoginPage - Fully translated with LanguageSwitcher

## Pages To Update (Priority Order)
- [ ] MainLayout/Navigation - Add LanguageSwitcher to navbar
- [ ] AdminDashboard
- [ ] AdminCategory
- [ ] AdminProduct
- [ ] AdminInventory
- [ ] CustomerDashboard
- [ ] ShopkeeperDashboard
- [ ] ProductPage
- [ ] CartPage
- [ ] CheckoutPage
- [ ] OrderPage
- [ ] All Admin pages
- [ ] All Customer pages
- [ ] All Shopkeeper pages

## Translation Keys Categories

### When Migrating, Look For:
- [ ] Page titles → `admin.`, `customer.`, `shopkeeper.` sections
- [ ] Navigation items → `navigation.*`
- [ ] Button labels → `common.save`, `common.delete`, `common.add`, etc.
- [ ] Form labels → `login.username`, `products.name`, etc.
- [ ] Form placeholders → `login.enterUsername`, `login.enterPassword`, etc.
- [ ] Error messages → `validation.*`, specific error messages
- [ ] Success messages → `common.success`, `order.orderConfirmed`, etc.
- [ ] Loading states → `common.loading`
- [ ] Table headers → `products.*`, `order.*`, `cart.*`

## Adding New Translations

If you need a translation key that doesn't exist:

1. **Add to English** (`src/i18n/locales/en.json`):
   ```json
   {
     "mySection": {
       "newKey": "My English Text"
     }
   }
   ```

2. **Add to Hindi** (`src/i18n/locales/hi.json`):
   ```json
   {
     "mySection": {
       "newKey": "मेरा हिंदी टेक्स्ट"
     }
   }
   ```

3. **Use in component**:
   ```tsx
   {t('mySection.newKey')}
   ```

## Tips for Quality Translations

1. **Test Layout**: Hindi text is often longer than English. Test with both.
2. **Consistency**: Use the same translation keys for the same UI concepts
3. **Context**: Keep translations in the right sections for easy maintenance
4. **No Hardcoding**: Never hardcode strings in JSX - always use `t()`
5. **RTL Consideration**: Current setup uses LTR for both languages (standard for Hindi in India)

## Common Patterns

### Conditional Text
```tsx
import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t } = useTranslation();
  
  return (
    <Button>{isLoading ? t('common.loading') : t('common.save')}</Button>
  );
};
```

### Plural Forms
```tsx
// In translation file (en.json):
{
  "cart": {
    "item": "Item",
    "items": "Items"
  }
}

// In component:
<span>{count} {t(count === 1 ? 'cart.item' : 'cart.items')}</span>
```

### Dynamic Values
```tsx
// In translation file:
// "welcome": "Welcome, {{name}}!"

// In component:
{t('common.welcome', { name: 'John' })}
```

## Resources

- Complete guide: [I18N_SETUP.md](I18N_SETUP.md)
- Example component: [src/i18n/TRANSLATION_GUIDE.tsx](src/i18n/TRANSLATION_GUIDE.tsx)
- Example migration: [src/pages/admin/MIGRATION_EXAMPLE.tsx](src/pages/admin/MIGRATION_EXAMPLE.tsx)
- i18next docs: https://www.i18next.com/
- React-i18next docs: https://react.i18next.com/

---

**Keep this checklist updated as you migrate pages!**

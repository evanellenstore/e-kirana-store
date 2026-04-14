# Quick Reference: Before & After Examples

## LoginPage (Already Updated ✅)

### Before
```tsx
import React, { useState } from "react";
import { Container, Row, Col, Form, Button, Card, Alert } from "react-bootstrap";

const LoginPage: React.FC = () => {
  return (
    <Container fluid className="vh-100 d-flex align-items-center justify-content-center bg-light">
      <Card>
        <Card.Body>
          <h3 className="text-center mb-4">e-Kirana Store Login</h3>
          <Form>
            <Form.Label>Username</Form.Label>
            <Form.Control placeholder="Enter username" required />
            
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" placeholder="Enter password" required />
            
            <Button variant="primary" type="submit" className="w-100">
              Login
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};
```

### After
```tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Container, Row, Col, Form, Button, Card, Alert } from "react-bootstrap";
import LanguageSwitcher from "../components/LanguageSwitcher";

const LoginPage: React.FC = () => {
  const { t } = useTranslation(); // ← Add this

  return (
    <Container fluid className="vh-100 d-flex flex-column bg-light">
      <div className="align-self-end pt-3 pe-3">
        <LanguageSwitcher /> {/* ← Add language switcher */}
      </div>
      <Row className="flex-grow-1 d-flex align-items-center justify-content-center">
        <Col>
          <Card>
            <Card.Body>
              <h3 className="text-center mb-4">{t('login.title')}</h3> {/* ← Use translation */}
              <Form>
                <Form.Label>{t('login.username')}</Form.Label> {/* ← Use translation */}
                <Form.Control placeholder={t('login.enterUsername')} required /> {/* ← Use translation */}
                
                <Form.Label>{t('login.password')}</Form.Label> {/* ← Use translation */}
                <Form.Control type="password" placeholder={t('login.enterPassword')} required /> {/* ← Use translation */}
                
                <Button variant="primary" type="submit" className="w-100">
                  {t('login.loginButton')} {/* ← Use translation */}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
```

## Admin Dashboard

### Before
```tsx
import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';

const AdminDashboard: React.FC = () => {
  return (
    <Container fluid className="py-4">
      <h1>Admin Dashboard</h1>
      
      <Row className="g-4">
        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title>Users</Card.Title>
            </Card.Header>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title>Products</Card.Title>
            </Card.Header>
          </Card>
        </Col>
      </Row>

      <Button variant="primary">Save</Button>
      <Button variant="secondary">Cancel</Button>
    </Container>
  );
};
```

### After
```tsx
import React from 'react';
import { useTranslation } from 'react-i18next'; // ← Add import
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import LanguageSwitcher from '../components/LanguageSwitcher'; // ← Add import

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation(); // ← Add hook

  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{t('admin.title')}</h1> {/* ← Use translation */}
        <LanguageSwitcher /> {/* ← Add language switcher */}
      </div>
      
      <Row className="g-4">
        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title>{t('admin.users')}</Card.Title> {/* ← Use translation */}
            </Card.Header>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title>{t('admin.products')}</Card.Title> {/* ← Use translation */}
            </Card.Header>
          </Card>
        </Col>
      </Row>

      <Button variant="primary">{t('common.save')}</Button> {/* ← Use translation */}
      <Button variant="secondary">{t('common.cancel')}</Button> {/* ← Use translation */}
    </Container>
  );
};
```

## Product List

### Before
```tsx
<table>
  <thead>
    <tr>
      <th>Product Name</th>
      <th>Price</th>
      <th>Category</th>
      <th>Stock</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    {products.map(product => (
      <tr key={product.id}>
        <td>{product.name}</td>
        <td>₹{product.price}</td>
        <td>{product.category}</td>
        <td>{product.stock > 0 ? 'In Stock' : 'Out of Stock'}</td>
        <td>
          <Button>Edit</Button>
          <Button variant="danger">Delete</Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### After
```tsx
<table>
  <thead>
    <tr>
      <th>{t('products.name')}</th> {/* ← Use translation */}
      <th>{t('products.price')}</th> {/* ← Use translation */}
      <th>{t('products.category')}</th> {/* ← Use translation */}
      <th>{t('products.stock')}</th> {/* ← Use translation */}
      <th>{t('common.edit')}</th> {/* ← Use translation */}
    </tr>
  </thead>
  <tbody>
    {products.map(product => (
      <tr key={product.id}>
        <td>{product.name}</td>
        <td>₹{product.price}</td>
        <td>{product.category}</td>
        <td>{product.stock > 0 ? t('products.inStock') : t('products.outOfStock')}</td> {/* ← Use translation */}
        <td>
          <Button>{t('common.edit')}</Button> {/* ← Use translation */}
          <Button variant="danger">{t('common.delete')}</Button> {/* ← Use translation */}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

## Error Handling

### Before
```tsx
try {
  const user = await login(username, password);
  // ...
} catch (err: any) {
  setError(err?.response?.data?.message || "Invalid credentials");
}
```

### After
```tsx
const { t } = useTranslation();

try {
  const user = await login(username, password);
  // ...
} catch (err: any) {
  setError(err?.response?.data?.message || t('login.invalidCredentials'));
}
```

## Form Submission

### Before
```tsx
<Form onSubmit={handleSubmit}>
  <Form.Group>
    <Form.Label>Category Name</Form.Label>
    <Form.Control 
      placeholder="Enter category name"
      required
    />
  </Form.Group>
  
  <Button type="submit">Add Category</Button>
</Form>
```

### After
```tsx
const { t } = useTranslation();

<Form onSubmit={handleSubmit}>
  <Form.Group>
    <Form.Label>{t('categories.categoryName')}</Form.Label> {/* ← Use translation */}
    <Form.Control 
      placeholder={t('categories.categoryName')} {/* ← Use translation */}
      required
    />
  </Form.Group>
  
  <Button type="submit">{t('categories.addCategory')}</Button> {/* ← Use translation */}
</Form>
```

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Hardcoded Text** | `"e-Kirana Store Login"` | `{t('login.title')}` |
| **Button Labels** | `"Save"` | `{t('common.save')}` |
| **Placeholders** | `placeholder="Enter username"` | `placeholder={t('login.enterUsername')}` |
| **Error Messages** | `"Invalid credentials"` | `t('login.invalidCredentials')` |
| **Language Switcher** | None | `<LanguageSwitcher />` |
| **Imports** | No i18n | `import { useTranslation }` |
| **Hook** | None | `const { t } = useTranslation()` |

## Most Common Patterns

### 1. Simple Text
```tsx
<h1>{t('admin.title')}</h1>
<p>{t('common.loading')}</p>
```

### 2. Button Labels
```tsx
<Button>{t('common.save')}</Button>
<Button>{t('common.delete')}</Button>
```

### 3. Form Labels & Placeholders
```tsx
<Form.Label>{t('login.username')}</Form.Label>
<Form.Control placeholder={t('login.enterUsername')} />
```

### 4. Conditional Text
```tsx
{isLoading ? t('common.loading') : t('common.save')}
{inStock ? t('products.inStock') : t('products.outOfStock')}
```

### 5. Table Headers
```tsx
<th>{t('products.name')}</th>
<th>{t('products.price')}</th>
```

---

**Copy these patterns when migrating your pages!**

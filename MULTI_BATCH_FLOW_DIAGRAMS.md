# Multi-Batch Billing - Flow Diagrams

## 1. User Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER BILLING WORKFLOW                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  1. SCAN & ADD   │
│   14 units       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  CART STATE:                                 │
│  Product A | SKU001 | Qty: 14 | [Split] [X] │
└──────────┬───────────────────────────────────┘
           │
           │ User clicks "Split"
           ▼
┌────────────────────────────────────────────────────┐
│  2. BATCH ALLOCATION MODAL                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ Allocate Product A - 14 units               │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Total required: 14 units                     │  │
│  │ Total allocated: 14 units ✓                  │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Batch  │ Expiry      │ Available │ Allocate │  │
│  ├────────┼─────────────┼───────────┼──────────┤  │
│  │ BatchA │ 2026-12-31  │    15     │    10    │  │
│  │ BatchB │ 2026-06-30  │     8     │     4    │  │
│  └──────────────────────────────────────────────┘  │
│  [Cancel]  [Save Allocations]                      │
└────────┬──────────────────────────────────────────┘
         │
         │ User adjusts qty: Batch A: 10, Batch B: 4
         │ User clicks "Save Allocations"
         ▼
┌──────────────────────────────────────────────────────┐
│  UPDATED CART STATE:                                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Product A │ Batch A │ Qty: 10 │ [Split] [X]    │ │
│  │ Product A │ Batch B │ Qty:  4 │ [Split] [X]    │ │
│  └─────────────────────────────────────────────────┘ │
│  Cart Total: 14 units                                │
└──────────┬──────────────────────────────────────────┘
           │
           │ User clicks "Reserve"
           ▼
┌────────────────────────────────────────┐
│  3. RESERVE PHASE                      │
│  ┌────────────────────────────────────┐│
│  │ Sent to Backend:                   ││
│  │ {                                  ││
│  │   productId: 1,                    ││
│  │   batches: [                       ││
│  │     {batchNo: "A", qty: 10},       ││
│  │     {batchNo: "B", qty: 4}         ││
│  │   ]                                ││
│  │ }                                  ││
│  └────────────────────────────────────┘│
│  ✓ Batch A reserved: 10 units          │
│  ✓ Batch B reserved: 4 units           │
└──────────┬─────────────────────────────┘
           │
           │ User clicks "Finalize"
           ▼
┌────────────────────────────────────┐
│  4. FINALIZE PHASE                 │
│  ✓ Adjust Batch A: qty 10 OUT      │
│  ✓ Adjust Batch B: qty 4 OUT       │
│  ✓ Bill FINALIZED                  │
└──────────┬────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  5. RECEIPT                          │
│  Bill ID: 100                        │
│  ┌────────────────────────────────┐  │
│  │ Product A (Batch A) │ 10 │ ₹100 │  │
│  │ Product A (Batch B) │  4 │ ₹100 │  │
│  ├────────────────────────────────┤  │
│  │ Subtotal:        ₹1400         │  │
│  │ GST (18%):       ₹252          │  │
│  │ Grand Total:     ₹1652         │  │
│  └────────────────────────────────┘  │
│  [Print]  [Done]                     │
└──────────────────────────────────────┘
```

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Billing.tsx)                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐                                             │
│  │  Cart Component  │                                             │
│  │  ┌────────────┐  │     ┌─────────────────────────────────┐    │
│  │  │ Product A  │  │────▶│ Split Button (openBatchAlloc)  │    │
│  │  │ Qty: 14    │  │     │ ▼                               │    │
│  │  │ Batch: -   │  │     │ ┌─────────────────────────────┐ │    │
│  │  └────────────┘  │     │ │ Batch Allocation Modal      │ │    │
│  │                  │     │ │ ┌─────────────────────────┐ │ │    │
│  │  ┌────────────┐  │     │ │ │ Batch A │ Qty: 10     │ │ │    │
│  │  │ Product A  │  │     │ │ │ Batch B │ Qty: 4      │ │ │    │
│  │  │ Qty: 10    │  │     │ │ │ [Save]               │ │ │    │
│  │  │ Batch: A   │  │     │ │ └─────────────────────┘ │ │    │
│  │  └────────────┘  │     │ └─────────────────────────────┘ │    │
│  │                  │     │        (after save)             │    │
│  │  ┌────────────┐  │     │ Cart updates to 2 rows         │    │
│  │  │ Product A  │  │     └─────────────────────────────────┘    │
│  │  │ Qty: 4     │  │                                             │
│  │  │ Batch: B   │  │                                             │
│  │  └────────────┘  │                                             │
│  │                  │                                             │
│  │ [Reserve] ──────▶│ reserveItems()                              │
│  └──────────────────┘ - Groups by productId                      │
│                       - Detects multi-batch                      │
│                       - Builds payload                           │
└────────────┬──────────────────────────────────────────────────────┘
             │
             │ POST /billings/{billId}/items/batch
             │ Payload: { productId, batches: [{...}, {...}] }
             │
             ▼
┌────────────────────────────────────────────────────────────────────┐
│               BACKEND (BillingService.java)                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  addItemsBatch(billId, payload)                                   │
│  ▼                                                                 │
│  for each item in payload:                                        │
│    ▼                                                               │
│    Check if "batches" array exists?                               │
│    │                                                              │
│    ├─ YES (Multi-batch)                                           │
│    │  ├─ for each batch in array:                                │
│    │  │  ├─ Create BillItem(productId, batchNo, qty)             │
│    │  │  ├─ Save to DB                                           │
│    │  │  └─ reserve(productId, batchNo, qty)                     │
│    │  │     ▼                                                     │
│    │  │     inventory-service                                     │
│    │  │     - Find InventoryStock                                │
│    │  │     - availableQty -= qty                                │
│    │  │     - reservedQty += qty                                 │
│    │  │     ✓ Return success                                      │
│    │                                                              │
│    └─ NO (Single-batch, backward compatible)                      │
│       ├─ Create BillItem(productId, batchNo, qty)                │
│       ├─ Save to DB                                               │
│       └─ reserve(productId, batchNo, qty)                        │
│          ▼                                                        │
│          inventory-service                                        │
│          - Find InventoryStock                                   │
│          - availableQty -= qty                                   │
│          - reservedQty += qty                                    │
│          ✓ Return success                                         │
│                                                                    │
│  Result: Multiple BillItem rows created for same product        │
│  ├─ bill_item_1: product_id=1, batch_no="A", qty=10             │
│  └─ bill_item_2: product_id=1, batch_no="B", qty=4              │
└────────────┬──────────────────────────────────────────────────────┘
             │
             │ Later: finalizeBill()
             │
             ▼
┌────────────────────────────────────────────────────────────────────┐
│               FINALIZE PHASE (BillingService)                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  finalizeBill(billId)                                             │
│  ▼                                                                 │
│  Get all BillItem rows for billId                                 │
│  [bill_item_1 (batch A, qty 10), bill_item_2 (batch B, qty 4)]   │
│                                                                    │
│  for each BillItem:                                               │
│    ▼                                                               │
│    adjustStock(productId, quantity, batchNo, type="OUT")          │
│    │                                                              │
│    ├─ Call 1: adjustStock(1, 10, "A", "OUT")                     │
│    │  ▼ inventory-service                                        │
│    │  - Find InventoryStock(product_id=1, batch_no="A")          │
│    │  - reservedQty -= 10  (✓ NO double-decrement!)             │
│    │  ✓ Success                                                   │
│    │                                                              │
│    └─ Call 2: adjustStock(1, 4, "B", "OUT")                      │
│       ▼ inventory-service                                        │
│       - Find InventoryStock(product_id=1, batch_no="B")          │
│       - reservedQty -= 4   (✓ NO double-decrement!)             │
│       ✓ Success                                                   │
│                                                                    │
│  Mark Bill as FINALIZED                                           │
│  ✓ NO 409 ERROR!                                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Inventory State Diagram

```
INVENTORY STATE ACROSS LIFECYCLE

Initial State:
┌──────────────────────────────────────────────┐
│ Product A - Batch A (Expiry: 2026-12-31)     │
├──────────────────────────────────────────────┤
│ Available Qty:  15                           │
│ Reserved Qty:   0                            │
│ Total:          15                           │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Product A - Batch B (Expiry: 2026-06-30)     │
├──────────────────────────────────────────────┤
│ Available Qty:  8                            │
│ Reserved Qty:   0                            │
│ Total:          8                            │
└──────────────────────────────────────────────┘


After RESERVE (reserveItems called):
┌──────────────────────────────────────────────┐
│ Product A - Batch A (Expiry: 2026-12-31)     │
├──────────────────────────────────────────────┤
│ Available Qty:  5    ◀─── (15 - 10)          │
│ Reserved Qty:   10   ◀─── (0 + 10)           │
│ Total:          15                           │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Product A - Batch B (Expiry: 2026-06-30)     │
├──────────────────────────────────────────────┤
│ Available Qty:  4    ◀─── (8 - 4)            │
│ Reserved Qty:   4    ◀─── (0 + 4)            │
│ Total:          8                            │
└──────────────────────────────────────────────┘


After FINALIZE (finalizeBill called):
┌──────────────────────────────────────────────┐
│ Product A - Batch A (Expiry: 2026-12-31)     │
├──────────────────────────────────────────────┤
│ Available Qty:  5                            │
│ Reserved Qty:   0    ◀─── (10 - 10)          │
│ Total:          5                            │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Product A - Batch B (Expiry: 2026-06-30)     │
├──────────────────────────────────────────────┤
│ Available Qty:  4                            │
│ Reserved Qty:   0    ◀─── (4 - 4)            │
│ Total:          4                            │
└──────────────────────────────────────────────┘

✓ SUCCESS: No 409 errors!
✓ Both batches processed independently
✓ Reserved qty properly decremented (not available qty)
```

---

## 4. Data Model Diagram

```
BILLING DATABASE SCHEMA

┌─────────────────────────────┐
│ Billing                     │
├─────────────────────────────┤
│ bill_id (PK)      │ 100     │
│ shopkeeper_id     │ 5       │
│ status            │ FINAL.. │
│ total_amount      │ 1652.00 │
│ created_at        │ 2026... │
└─────────────────────────────┘
         ▲
         │ 1..N
         │
┌─────────────────────────────────────────────────────┐
│ BillItem (Multiple rows per product in multi-batch) │
├─────────────────────────────────────────────────────┤
│ bill_item_id      │ 101                             │
│ bill_id (FK)      │ 100                             │
│ product_id        │ 1                               │
│ batch_no          │ "BATCH-A"   ◀─── KEY!          │
│ name              │ "Product A"                     │
│ sku               │ "SKU001"                        │
│ quantity          │ 10          ◀─── Per batch     │
│ price             │ 100.00                          │
│ expiry_date       │ 2026-12-31  ◀─── Per batch     │
├─────────────────────────────────────────────────────┤
│ bill_item_id      │ 102                             │
│ bill_id (FK)      │ 100                             │
│ product_id        │ 1                               │
│ batch_no          │ "BATCH-B"   ◀─── Different!    │
│ name              │ "Product A"                     │
│ sku               │ "SKI001"                        │
│ quantity          │ 4           ◀─── Different qty │
│ price             │ 100.00                          │
│ expiry_date       │ 2026-06-30  ◀─── Different!    │
└─────────────────────────────────────────────────────┘

KEY POINT: Same product, different batches = different rows


INVENTORY DATABASE SCHEMA

┌──────────────────────────────────────────┐
│ InventoryStock                           │
├──────────────────────────────────────────┤
│ inventory_id (PK) │ 1001                 │
│ product_id (FK)   │ 1                    │
│ batch_no          │ "BATCH-A"            │
│ available_qty     │ 5   (15 - 10)        │
│ reserved_qty      │ 0   (10 - 10)        │
│ expiry_date       │ 2026-12-31           │
├──────────────────────────────────────────┤
│ inventory_id (PK) │ 1002                 │
│ product_id (FK)   │ 1                    │
│ batch_no          │ "BATCH-B"            │
│ available_qty     │ 4   (8 - 4)          │
│ reserved_qty      │ 0   (4 - 4)          │
│ expiry_date       │ 2026-06-30           │
└──────────────────────────────────────────┘

RESERVE: available_qty -= qty, reserved_qty += qty
FINALIZE: reserved_qty -= qty (✓ KEY: NOT available_qty!)
```

---

## 5. Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. RESERVE PHASE - Frontend to Backend                          │
└─────────────────────────────────────────────────────────────────┘

Frontend (Billing.tsx)
│
│ reserveItems()
│ ├─ Group items by productId
│ │  └─ Detect: Product 1 has 2 rows (Batch A, Batch B)
│ │
│ ├─ Build payload:
│ │  {
│ │    productId: 1,
│ │    name: "Product A",
│ │    batches: [
│ │      {batchNo: "BATCH-A", quantity: 10, expiryDate: "2026-12-31"},
│ │      {batchNo: "BATCH-B", quantity: 4, expiryDate: "2026-06-30"}
│ │    ]
│ │  }
│ │
│ └─ POST /billings/100/items/batch
│    ▼
Backend (BillingService)
│
│ addItemsBatch(billId, payload)
│ ├─ for each item in payload:
│ │  ├─ Check "batches" exists? YES
│ │  ├─ for each batch in array:
│ │  │  ├─ Create BillItem(prod=1, batch="A", qty=10)
│ │  │  ├─ Save
│ │  │  ├─ POST /inventory/1/reserve {qty: 10}
│ │  │  │  ▼ InventoryService
│ │  │  │  ├─ Find InventoryStock (prod=1, batch="A")
│ │  │  │  ├─ available_qty = 15 - 10 = 5
│ │  │  │  ├─ reserved_qty = 0 + 10 = 10
│ │  │  │  └─ ✓ Return success
│ │  │  │
│ │  │  ├─ Create BillItem(prod=1, batch="B", qty=4)
│ │  │  ├─ Save
│ │  │  ├─ POST /inventory/1/reserve {qty: 4}
│ │  │  │  ▼ InventoryService
│ │  │  │  ├─ Find InventoryStock (prod=1, batch="B")
│ │  │  │  ├─ available_qty = 8 - 4 = 4
│ │  │  │  ├─ reserved_qty = 0 + 4 = 4
│ │  │  │  └─ ✓ Return success
│ │
│ └─ ✓ 200 OK
│    ▼
Frontend
│
└─ ✓ Items reserved successfully


┌─────────────────────────────────────────────────────────────────┐
│ 2. FINALIZE PHASE - Frontend to Backend                         │
└─────────────────────────────────────────────────────────────────┘

Frontend
│
│ finalizeBill() / completeBill()
│ └─ POST /billings/100/finalize
│    ▼
Backend (BillingService)
│
│ finalizeBill(billId)
│ ├─ Get Bill 100
│ ├─ Get all BillItems for Bill 100
│ │  └─ [BillItem(id=101, prod=1, batch="A", qty=10),
│ │      BillItem(id=102, prod=1, batch="B", qty=4)]
│ │
│ ├─ for each BillItem:
│ │  ├─ BillItem 101 (Batch A, qty=10):
│ │  │  ├─ POST /inventory/1/adjust
│ │  │  │  {quantity: 10, type: "OUT", expiryDate: "2026-12-31"}
│ │  │  │  ▼ InventoryService
│ │  │  │  ├─ adjustStock()
│ │  │  │  ├─ Find InventoryStock(prod=1, batch="A")
│ │  │  │  ├─ reserved_qty = 10 - 10 = 0  ◀─ KEY!
│ │  │  │  ├─ available_qty = 5 (unchanged)
│ │  │  │  └─ ✓ No 409 error
│ │  │  │
│ │  ├─ BillItem 102 (Batch B, qty=4):
│ │  │  ├─ POST /inventory/1/adjust
│ │  │  │  {quantity: 4, type: "OUT", expiryDate: "2026-06-30"}
│ │  │  │  ▼ InventoryService
│ │  │  │  ├─ adjustStock()
│ │  │  │  ├─ Find InventoryStock(prod=1, batch="B")
│ │  │  │  ├─ reserved_qty = 4 - 4 = 0  ◀─ KEY!
│ │  │  │  ├─ available_qty = 4 (unchanged)
│ │  │  │  └─ ✓ No 409 error
│ │
│ ├─ Update Bill status = "FINALIZED"
│ └─ ✓ 200 OK
│    ▼
Frontend
│
└─ ✓ Bill finalized successfully
   ✓ Show receipt modal
```

---

## 6. Comparison: Old vs. New

```
┌─────────────────────────────────────────────────────────────────┐
│                      OLD APPROACH (BROKEN)                      │
└─────────────────────────────────────────────────────────────────┘

User wants: 10 from Batch A, 4 from Batch B

Problem: No way to specify multiple batches in UI
│
├─ Option 1: Add item twice (manually)
│  ├─ Add Product A, Qty: 10, Batch: A
│  ├─ Add Product A, Qty: 4, Batch: B
│  └─ ✗ How to track which batch for which row? Confusing!
│
├─ Option 2: Add as single item, no batch selection
│  ├─ Add Product A, Qty: 14
│  ├─ Reserve picks random batch
│  ├─ Try to reserve 14 from Batch A only → ✗ FAIL (only 15 avail)
│  └─ ✗ Fails or uses wrong batches
│
└─ ✗ Result: 409 "Insufficient stock" error on finalize


┌─────────────────────────────────────────────────────────────────┐
│                      NEW APPROACH (FIXED)                       │
└─────────────────────────────────────────────────────────────────┘

User wants: 10 from Batch A, 4 from Batch B

Solution: Split modal in UI
│
├─ Add Product A, Qty: 14 (single row)
├─ Click "Split" button
├─ Modal opens with available batches
├─ User allocates: Batch A (10), Batch B (4)
├─ Click "Save" → Cart shows 2 rows
├─ Click "Reserve" → Both batches reserved independently
├─ Click "Finalize" → Both batches adjusted independently
└─ ✓ SUCCESS: No errors, receipt shows both batch rows


COMPARISON TABLE:

                  │ OLD (Broken)    │ NEW (Fixed)
──────────────────┼─────────────────┼────────────────
User Experience   │ Confusing       │ Clear, intuitive
Multiple Batches  │ ✗ Not possible  │ ✓ Full support
Cart Display      │ Unclear batch   │ ✓ Shows batch per row
Reserve Flow      │ ✗ 409 errors    │ ✓ Separate per batch
Finalize Flow     │ ✗ 409 errors    │ ✓ Separate per batch
Backward Compat   │ N/A             │ ✓ 100% compatible
DB Changes        │ N/A             │ ✗ None needed
API Changes       │ N/A             │ ✓ Backward compatible
```

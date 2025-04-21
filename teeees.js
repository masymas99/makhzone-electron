const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const backend = express();
backend.use(cors());
backend.use(express.json());
const PORT = 3001;

// Helper function for date handling
function getCurrentDateTime() {
  return new Date().toISOString();
}

// إعداد قاعدة البيانات SQLite
const dbPath = path.join(app.getPath('userData'), 'makhzone.db');
let db;

function initDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('فشل فتح قاعدة البيانات:', err);
    } else {
      db.serialize(() => {
        const ddl = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email_verified_at DATETIME,
          remember_token TEXT,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS suppliers (
          SupplierID INTEGER PRIMARY KEY AUTOINCREMENT,
          Name TEXT NOT NULL,
          Phone TEXT NOT NULL,
          Address TEXT NOT NULL,
          IsActive INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS products (
          ProductID INTEGER PRIMARY KEY AUTOINCREMENT,
          ProductName TEXT NOT NULL,
          Category TEXT NOT NULL DEFAULT 'General',
          StockQuantity INTEGER NOT NULL DEFAULT 0,
          UnitPrice REAL NOT NULL DEFAULT 0,
          UnitCost REAL NOT NULL ,
          IsActive INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS traders (
          TraderID INTEGER PRIMARY KEY AUTOINCREMENT,
          TraderName TEXT NOT NULL,
          Phone TEXT NOT NULL,
          Address TEXT NOT NULL,
          Balance REAL NOT NULL DEFAULT 0,
          TotalSales REAL NOT NULL DEFAULT 0,
          TotalPayments REAL NOT NULL DEFAULT 0,
          IsActive INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS trader_financials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trader_id INTEGER NOT NULL,
          sale_id INTEGER,
          payment_id INTEGER,
          sale_amount REAL NOT NULL DEFAULT 0,
          payment_amount REAL NOT NULL DEFAULT 0,
          balance REAL NOT NULL,
          total_sales REAL NOT NULL DEFAULT 0,
          total_payments REAL NOT NULL DEFAULT 0,
          remaining_amount REAL NOT NULL,
          transaction_type TEXT NOT NULL,
          description TEXT,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS sales (
          SaleID INTEGER PRIMARY KEY AUTOINCREMENT,
          InvoiceNumber TEXT,
          TraderID INTEGER NOT NULL,
          SaleDate DATE NOT NULL,
          TotalAmount REAL NOT NULL,
          PaidAmount REAL NOT NULL DEFAULT 0,
          RemainingAmount REAL NOT NULL DEFAULT 0,
          Status TEXT NOT NULL DEFAULT 'pending',
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS sale_details (
          SaleDetailID INTEGER PRIMARY KEY AUTOINCREMENT,
          SaleID INTEGER NOT NULL,
          ProductID INTEGER NOT NULL,
          Quantity INTEGER NOT NULL,
          UnitPrice REAL NOT NULL,
          UnitCost REAL NOT NULL DEFAULT 0,
          SubTotal REAL NOT NULL,
          Profit REAL NOT NULL DEFAULT 0,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS purchases (
          PurchaseID INTEGER PRIMARY KEY AUTOINCREMENT,
          ProductID INTEGER,
          Quantity INTEGER NOT NULL DEFAULT 0,
          UnitCost REAL NOT NULL DEFAULT 0,
          TotalAmount REAL NOT NULL DEFAULT 0,
          TraderID INTEGER,
          BatchNumber TEXT,
          PurchaseDate DATETIME DEFAULT CURRENT_TIMESTAMP,
          SupplierName TEXT,
          Notes TEXT,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS purchase_details (
          PurchaseDetailID INTEGER PRIMARY KEY AUTOINCREMENT,
          PurchaseID INTEGER NOT NULL,
          ProductID INTEGER NOT NULL,
          Quantity INTEGER NOT NULL DEFAULT 0,
          UnitCost REAL NOT NULL DEFAULT 0,
          SubTotal REAL NOT NULL DEFAULT 0,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS expenses (
          ExpenseID INTEGER PRIMARY KEY AUTOINCREMENT,
          ExpenseDate DATE NOT NULL,
          Description TEXT NOT NULL,
          Amount REAL NOT NULL,
          created_at DATETIME,
          updated_at DATETIME
        );
        CREATE TABLE IF NOT EXISTS payments (
          PaymentID INTEGER PRIMARY KEY AUTOINCREMENT,
          TraderID INTEGER NOT NULL,
          SaleID INTEGER,
          PaymentDate DATE NOT NULL,
          Amount REAL NOT NULL,
          created_at DATETIME,
          updated_at DATETIME
        );
        `;
        db.exec(ddl, (err) => {
          if (err) {
            console.error('فشل إنشاء الجداول:', err);
          } else {
          }
        });
      });
    }
  });
}

// إعداد API بسيط (مثال: تسجيل مستخدم)
backend.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }
  // تحقق من البريد الإلكتروني المكرر
  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
    }
    if (row) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل.' });
    }
    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
      if (err) {
        return res.status(400).json({ error: 'خطأ في التسجيل.' });
      }
      res.json({ id: this.lastID, name, email });
    });
  });
});

// تسجيل دخول المستخدم
backend.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة.' });
  }
  db.get('SELECT id, name, email, password FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'خطأ في قاعدة البيانات.' });
    }
    if (!row) {
      return res.status(400).json({ error: 'بيانات اعتماد غير صحيحة.' });
    }
    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      return res.status(400).json({ error: 'بيانات اعتماد غير صحيحة.' });
    }
    
    // Add expiration time (48 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    
    const userData = {
      id: row.id,
      name: row.name,
      email: row.email,
      expiresAt: expiresAt.toISOString()
    };
    
    res.json(userData);
  });
});

// Sales endpoints
backend.get('/api/sales', (req, res) => {
  db.all('SELECT * FROM sales', [], (err, sales) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع المبيعات' });
    const result = [];
    let count = sales.length;
    if (count === 0) return res.json([]);
    sales.forEach(sale => {
      db.all('SELECT sd.*, p.ProductName, p.UnitPrice, p.UnitCost FROM sale_details sd LEFT JOIN products p ON sd.ProductID = p.ProductID WHERE sd.SaleID = ?', [sale.SaleID], (err, details) => {
        if (err) details = [];
        db.get('SELECT TraderID, TraderName FROM traders WHERE TraderID = ?', [sale.TraderID], (err, trader) => {
          result.push({ ...sale, trader: trader || null, details });
          if (--count === 0) res.json(result);
        });
      });
    });
  });
});

backend.post('/api/sales', (req, res) => {
  const { TraderID, PaidAmount, products } = req.body;
  if (!TraderID || PaidAmount == null || !Array.isArray(products)) {
    return res.status(400).json({ error: 'بيانات غير كاملة' });
  }
  const now = getCurrentDateTime();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Create sale
    db.run(
      'INSERT INTO sales (TraderID, SaleDate, TotalAmount, PaidAmount, RemainingAmount, Status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [TraderID, now, 0, PaidAmount, 0, 'pending', now, now],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'خطأ في إنشاء الفاتورة' });
        }
        const saleID = this.lastID;
        let totalAmount = 0;

        // Add sale details
        products.forEach(item => {
          const subTotal = item.Quantity * item.UnitPrice;
          totalAmount += subTotal;
          // Ensure UnitCost is a valid number
          let unitCost = Number(item.UnitCost);
          if (isNaN(unitCost)) unitCost = 0;
          const profit = subTotal - (item.Quantity * unitCost);
          db.run(
            'INSERT INTO sale_details (SaleID, ProductID, Quantity, UnitPrice, SubTotal, Profit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [saleID, item.ProductID, item.Quantity, item.UnitPrice, subTotal, profit, now, now]
          );
          db.run(
            'UPDATE products SET StockQuantity = StockQuantity - ? WHERE ProductID = ?',
            [item.Quantity, item.ProductID]
          );
        });

        // Update sale totals
        const remaining = totalAmount - PaidAmount;
        db.run(
          'UPDATE sales SET TotalAmount = ?, RemainingAmount = ?, updated_at = ? WHERE SaleID = ?',
          [totalAmount, remaining, now, saleID]
        );

        // Record payment in payments table if PaidAmount > 0
        if (PaidAmount > 0) {
          db.run(
            'INSERT INTO payments (TraderID, SaleID, PaymentDate, Amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [TraderID, saleID, now, PaidAmount, now, now],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'خطأ في تسجيل الدفعة' });
              }
              const paymentID = this.lastID;

              // Update trader_financials
              db.run(
                'INSERT INTO trader_financials (trader_id, sale_id, payment_id, sale_amount, payment_amount, balance, total_sales, total_payments, remaining_amount, transaction_type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [TraderID, saleID, paymentID, totalAmount, PaidAmount, totalAmount - PaidAmount, totalAmount, PaidAmount, remaining, 'sale', 'فاتورة مبيعات', now, now]
              );
            }
          );
        } else {
          // Update trader_financials without payment
          db.run(
            'INSERT INTO trader_financials (trader_id, sale_id, sale_amount, balance, total_sales, remaining_amount, transaction_type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [TraderID, saleID, totalAmount, totalAmount, totalAmount, remaining, 'sale', 'فاتورة مبيعات', now, now]
          );
        }

        // Update trader's totals using the latest financial record
        db.get(
          'SELECT total_sales, total_payments FROM trader_financials WHERE trader_id = ? ORDER BY created_at DESC LIMIT 1',
          [TraderID],
          (err, lastRecord) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'خطأ في تحديث رصيد العميل' });
            }
            const totalSales = (lastRecord?.total_sales || 0) + totalAmount;
            const totalPayments = (lastRecord?.total_payments || 0) + (PaidAmount || 0);

            db.run(
              'UPDATE traders SET Balance = Balance + ?, TotalSales = ?, TotalPayments = ?, updated_at = ? WHERE TraderID = ?',
              [totalAmount - PaidAmount, totalSales, totalPayments, now, TraderID]
            );

            db.run('COMMIT', err => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'خطأ في حفظ المعاملة' });
              }
              res.json({ saleID: this.lastID, totalAmount, remaining });
            });
          }
        );
      }
    );
  });
});

backend.get('/api/sales/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM sales WHERE SaleID = ?', [id], (err, sale) => {
    if (err || !sale) return res.status(404).json({ error: 'فاتورة غير موجودة' });
    db.all(
      'SELECT sd.*, p.ProductName, p.UnitPrice, p.UnitCost FROM sale_details sd LEFT JOIN products p ON sd.ProductID = p.ProductID WHERE sd.SaleID = ?',
      [id],
      (err, details) => {
        if (err) details = [];
        db.get('SELECT TraderID, TraderName FROM traders WHERE TraderID = ?', [sale.TraderID], (err, trader) => {
          res.json({ ...sale, trader: trader || null, details });
        });
      }
    );
  });
});

backend.put('/api/sales/:id', (req, res) => {
  const id = req.params.id;
  const { TraderID, PaidAmount, products } = req.body;
  if (!TraderID || PaidAmount == null || !Array.isArray(products)) return res.status(400).json({ error: 'بيانات غير كاملة' });
  const now = getCurrentDateTime();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.get('SELECT * FROM sales WHERE SaleID = ?', [id], (err, sale) => {
      if (err || !sale) return res.status(404).json({ error: 'فاتورة غير موجودة' });
      db.all('SELECT * FROM sale_details WHERE SaleID = ?', [id], (err, oldDetails) => {
        oldDetails.forEach(d => { db.run('UPDATE products SET StockQuantity = StockQuantity + ? WHERE ProductID = ?', [d.Quantity, d.ProductID]); });
        db.run('UPDATE traders SET Balance = Balance - ?, TotalSales = TotalSales - ? WHERE TraderID = ?', [sale.TotalAmount, sale.TotalAmount, sale.TraderID]);
        db.run('DELETE FROM sale_details WHERE SaleID = ?', [id]);
        let totalAmount = 0;
        products.forEach(item => {
          const subTotal = item.Quantity * item.UnitPrice;
          totalAmount += subTotal;
          // Ensure UnitCost is a valid number
          let unitCost = Number(item.UnitCost);
          if (isNaN(unitCost)) unitCost = 0;
          const profit = subTotal - (item.Quantity * unitCost);
          db.run(
            'INSERT INTO sale_details (SaleID, ProductID, Quantity, UnitPrice, SubTotal, Profit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, item.ProductID, item.Quantity, item.UnitPrice, subTotal, profit, now, now]
          );
          db.run(
            'UPDATE products SET StockQuantity = StockQuantity - ? WHERE ProductID = ?',
            [item.Quantity, item.ProductID]
          );
        });
        const remaining = totalAmount - PaidAmount;
        db.run(
          'UPDATE sales SET TotalAmount = ?, PaidAmount = ?, RemainingAmount = ?, updated_at = ? WHERE SaleID = ?',
          [totalAmount, PaidAmount, remaining, now, id]
        );
        db.run('UPDATE traders SET Balance = Balance + ?, TotalSales = TotalSales + ? WHERE TraderID = ?', [totalAmount, totalAmount, TraderID]);
        db.run('COMMIT', err => {
          if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'فشل تحديث الفاتورة' }); }
          res.json({ saleID: id, totalAmount, remaining });
        });
      });
    });
  });
});

backend.delete('/api/sales/:id', (req, res) => {
  const id = req.params.id;
  
  const now = getCurrentDateTime();
  db.serialize(() => {
    db.get('SELECT * FROM sales WHERE SaleID = ?', [id], (err, sale) => {
      if (err || !sale) return res.status(404).json({ error: 'فاتورة غير موجودة' });
      db.all('SELECT * FROM sale_details WHERE SaleID = ?', [id], (err, details) => {
        details.forEach(detail => {
          db.get(
            'SELECT StockQuantity, UnitCost FROM products WHERE ProductID = ?',
            [detail.ProductID],
            (err, product) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'خطأ في استرجاع بيانات المنتج' });
              }
              const currentQty = product.StockQuantity || 0;
              const currentCost = product.UnitCost || 0;
              const newQty = currentQty + detail.Quantity;
              const totalCost = currentQty * currentCost;
              const addCost = detail.Quantity * detail.UnitCost;
              const newTotalCost = totalCost + addCost;
              const newUnitCost = newQty > 0 ? newTotalCost / newQty : 0;
              db.run(
                'UPDATE products SET StockQuantity = ?, UnitCost = ?, updated_at = ? WHERE ProductID = ?',
                [newQty, newUnitCost, now, detail.ProductID]
              );
            }
          );
        });
        db.run('UPDATE traders SET Balance = Balance - ?, TotalSales = TotalSales - ? WHERE TraderID = ?', [sale.TotalAmount, sale.TotalAmount, sale.TraderID]);
        db.run('DELETE FROM sale_details WHERE SaleID = ?', [id]);
        db.run('DELETE FROM sales WHERE SaleID = ?', [id], function(err) {
          if (err) return res.status(500).json({ error: 'خطأ في حذف الفاتورة' });
          res.json({ deleted: this.changes });
        });
      });
    });
  });
});

// ... (باقي كود main.js) ...

// API endpoint for fetching all sale details
backend.get('/api/sale_details', (req, res) => {
  db.all('SELECT * FROM sale_details', [], (err, details) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع تفاصيل المبيعات' });
    res.json(details);
  });
});

// Products endpoints
backend.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع المنتجات' });
    res.json(rows);
  });
});
backend.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE ProductID = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع المنتج' });
    if (!row) return res.status(404).json({ error: 'المنتج غير موجود' });
    res.json(row);
  });
});

backend.post('/api/products', (req, res) => {
  try {
    const { ProductName, Category, UnitPrice, StockQuantity } = req.body;
    
    // Validate required fields
    if (!ProductName || typeof ProductName !== 'string') {
      return res.status(400).json({ 
        success: false,
        error: 'اسم المنتج مطلوب ويجب أن يكون نصاً',
        field: 'ProductName' 
      });
    }
    
    // Validate numeric fields
    if (UnitPrice && isNaN(parseFloat(UnitPrice))) {
      return res.status(400).json({
        success: false,
        error: 'سعر البيع يجب أن يكون رقماً',
        field: 'UnitPrice'
      });
    }

    if (StockQuantity && isNaN(parseInt(StockQuantity))) {
      return res.status(400).json({
        success: false,
        error: 'الكمية يجب أن تكون رقماً صحيحاً',
        field: 'StockQuantity'
      });
    }

    const now = getCurrentDateTime();
    const params = [
      ProductName.trim(),
      Category?.trim() || 'General',
      parseInt(StockQuantity || 0),
      parseFloat(UnitPrice || 0),
      0,  // Initial UnitCost
      1,  // IsActive
      now,
      now
    ];
    
    db.run(
      'INSERT INTO products (ProductName, Category, StockQuantity, UnitPrice, UnitCost, IsActive, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      params,
      function(err) {
        if (err) {
          console.error('Product creation error:', err);
          return res.status(500).json({ 
            success: false,
            error: 'خطأ في إنشاء المنتج',
            details: err.message
          });
        }
        
        res.json({
          success: true,
          product: {
            ProductID: this.lastID,
            ProductName: ProductName,
            Category: Category || 'General',
            StockQuantity: parseInt(StockQuantity || 0),
            UnitPrice: parseFloat(UnitPrice || 0),
            UnitCost: 0,
            IsActive: true
          },
          message: 'تم إنشاء المنتج بنجاح'
        });
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: 'خطأ غير متوقع في النظام',
      details: err.message
    });
  }
});

backend.put('/api/products/:id', (req, res) => {
  const { ProductName, Category, StockQuantity, UnitPrice, UnitCost, IsActive } = req.body;
  const now = getCurrentDateTime();
  db.run(
    'UPDATE products SET ProductName = ?, Category = ?, StockQuantity = ?, UnitPrice = ?, UnitCost = ?, IsActive = ?, updated_at = ? WHERE ProductID = ?',
    [ProductName, Category || 'General', StockQuantity || 0, UnitPrice || 0, UnitCost || 0, IsActive ? 1 : 0, now, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في تحديث المنتج' });
      res.json({ changes: this.changes });
    }
  );
});
backend.delete('/api/products/:id', (req, res) => {
  db.run('DELETE FROM products WHERE ProductID = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'خطأ في حذف المنتج' });
    res.json({ deleted: this.changes });
  });
});

// نقاط نهاية المصروفات
backend.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع المصروفات' });
    res.json(rows);
  });
});

backend.get('/api/expenses/:id', (req, res) => {
  db.get('SELECT * FROM expenses WHERE ExpenseID = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع المصروف' });
    if (!row) return res.status(404).json({ error: 'المصروف غير موجود' });
    res.json(row);
  });
});

backend.post('/api/expenses', (req, res) => {
  const { ExpenseDate, Description, Amount } = req.body;
  if (!ExpenseDate || !Description || !Amount) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  const now = getCurrentDateTime();
  db.run(
    'INSERT INTO expenses (ExpenseDate, Description, Amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [ExpenseDate, Description, Amount, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في إنشاء المصروف' });
      res.json({ ExpenseID: this.lastID });
    }
  );
});

backend.put('/api/expenses/:id', (req, res) => {
  const { ExpenseDate, Description, Amount } = req.body;
  const now = getCurrentDateTime();
  db.run(
    'UPDATE expenses SET ExpenseDate = ?, Description = ?, Amount = ?, updated_at = ? WHERE ExpenseID = ?',
    [ExpenseDate, Description, Amount, now, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في تحديث المصروف' });
      res.json({ changes: this.changes });
    }
  );
});

backend.delete('/api/expenses/:id', (req, res) => {
  db.run('DELETE FROM expenses WHERE ExpenseID = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'خطأ في حذف المصروف' });
    res.json({ deleted: this.changes });
  });
});

// Traders endpoints
backend.get('/api/traders', (req, res) => {
  db.all('SELECT * FROM traders', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع العملاء' });
    res.json(rows);
  });
});
backend.get('/api/traders/:id', (req, res) => {
  db.get('SELECT * FROM traders WHERE TraderID = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع العميل' });
    if (!row) return res.status(404).json({ error: 'العميل غير موجود' });
    res.json(row);
  });
});
// Trader financials
backend.get('/api/traders/financials', (req, res) => {
  db.all('SELECT * FROM trader_financials', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'خطأ في استرجاع السجلات المالية' });
    res.json(rows);
  });
});

// Routes للمشتريات
backend.get('/api/purchases', (req, res) => {
  db.all(`
    SELECT p.*,
    pd.Quantity AS detail_quantity,
    pd.UnitCost AS detail_unit_cost,
    pr.ProductName,
    s.Name AS SupplierName
    FROM purchases p
    LEFT JOIN purchase_details pd ON p.PurchaseID = pd.PurchaseID
    LEFT JOIN products pr ON pd.ProductID = pr.ProductID

    LEFT JOIN suppliers s ON p.SupplierName = s.Name
  `, (err, rows) => {
    if (err) {
      console.error('خطأ في استعلام المشتريات:', err);
      return res.status(500).json({ error: 'خطأ في استرجاع البيانات' });
    }
    res.json(rows);
  });
});

backend.post('/api/purchases', (req, res) => {
  const { supplier_name, notes, products } = req.body;
  if (!supplier_name || !Array.isArray(products)) return res.status(400).json({ error: 'بيانات غير كاملة' });
  const now = getCurrentDateTime();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Create purchase record
    db.run(
      'INSERT INTO purchases (SupplierName, PurchaseDate, TotalAmount, Notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [supplier_name, now, 0, notes || '', now, now],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'خطأ في إنشاء المشتريات' });
        }
        const purchaseID = this.lastID;
        let totalAmount = 0;
        
        products.forEach(item => {
          const { product_id, product_name, category, quantity, unit_cost, unit_price } = item;
          
          // If product exists, update its cost
          if (product_id) {
            db.get('SELECT StockQuantity, UnitCost FROM products WHERE ProductID = ?', [product_id], (err, product) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'خطأ في تحديث المنتج' });
              }
              
              const oldQuantity = product.StockQuantity || 0;
              const oldCost = product.UnitCost || 0;
              const newQuantity = quantity;
              const newCost = unit_cost;
              
              // Calculate weighted average cost
              const totalOldCost = oldQuantity * oldCost;
              const totalNewCost = newQuantity * newCost;
              const totalQuantity = oldQuantity + newQuantity;
              const newUnitCost = (totalOldCost + totalNewCost) / totalQuantity;
              
              // Update product
              db.run(
                'UPDATE products SET StockQuantity = StockQuantity + ?, UnitCost = ?, updated_at = ? WHERE ProductID = ?',
                [quantity, newUnitCost, now, product_id]
              );
            });
          } else {
            // New product
            db.run(
              'INSERT INTO products (ProductName, Category, StockQuantity, UnitPrice, UnitCost, IsActive, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [product_name, category, quantity, unit_price, unit_cost, 1, now, now],
              function(err) { 
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'خطأ في إضافة المنتج الجديد' });
                }
              }
            );
          }
          
          // Calculate subtotal for purchase details
          const subTotal = quantity * unit_cost;
          totalAmount += subTotal;
          
          // Add purchase detail
          db.run(
            'INSERT INTO purchase_details (PurchaseID, ProductID, Quantity, UnitCost, SubTotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [purchaseID, product_id, quantity, unit_cost, subTotal, now, now]
          );
        });
        
        // Update total amount in purchase
        db.run(
          'UPDATE purchases SET TotalAmount = ?, updated_at = ? WHERE PurchaseID = ?',
          [totalAmount, now, purchaseID]
        );
        
        db.run('COMMIT', err => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'خطأ في حفظ المشتريات' });
          }
          res.json({ purchaseID, totalAmount });
        });
      }
    );
  });
});

// Update purchase - IMPROVED
backend.put('/api/purchases/:id', (req, res) => {
  const purchaseID = req.params.id;
  const { supplier_name, purchase_date, notes, products } = req.body; // Expecting products array

  if (!purchase_date || !Array.isArray(products)) {
    return res.status(400).json({ error: 'بيانات غير كاملة أو غير صحيحة' });
  }

  const now = getCurrentDateTime();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Get the old purchase details to reverse their effect
    db.all('SELECT PurchaseDetailID, ProductID, Quantity, UnitCost FROM purchase_details WHERE PurchaseID = ?', [purchaseID], (err, oldDetails) => {
      if (err) {
        db.run('ROLLBACK');
        console.error("Error fetching old purchase details:", err);
        return res.status(500).json({ error: 'خطأ في استرجاع تفاصيل المشتريات القديمة' });
      }

      let productsToUpdate = {}; // Map ProductID to { oldQty, oldCost, newQty, newCost }

      // Add old details to the map
      oldDetails.forEach(d => {
        if (d.ProductID) {
          if (!productsToUpdate[d.ProductID]) {
            productsToUpdate[d.ProductID] = { ProductID: d.ProductID, removedQty: 0, removedCostTotal: 0, addedQty: 0, addedCostTotal: 0 };
          }
          productsToUpdate[d.ProductID].removedQty += d.Quantity;
          productsToUpdate[d.ProductID].removedCostTotal += d.Quantity * d.UnitCost;
        }
      });

      // Add new details to the map
      products.forEach(item => {
         // Basic validation for new items
         if (item.product_id == null || item.quantity == null || item.unit_cost == null || item.quantity <= 0 || item.unit_cost < 0) {
              db.run('ROLLBACK');
              return res.status(400).json({ error: 'بيانات منتج جديدة غير صحيحة', item: item });
         }

        if (!productsToUpdate[item.product_id]) {
          productsToUpdate[item.product_id] = { ProductID: item.product_id, removedQty: 0, removedCostTotal: 0, addedQty: 0, addedCostTotal: 0 };
        }
        productsToUpdate[item.product_id].addedQty += item.quantity;
        productsToUpdate[item.product_id].addedCostTotal += item.quantity * item.unit_cost;
      });


      // 2. Delete old purchase details
      db.run('DELETE FROM purchase_details WHERE PurchaseID = ?', [purchaseID], function(err) {
        if (err) {
          db.run('ROLLBACK');
          console.error("Error deleting old purchase details:", err);
          return res.status(500).json({ error: 'خطأ في حذف تفاصيل المشتريات القديمة' });
        }

        let totalAmount = 0;
        let detailsAddedCount = 0;
        const totalDetailsToAdd = products.length;

        // 3. Insert new purchase details and update product stock/cost
        if (totalDetailsToAdd === 0) {
             // If no products are in the new list, just update the purchase header and product stocks
             processProductUpdates();
        } else {
            products.forEach(item => {
              const { product_id, quantity, unit_cost } = item;
              const subTotal = quantity * unit_cost;
              totalAmount += subTotal;

              // Insert new detail
              db.run(
                'INSERT INTO purchase_details (PurchaseID, ProductID, Quantity, UnitCost, SubTotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [purchaseID, product_id, quantity, unit_cost, subTotal, now, now],
                function(err) {
                  if (err) {
                    // Log error but don't necessarily rollback immediately unless critical
                    console.error(`Error inserting new purchase detail for product ${product_id}:`, err);
                    // Continue processing others, handle potential partial update issue later or add robust error check
                  }
                  detailsAddedCount++;
                  if (detailsAddedCount === totalDetailsToAdd) {
                    // All details inserted (or attempted), now process product updates
                    processProductUpdates();
                  }
                }
              );
            });
        }


        function processProductUpdates() {
            let productUpdateCount = 0;
            const productIdsToUpdate = Object.keys(productsToUpdate);
            const totalProductsToUpdate = productIdsToUpdate.length;

            if (totalProductsToUpdate === 0) {
                 // If no products were involved (e.g., updated notes only, or empty products list),
                 // just update the purchase header and commit.
                 updatePurchaseHeaderAndCommit();
                 return;
            }

            productIdsToUpdate.forEach(pId => {
                const pUpdate = productsToUpdate[pId];
                db.get('SELECT StockQuantity, UnitCost FROM products WHERE ProductID = ?', [pUpdate.ProductID], (err, product) => {
                    if (err || !product) {
                       console.error(`Error fetching product ${pUpdate.ProductID} for update:`, err);
                       // This is a significant error, might need rollback or careful handling
                       productUpdateCount++; // Count it even on error to finish the loop
                       if (productUpdateCount === totalProductsToUpdate) {
                           updatePurchaseHeaderAndCommit();
                       }
                       return;
                    }

                    // Calculate the quantity and cost *before* this specific purchase's old details
                    // This requires a more complex historical cost tracking or recalculating from all *other* purchases.
                    // A simpler approach is to reverse the old effect, then apply the new effect.

                    // 1. Reverse the effect of the old details from this purchase
                    const qtyAfterRemovingOld = product.StockQuantity - pUpdate.removedQty;
                    // This reversal of cost is complex if other purchases happened since the original.
                    // A simpler (but less historically accurate) approach is to:
                    // Get current total cost: CurrentQty * CurrentCost
                    // Subtract the cost removed by deleting old details: removedQty * original_cost_of_those_items
                    // Problem: We don't easily have the *original* cost from the old detail here unless we fetched it earlier.
                    // Let's stick to the logic already present in DELETE: reverse weighted average.

                    // Calculate cost after reversing the OLD quantities/costs from THIS purchase
                    const costAfterRemovingOld = reverseWeightedAverageCost(product.StockQuantity, product.UnitCost, pUpdate.removedQty, pUpdate.removedCostTotal / (pUpdate.removedQty || 1));

                    // Calculate quantity after applying the NEW quantities from THIS purchase
                    const finalQty = qtyAfterRemovingOld + pUpdate.addedQty;

                     // Calculate cost after applying the NEW quantities/costs from THIS purchase
                     // This calculation should use the cost *after removing old* as the "old" base for the "new" addition
                     const finalCost = calculateWeightedAverageCost(qtyAfterRemovingOld, costAfterRemovingOld, pUpdate.addedQty, pUpdate.addedCostTotal / (pUpdate.addedQty || 1));


                    // Update product
                    db.run(
                      'UPDATE products SET StockQuantity = ?, UnitCost = ?, updated_at = ? WHERE ProductID = ?',
                      [finalQty, finalCost, now, pUpdate.ProductID],
                      (err) => {
                        if (err) {
                          console.error(`Error updating product stock/cost for ${pUpdate.ProductID}:`, err);
                          // Handle error, potentially rollback
                        }
                        productUpdateCount++;
                        if (productUpdateCount === totalProductsToUpdate) {
                          // All product updates done (or attempted), now update purchase header and commit
                          updatePurchaseHeaderAndCommit();
                        }
                      }
                    );
                });
            });
        }


        function updatePurchaseHeaderAndCommit() {
             // 4. Update total amount and header in purchase
            db.run(
              'UPDATE purchases SET SupplierName = ?, PurchaseDate = ?, TotalAmount = ?, Notes = ?, updated_at = ? WHERE PurchaseID = ?',
              [supplier_name, purchase_date, totalAmount, notes || '', now, purchaseID],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                   console.error("Error updating purchase header:", err);
                  return res.status(500).json({ error: 'خطأ في تحديث سجل المشتريات الرئيسي' });
                }

                // 5. Commit the transaction
                db.run('COMMIT', err => {
                  if (err) {
                    db.run('ROLLBACK');
                     console.error("Error committing purchase update transaction:", err);
                    return res.status(500).json({ error: 'خطأ في حفظ المعاملة' });
                  }
                  res.json({ purchaseID: purchaseID, totalAmount: totalAmount });
                });
              }
            );
        }

      }); // End oldDetails db.all
    }); // End db.serialize
  });
});

// Get single purchase details
backend.get('/api/purchases/:id', (req, res) => {
  const id = req.params.id;
  
  db.serialize(() => {
    // Get purchase header
    db.get(`
      SELECT 
        p.*,
        COALESCE(s.Name, p.SupplierName) as SupplierName
      FROM purchases p
      LEFT JOIN suppliers s ON p.SupplierName = s.Name
      WHERE p.PurchaseID = ?
    `, [id], (err, purchase) => {
      if (err || !purchase) {
        return res.status(404).json({ error: 'المشتريات غير موجودة' });
      }

      const formattedPurchase = {
        purchase_id: purchase.PurchaseID,
        supplier_name: purchase.SupplierName || '',
        notes: purchase.Notes || '',
        purchase_date: purchase.PurchaseDate || new Date().toISOString(),
        total_amount: purchase.TotalAmount || 0,
        products: []
      };

      // Check if it's a direct product purchase
      if (purchase.ProductID) {
        db.get('SELECT * FROM products WHERE ProductID = ?', [purchase.ProductID], (err, product) => {
          if (err || !product) {
            return res.json(formattedPurchase);
          }

          formattedPurchase.products = [{
            product_id: product.ProductID,
            product_name: product.ProductName,
            category: product.Category || 'General',
            quantity: purchase.Quantity || 0,
            unit_cost: purchase.UnitCost || 0,
            unit_price: product.UnitPrice || 0,
            sub_total: purchase.TotalAmount || 0
          }];

          res.json(formattedPurchase);
        });
      } else {
        // Get purchase details
        db.all(`
          SELECT 
            pd.*,
            p.ProductName,
            p.Category,
            p.UnitPrice
          FROM purchase_details pd
          LEFT JOIN products p ON pd.ProductID = p.ProductID
          WHERE pd.PurchaseID = ?
        `, [id], (err, details) => {
          if (err || !details) {
            return res.json(formattedPurchase);
          }

          formattedPurchase.products = details.map(detail => ({
            product_id: detail.ProductID,
            product_name: detail.ProductName || '',
            category: detail.Category || 'General',
            quantity: detail.Quantity || 0,
            unit_cost: detail.UnitCost || 0,
            unit_price: detail.UnitPrice || 0,
            sub_total: detail.SubTotal || 0
          }));

          res.json(formattedPurchase);
        });
      }
    });
  });

});

backend.delete('/api/purchases/:id', (req, res) => {
  const purchaseID = req.params.id;
  const now = getCurrentDateTime();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. Get the details to reverse product stock/cost changes
    db.all('SELECT ProductID, Quantity, UnitCost FROM purchase_details WHERE PurchaseID = ?', [purchaseID], (err, details) => {
      if (err) {
        db.run('ROLLBACK');
        console.error('Error fetching purchase details for deletion:', err);
        return res.status(500).json({ error: 'خطأ في استرجاع تفاصيل المشتريات للحذف' });
      }

      let processedDetails = 0;
      const totalDetails = details.length;

       if (totalDetails === 0) {
           // No details, just delete the purchase header
           deletePurchaseHeaderAndCommit();
           return;
       }


      details.forEach(detail => {
        if (!detail.ProductID) {
          processedDetails++;
          if (processedDetails === totalDetails) {
            deleteDetailsAndPurchaseHeader();
          }
          return;
        }

        // Get current product data
        db.get(
          'SELECT StockQuantity, UnitCost FROM products WHERE ProductID = ?',
          [detail.ProductID],
          (err, product) => {
            if (err || !product) {
               console.warn(`Product ${detail.ProductID} not found or error fetching for deletion reversal. Skipping stock update.`, err);
               processedDetails++; // Still count this detail as processed
               if (processedDetails === totalDetails) {
                  deleteDetailsAndPurchaseHeader();
               }
               return;
            }

            // Reverse the effect of this specific detail on the product's stock and weighted average cost
            const newQty = Math.max(0, (product.StockQuantity || 0) - (detail.Quantity || 0));
            const newUnitCost = reverseWeightedAverageCost(product.StockQuantity, product.UnitCost, detail.Quantity, detail.UnitCost);


            // Update product stock and cost
            db.run(
              'UPDATE products SET StockQuantity = ?, UnitCost = ?, updated_at = ? WHERE ProductID = ?',
              [newQty, newUnitCost, now, detail.ProductID],
              (err) => {
                if (err) {
                   console.error(`Error updating product ${detail.ProductID} stock/cost during purchase deletion:`, err);
                   // Continue, but log the error
                }
                processedDetails++;
                if (processedDetails === totalDetails) {
                  // All product updates done (or attempted)
                  deleteDetailsAndPurchaseHeader();
                }
              }
            );
          }
        ); // End db.get product
      }); // End details.forEach
    }); // End db.all details

    function deleteDetailsAndPurchaseHeader() {
         // 2. Delete the purchase details
        db.run('DELETE FROM purchase_details WHERE PurchaseID = ?', [purchaseID], err => {
          if (err) {
            db.run('ROLLBACK');
            console.error('Error deleting purchase details:', err);
            return res.status(500).json({ error: 'خطأ في حذف تفاصيل المشتريات' });
          }
          // 3. Delete the purchase header
          deletePurchaseHeaderAndCommit();
        });
    }

    function deletePurchaseHeaderAndCommit() {
         db.run('DELETE FROM purchases WHERE PurchaseID = ?', [purchaseID], function(err) {
            if (err) {
              db.run('ROLLBACK');
              console.error('Error deleting purchase header:', err);
              return res.status(500).json({ error: 'خطأ في حذف المشتريات الرئيسية' });
            }
            // 4. Commit the transaction
            db.run('COMMIT', err => {
              if (err) {
                db.run('ROLLBACK');
                console.error('Error committing purchase deletion transaction:', err);
                return res.status(500).json({ error: 'خطأ في حفظ التغييرات' });
              }
              res.json({ deleted: true });
            });
          });
    }
  }); // End db.serialize
});


// Get all expenses
backend.get('/api/expenses', (req, res) => {
  db.all('SELECT * FROM expenses ORDER BY ExpenseDate DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'خطأ في جلب بيانات المصروفات' });
    res.json(rows);
  });
});

// Delete expense
backend.delete('/api/expenses/:id', (req, res) => {
  db.run('DELETE FROM expenses WHERE ExpenseID = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'خطأ في حذف المصروف' });
    res.json({ deleted: this.changes });
  });
});

// CRUD Payments
backend.post('/api/payments', (req, res) => {
  const { TraderID, Amount, PaymentDate, SaleID } = req.body;
  if (!TraderID || Amount == null) {
    return res.status(400).json({ error: 'بيانات غير كاملة' });
  }
  const now = PaymentDate || getCurrentDateTime();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Record the payment
    db.run(
      'INSERT INTO payments (TraderID, SaleID, PaymentDate, Amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [TraderID, SaleID || null, now, Amount, now, now],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'خطأ في تسجيل الدفعة' });
        }

        // Update the sale if SaleID is provided
        if (SaleID) {
          db.get('SELECT * FROM sales WHERE SaleID = ?', [SaleID], (err, sale) => {
            if (err || !sale) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'فاتورة غير موجودة' });
            }
            const newPaidAmount = sale.PaidAmount + Amount;
            const newRemaining = sale.TotalAmount - newPaidAmount;

            db.run(
              'UPDATE sales SET PaidAmount = ?, RemainingAmount = ?, updated_at = ? WHERE SaleID = ?',
              [newPaidAmount, newRemaining, now, SaleID]
            );
          });
        }

        // Get current financial data for the trader
        db.get(
          'SELECT t.Balance, t.TotalSales, t.TotalPayments, f.balance as last_balance, f.total_sales as last_total_sales, f.total_payments as last_total_payments FROM traders t LEFT JOIN trader_financials f ON t.TraderID = f.trader_id WHERE t.TraderID = ? ORDER BY f.created_at DESC LIMIT 1',
          [TraderID],
          (err, financials) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'خطأ في تحديث الرصيد' });
            }

            const currentBalance = financials.last_balance || 0;
            const currentTotalSales = financials.last_total_sales || 0;
            const currentTotalPayments = financials.last_total_payments || 0;

            const newTotalPayments = currentTotalPayments + Amount;
            const newBalance = currentTotalSales - newTotalPayments;

            // Update trader's record
            db.run(
              'UPDATE traders SET Balance = ?, TotalPayments = ?, updated_at = ? WHERE TraderID = ?',
              [newBalance, newTotalPayments, now, TraderID]
            );

            // Update trader financials
            db.run(
              'INSERT INTO trader_financials (trader_id, payment_id, payment_amount, balance, total_sales, total_payments, remaining_amount, transaction_type, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [TraderID, this.lastID, Amount, newBalance, currentTotalSales, newTotalPayments, newBalance, 'payment', 'دفعة جديدة', now, now]
            );

            db.run('COMMIT', err => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'خطأ في حفظ المعاملة' });
              }
              res.json({ success: true, paymentID: this.lastID });
            });
          }
        );
      }
    );
  });
});

backend.get('/api/payments/:traderId', (req, res) => {
  const traderId = req.params.traderId;
  db.all(
    'SELECT p.*, s.InvoiceNumber, s.TotalAmount FROM payments p LEFT JOIN sales s ON p.SaleID = s.SaleID WHERE p.TraderID = ? ORDER BY p.PaymentDate DESC',
    [traderId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'خطأ في استرجاع الدفعات' });
      res.json(payments);
    }
  );
});

// CRUD Payments
backend.put('/api/payments/:id', (req, res) => {
  const { Amount, PaymentDate, SaleID } = req.body;
  const now = getCurrentDateTime();
  db.run(
    'UPDATE payments SET Amount = ?, PaymentDate = ?, SaleID = ?, updated_at = ? WHERE PaymentID = ?',
    [Amount, PaymentDate, SaleID, now, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في تحديث الدفعة' });
      res.json({ changes: this.changes });
    }
  );
});
backend.delete('/api/payments/:id', (req, res) => {
  db.run('DELETE FROM payments WHERE PaymentID = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'خطأ في حذف الدفعة' });
    res.json({ deleted: this.changes });
  });
});

// CRUD Traders
backend.post('/api/traders', (req, res) => {
  const { TraderName, Phone, Address, IsActive } = req.body;
  if (!TraderName) return res.status(400).json({ error: 'اسم العميل مطلوب' });
  const now = getCurrentDateTime();
  db.run(
    'INSERT INTO traders (TraderName, Phone, Address, Balance, TotalSales, TotalPayments, IsActive, created_at, updated_at) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?)',
    [TraderName, Phone, Address, IsActive ? 1 : 0, now, now],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في إنشاء العميل' });
      res.json({ TraderID: this.lastID });
    }
  );
});
backend.put('/api/traders/:id', (req, res) => {
  const { TraderName, Phone, Address, IsActive } = req.body;
  const now = getCurrentDateTime();
  db.run(
    'UPDATE traders SET TraderName = ?, Phone = ?, Address = ?, IsActive = ?, updated_at = ? WHERE TraderID = ?',
    [TraderName, Phone, Address, IsActive ? 1 : 0, now, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'خطأ في تحديث العميل' });
      res.json({ changes: this.changes });
    }
  );
});
backend.delete('/api/traders/:id', (req, res) => {
  db.run('DELETE FROM traders WHERE TraderID = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'خطأ في حذف العميل' });
    res.json({ deleted: this.changes });
  });
});

// Manual payments endpoint
backend.post('/api/manual-payments', (req, res) => {
  const { TraderID, Amount, PaymentDate, Note } = req.body;

  // Validate input
  if (!TraderID || !Amount || !PaymentDate) {
    return res.status(400).json({ error: 'جميع الحقول المطلوبة غير مكتملة' });
  }

  const amount = parseFloat(Amount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'المبلغ غير صالح' });
  }

  const now = getCurrentDateTime();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // First check if trader exists
    db.get('SELECT * FROM traders WHERE TraderID = ?', [TraderID], (err, trader) => {
      if (err) {
        console.error('Error checking trader:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'خطأ في التحقق من العميل' });
      }
      if (!trader) {
        db.run('ROLLBACK');
        return res.status(400).json({ error: 'العميل غير موجود' });
      }

      // Record payment
      db.run(
        'INSERT INTO payments (TraderID, Amount, PaymentDate, Notes, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
        [TraderID, Amount, PaymentDate || getCurrentDateTime(), Note || ''],
        function(err) {
          if (err) {
            console.error('Error inserting payment:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'خطأ في تسجيل الدفعة', details: err.message });
          }
          const paymentID = this.lastID;

          // Update trader's balance
          db.run(
            `UPDATE traders
             SET Balance = Balance - ?,
                 TotalPayments = TotalPayments + ?,
                 updated_at = datetime('now')
             WHERE TraderID = ?`,
            [Amount, Amount, TraderID]
          );

          // Update trader financials
          db.run(
            `INSERT INTO trader_financials
             (trader_id, payment_id, payment_amount, balance, total_payments, transaction_type, description, created_at)
             VALUES (?, ?, ?,
                     (SELECT Balance FROM traders WHERE TraderID = ?),
                     (SELECT TotalPayments FROM traders WHERE TraderID = ?),
                     'payment', ?, datetime('now'))`,
            [TraderID, paymentID, Amount, TraderID, TraderID, Note || 'Manual Payment']
          );

          db.run('COMMIT', function(err) {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ error: 'خطأ في إكمال المعاملة', details: err.message });
            }

            return res.json({
              message: 'تم إضافة الدفعة بنجاح',
              paymentID: paymentID,
              updatedBalance: trader.Balance - amount
            });
          });
        }
      );
    });
  });
});

// Get all payments
backend.get('/api/payments', (req, res) => {
  db.all(
    `SELECT p.PaymentID, p.TraderID, t.TraderName, p.SaleID, p.PaymentDate, p.Amount, p.created_at, p.updated_at
     FROM payments p
     LEFT JOIN traders t ON p.TraderID = t.TraderID
     ORDER BY p.PaymentDate DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'خطأ في استرجاع الدفعات' });
      res.json(rows);
    }
  );
});

// Get all payments for a trader
backend.get('/api/payments/trader/:traderId', (req, res) => {
  const traderId = req.params.traderId;
  db.all(
    'SELECT p.*, s.InvoiceNumber, s.TotalAmount, s.PaidAmount FROM payments p LEFT JOIN sales s ON p.SaleID = s.SaleID WHERE p.TraderID = ? ORDER BY p.PaymentDate DESC',
    [traderId],
    (err, payments) => {
      if (err) return res.status(500).json({ error: 'خطأ في استرجاع الدفعات' });
      res.json(payments);
    }
  );
});

// Clear all data
backend.post('/api/clear-data', (req, res) => {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Clear all tables while maintaining the schema
    const tables = [
      'payments',
      'sales',
      'sale_details',
      'products',
      'purchases',
      'purchase_details',
      'expenses',
      'trader_financials',
      'traders'
    ];

    tables.forEach(table => {
      db.run(`DELETE FROM ${table}`);
    });

    db.run('COMMIT', err => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'خطأ في مسح البيانات' });
      }
      res.json({ success: true, message: 'تم مسح جميع البيانات بنجاح' });
    });
  });
});

backend.listen(PORT, () => {
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Add these settings to disable unnecessary Chrome features
      enableWebSQL: false,
      spellcheck: false,
      autoHideMenuBar: true
    }
  });

  // Disable autofill
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      document.querySelectorAll('input').forEach(input => {
        input.setAttribute('autocomplete', 'off');
      });
    `);
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('خطأ عند إغلاق قاعدة البيانات:', err);
      } else {
      }
    });
  }
});
// Add this with your other IPC handlers
ipcMain.handle('addManualPayment', async (event, payload) => {
  const db = await getDatabaseConnection();
  try {
    await db.run('BEGIN TRANSACTION');

    // 1. Insert payment record
    const paymentResult = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (TraderID, Amount, PaymentDate, Notes, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [payload.TraderID, payload.Amount, payload.PaymentDate || getCurrentDateTime(), payload.Note || ''],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    // 2. Update trader's balance
    await db.run(
      `UPDATE traders
       SET Balance = Balance - ?,
           TotalPayments = TotalPayments + ?,
           updated_at = datetime('now')
       WHERE TraderID = ?`,
      [payload.Amount, payload.Amount, payload.TraderID]
    );

    // 3. Record in financials
    await db.run(
      `INSERT INTO trader_financials
       (trader_id, payment_id, payment_amount, balance, total_payments, transaction_type, description, created_at)
       VALUES (?, ?, ?,
               (SELECT Balance FROM traders WHERE TraderID = ?),
               (SELECT TotalPayments FROM traders WHERE TraderID = ?),
               'payment', ?, datetime('now'))`,
      [payload.TraderID, paymentResult, payload.Amount, payload.TraderID, payload.TraderID, payload.Note || 'Manual Payment']
    );

    await db.run('COMMIT');
    return { success: true, paymentID: paymentResult };

  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Payment processing error:', error);
    return { success: false, error: error.message };
  }
});
// =====================================================================================================

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3001">
  <title>لوحة التحكم</title>
  <link href="public/css/output.css" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Cairo';
      src: url('./node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff2') format('woff2'),
           url('./node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff') format('woff');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Cairo';
      src: url('./node_modules/@fontsource/cairo/files/cairo-arabic-600-normal.woff2') format('woff2'),
           url('./node_modules/@fontsource/cairo/files/cairo-arabic-600-normal.woff') format('woff');
      font-weight: 600;
      font-style: normal;
    }
    @font-face {
      font-family: 'Cairo';
      src: url('./node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff2') format('woff2'),
           url('./node_modules/@fontsource/cairo/files/cairo-arabic-700-normal.woff') format('woff');
      font-weight: 700;
      font-style: normal;
    }
    body {
      font-family: 'Cairo', sans-serif;
      transition: background-color 0.3s, color 0.3s;
    }
    .sidebar {
      transition: width 0.3s;
    }
    .sidebar.collapsed {
      width: 80px;
    }
    .sidebar.collapsed .sidebar-text {
      display: none;
    }
    .sidebar.collapsed .sidebar-icon {
      margin-right: 0; /* Adjust icon margin when collapsed if needed */
    }
    .table-row:nth-child(even) {
      background-color: #f9fafb; /* light gray */
    }
    .table-row:hover {
      background-color: #e5e7eb; /* darker gray */
    }
  </style>
  <!-- Modern form labels and input styling -->
  <style>
    /* Style labels in forms */
    #content form label {
      display: block; /* Make labels take their own line */
      font-size: 0.875rem; /* 14px */
      font-weight: 500; /* Medium weight */
      color: #374151; /* Gray-700 */
      margin-bottom: 0.25rem; /* Add space below the label */
    }
    /* Style inputs, selects, and textareas in forms */
    #content form input[type="text"],
    #content form input[type="number"],
    #content form input[type="date"],
    #content form select,
    #content form textarea {
      margin-top: 0.25rem; /* Add space above the input if the label is above it */
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem; /* Adjust padding */
      border: 1px solid #D1D5DB; /* Gray-300 border */
      border-radius: 0.375rem; /* Rounded corners */
      box-shadow: 0 1px 2px rgba(0,0,0,0.05); /* Subtle shadow */
      background-color: #fff; /* White background */
      color: #1f2937; /* Gray-800 text */
    }
    /* Focus state for inputs, selects, textareas */
    #content form input[type="text"]:focus,
    #content form input[type="number"]:focus,
    #content form input[type="date"]:focus,
    #content form select:focus,
    #content form textarea:focus {
      outline: none;
      border-color: #3B82F6; /* Blue-500 border */
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3); /* Blue focus ring */
    }
    /* Specific styling for dynamically added rows if needed */
    #productRows > div, #purchaseRows > div {
      margin-bottom: 0.5rem; /* Add space between dynamic rows */
    }
  </style>
</head>
<body class="bg-gray-100 text-gray-900">
  <!-- Header -->
  <header class="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
    <div class="flex items-center space-x-4">
      <button id="toggleSidebar" class="text-gray-600 hover:text-blue-600 focus:outline-none">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>
      <h1 class="text-xl font-semibold">مرحبا، <span id="userName" class="font-bold"></span></h1>
    </div>
    <button id="logout" class="bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200">
      تسجيل الخروج
    </button>
  </header>

  <!-- Layout -->
  <div class="flex min-h-[calc(100vh-64px)]">
    <!-- Sidebar -->
    <nav id="sidebar" class="sidebar w-64 bg-white p-6 border-r shadow-lg transition-all duration-300">
      <ul class="space-y-3">
        <li>
          <a href="#" data-page="dashboard-stats" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-cyan-100 hover:text-cyan-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17a2.5 2.5 0 01-2.45-2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2h-3.55A2.5 2.5 0 0113 17v1a1 1 0 01-2 0v-1z" />
            </svg>
            <span class="sidebar-text text-lg font-medium">لوحة التحكم</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="sales" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span class="sidebar-text text-lg font-medium">الفواتير</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="products" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-green-100 hover:text-green-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span class="sidebar-text text-lg font-medium">المنتجات</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="traders" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-purple-100 hover:text-purple-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span class="sidebar-text text-lg font-medium">العملاء</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="purchases" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-yellow-100 hover:text-yellow-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span class="sidebar-text text-lg font-medium">المشتريات</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="expenses" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span class="sidebar-text text-lg font-medium">المصروفات</span>
          </a>
        </li>
        <li>
          <a href="#" data-page="payments" class="flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-orange-100 hover:text-orange-600 transition-colors duration-200">
            <svg class="sidebar-icon w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span class="sidebar-text text-lg font-medium">الدفعات</span>
          </a>
        </li>
      </ul>
    </nav>

    <!-- Content -->
    <main id="content" class="flex-1 p-6 overflow-auto">
      <!-- Content will be dynamically loaded here -->
    </main>
  </div>

  <script>
    // Auth guard
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) window.location.href = 'index.html';
    document.getElementById('userName').innerText = user.name;
    document.getElementById('logout').addEventListener('click', () => {
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    });
    // Helper: format date string for display
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);
    }
    // Helper: format date for input type="date"
    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Loader functions (Tables remain mostly the same)
    async function loadSales() {
      const res = await fetch('http://localhost:3001/api/sales');
      const data = await res.json();
      let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">قائمة الفواتير</h2>'
        + '<button id="addSaleBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إنشاء فاتورة</button>'
      + '</div>';
      html += '<div class="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">'
        + '<label class="block mb-2" for="salesFilterStart">من تاريخ</label>'
        + '<input type="date" id="salesFilterStart" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="salesFilterEnd">إلى تاريخ</label>'
        + '<input type="date" id="salesFilterEnd" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="salesFilterMin">الحد الأدنى للإجمالي</label>'
        + '<input type="number" id="salesFilterMin" class="border px-3 py-2 rounded" placeholder="0.00" step="0.01" />'
        + '<label class="block mb-2" for="salesFilterMax">الحد الأقصى للإجمالي</label>'
        + '<input type="number" id="salesFilterMax" class="border px-3 py-2 rounded" placeholder="0.00" step="0.01" />'
      + '</div>';
      if (!res.ok) html += `<p class="text-red-600">${data.error}</p>`;
      else if (data.length === 0) html += '<p>لا توجد فواتير.</p>';
      else {
        html += '<table class="min-w-full bg-white border">';
        html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">العميل</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجمالي</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
        html += '<tbody>';
        data.forEach(s => {
          html += `<tr class="table-row" data-sale-date="${formatDateForInput(s.SaleDate)}" data-sale-total="${(s.TotalAmount || 0).toFixed(2)}">
            <td class="border px-2 py-1">${s.SaleID}</td>
            <td class="border px-2 py-1">${s.trader?.TraderName || '-'}</td>
            <td class="border px-2 py-1">${formatDate(s.SaleDate)}</td>
            <td class="border px-2 py-1">${(s.TotalAmount?.toFixed(2) || '0.00')}</td>
            <td class="border px-2 py-1 space-x-2">
            <button class="view-sale text-blue-600 hover:underline" data-id="${s.SaleID}">عرض</button>
            <button class="edit-sale text-green-600 hover:underline" data-id="${s.SaleID}">تعديل</button>
            <button class="delete-sale text-red-600 hover:underline" data-id="${s.SaleID}">حذف</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table>';
      }
      document.getElementById('content').innerHTML = html;
      document.getElementById('addSaleBtn')?.addEventListener('click', showAddSaleForm); // Add null check
      document.querySelectorAll('.view-sale').forEach(btn => btn.addEventListener('click', () => showSaleDetails(btn.dataset.id)));
      document.querySelectorAll('.edit-sale').forEach(btn => btn.addEventListener('click', () => showEditSaleForm(btn.dataset.id)));
      document.querySelectorAll('.delete-sale').forEach(btn => btn.addEventListener('click', () => deleteSale(btn.dataset.id)));

      // Sales filter logic
      const filterSales = () => {
        const start = document.getElementById('salesFilterStart').value;
        const end = document.getElementById('salesFilterEnd').value;
        const min = parseFloat(document.getElementById('salesFilterMin').value);
        const max = parseFloat(document.getElementById('salesFilterMax').value);
        document.querySelectorAll('#content table tbody tr').forEach(row => {
          const date = row.dataset.saleDate;
          const total = parseFloat(row.dataset.saleTotal);
          let show = true;
          if (start && date < start) show = false;
          if (end && date > end) show = false;
          if (!isNaN(min) && total < min) show = false;
          if (!isNaN(max) && total > max) show = false;
          row.style.display = show ? '' : 'none';
        });
      };
      ['input','change'].forEach(evt => {
        ['salesFilterStart','salesFilterEnd','salesFilterMin','salesFilterMax'].forEach(id => {
          document.getElementById(id).addEventListener(evt, filterSales);
        });
      });
    }
    async function loadProducts() {
      const res = await fetch('http://localhost:3001/api/products');
      const data = await res.json();
      let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">المنتجات</h2>'
        + '<button id="addProductBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة منتج</button>'
      + '</div>';
      html += '<div class="mb-4"><input type="text" id="productsSearchInput" placeholder="بحث..." class="border px-3 py-2 rounded w-full"></div>';
      html += '<table class="min-w-full bg-white border">';
      html += '<thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الصنف</th><th class="border px-2 py-1">الكمية</th><th class="border px-2 py-1">سعر البيع</th><th class="border px-2 py-1">سعر التكلفة</th><th class="border px-2 py-1">الإجراءات</th></tr></thead>';
      html += '<tbody>';
      if (res.ok && data.length) {
        data.forEach(p => {
            html += `<tr class="table-row"><td class="border px-2 py-1">${p.ProductID}</td><td class="border px-2 py-1">${p.ProductName}</td><td class="border px-2 py-1">${p.Category}</td><td class="border px-2 py-1">${p.StockQuantity}</td><td class="border px-2 py-1">${p.UnitPrice.toFixed(2)}</td><td class="border px-2 py-1">${p.UnitCost ? p.UnitCost.toFixed(2) : '-'}</td><td class="border px-2 py-1"><button data-id="${p.ProductID}" class="edit-product bg-yellow-400 px-2 py-1 rounded mr-1 hover:bg-yellow-500">تعديل</button><button data-id="${p.ProductID}" class="delete-product bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">حذف</button></td></tr>`;
        });
      } else html += '<tr><td colspan="7" class="text-center py-2">لا توجد بيانات</td></tr>'; // Updated colspan
      html += '</tbody></table>';
      document.getElementById('content').innerHTML = html;
      document.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', () => showEditProductForm(btn.dataset.id)));
      document.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.id)));
      document.getElementById('addProductBtn')?.addEventListener('click', showAddProductForm); // Add null check
      const productsSearchEl = document.getElementById('productsSearchInput');
      if (productsSearchEl) {
        productsSearchEl.addEventListener('input', () => {
          const filter = productsSearchEl.value.trim().toLowerCase();
          document.querySelectorAll('#content table tbody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
          });
        });
      }
    }
    async function loadTraders() {
      const res = await fetch('http://localhost:3001/api/traders');
      const data = await res.json();
      let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">العملاء</h2>'
        + '<button id="addTraderBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة عميل</button>'
      + '</div>';
      html += '<div class="mb-4"><input type="text" id="tradersSearchInput" placeholder="بحث..." class="border px-3 py-2 rounded w-full"></div>';
      html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الاسم</th><th class="border px-2 py-1">الرصيد الحالي</th><th class="border px-2 py-1">الإجراءات</th></tr></thead><tbody>';
      if (res.ok && data.length) {
        // Fetch all sales and payments once for efficiency
        const [allSalesRes, allPaymentsRes] = await Promise.all([
            fetch('http://localhost:3001/api/sales'),
            fetch('http://localhost:3001/api/payments')
        ]);
        const allSales = await allSalesRes.json();
        const allPayments = await allPaymentsRes.json();

        await Promise.all(data.map(async t => {
            // Filter sales and payments for the current trader
            const traderSales = allSales.filter(sale => sale.TraderID === t.TraderID);
            const traderPayments = allPayments.filter(payment => payment.TraderID === t.TraderID);

            // Calculate totals for this trader
            const totalSalesAmount = traderSales.reduce((sum, sale) => sum + (sale.TotalAmount || 0), 0);
            const totalPaidOnSales = traderSales.reduce((sum, sale) => sum + (sale.PaidAmount || 0), 0);
            const totalManualPayments = traderPayments.reduce((sum, payment) => sum + (payment.Amount || 0), 0);

            // Calculate balance: Total Payments (manual + on sales) - Total Sales Amount
            const balance = (totalManualPayments + totalPaidOnSales) - totalSalesAmount;

            const balanceClass = balance < 0 ? 'text-red-600' : 'text-green-600';
            const balanceSign = balance >= 0 ? '+' : ''; // Show + for zero or positive
            const balanceValue = Math.abs(balance).toFixed(2);

            // Update trader's balance in the database (Consider if this is needed on every load)
            /*
            try {
              await fetch(`http://localhost:3001/api/traders/${t.TraderID}/balance`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ balance }) // Send the calculated balance
              });
            } catch (error) {
              console.error(`Error updating balance for trader ${t.TraderID}:`, error);
            }
            */

            html += `<tr class="table-row">
                <td class="border px-2 py-1">${t.TraderID}</td>
                <td class="border px-2 py-1">${t.TraderName}</td>
                <td class="border px-2 py-1 font-semibold ${balanceClass}">${balanceSign}${balanceValue}</td>
                <td class="border px-2 py-1">
                <button data-id="${t.TraderID}" class="view-trader bg-blue-500 text-white px-2 py-1 rounded mr-1 hover:bg-blue-600">عرض</button>
                <button data-id="${t.TraderID}" class="manual-payment bg-purple-500 text-white px-2 py-1 rounded mr-1 hover:bg-purple-600">إضافة دفعة</button>
                <button data-id="${t.TraderID}" class="edit-trader bg-yellow-400 px-2 py-1 rounded mr-1 hover:bg-yellow-500">تعديل</button>
                <button data-id="${t.TraderID}" class="delete-trader bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">حذف</button>
                </td>
            </tr>`;
        }));
      } else {
        html += '<tr><td colspan="4" class="text-center py-2">لا توجد بيانات</td></tr>'; // Updated colspan
      }
      html += '</tbody></table>';
      document.getElementById('content').innerHTML = html;
      document.getElementById('addTraderBtn')?.addEventListener('click', showAddTraderForm);
      document.querySelectorAll('.view-trader').forEach(btn => btn.addEventListener('click', e => showTraderDetails(e.target.dataset.id)));
      document.querySelectorAll('.manual-payment').forEach(btn => btn.addEventListener('click', e => showManualPaymentForm(e.target.dataset.id))); // Keep this or remove if details view is preferred
      document.querySelectorAll('.edit-trader').forEach(btn => btn.addEventListener('click', e => showEditTraderForm(e.target.dataset.id)));
      document.querySelectorAll('.delete-trader').forEach(btn => btn.addEventListener('click', e => deleteTrader(e.target.dataset.id)));
      const searchInput = document.getElementById('tradersSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          const filter = searchInput.value.trim().toLowerCase();
          document.querySelectorAll('#content table tbody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
          });
        });
      }
    }


    async function loadPurchases() {
        try {
            // Fetch flattened purchase data from the backend
            const res = await fetch('http://localhost:3001/api/purchases');
            if (!res.ok) {
                const error = await res.text(); // Get error as text
                throw new Error(`HTTP error! status: ${res.status}, message: ${error}`);
            }
            const data = await res.json();

            // --- Build HTML for the list view ---
            let html = `
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-2xl font-semibold">المشتريات</h2>
                    <button id="addPurchaseBtn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">+ إنشاء سجل مشتريات</button>
                </div>
                <div class="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label for="purchasesFilterStart" class="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                        <input type="date" id="purchasesFilterStart" class="w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                         <label for="purchasesFilterEnd" class="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
                        <input type="date" id="purchasesFilterEnd" class="w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                         <label for="purchasesFilterMin" class="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للإجمالي</label>
                         <input type="number" id="purchasesFilterMin" placeholder="0.00" step="0.01" class="w-full border px-3 py-2 rounded" />
                    </div>
                    <div>
                         <label for="purchasesFilterMax" class="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى للإجمالي</label>
                        <input type="number" id="purchasesFilterMax" placeholder="0.00" step="0.01" class="w-full border px-3 py-2 rounded" />
                    </div>
                </div>
                 <div class="mb-4">
                     <input type="text" id="purchasesSearchInput" placeholder="بحث (المورد، المنتجات...)" class="border px-3 py-2 rounded w-full">
                 </div>
                <table class="min-w-full bg-white border">
                    <thead>
                        <tr>
                            <th class="border px-2 py-1">ID</th>
                            <th class="border px-2 py-1">التاريخ</th>
                            <th class="border px-2 py-1">المورد</th>
                             <th class="border px-2 py-1">المنتجات (الكمية × التكلفة)</th>
                            <th class="border px-2 py-1">الإجمالي</th>
                            <th class="border px-2 py-1">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="purchasesTableBody">
                    </tbody>
                </table>
            `;
            document.getElementById('content').innerHTML = html;

            // Add event listener for add button
            document.getElementById('addPurchaseBtn')?.addEventListener('click', showAddPurchaseForm);

            // --- Process and display data ---
            const tbody = document.getElementById('purchasesTableBody');
            tbody.innerHTML = ''; // Clear previous content

            if (!Array.isArray(data) || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">لا توجد مشتريات مسجلة.</td></tr>';
                return;
            }

            // Group purchases by PurchaseID for display in the list
            const groupedPurchases = {};
            data.forEach(item => {
                 const purchaseId = item.PurchaseID;
                 if (!groupedPurchases[purchaseId]) {
                     groupedPurchases[purchaseId] = {
                         PurchaseID: purchaseId,
                         PurchaseDate: item.PurchaseDate,
                         SupplierName: item.SupplierDisplayName || item.SupplierName || '', // Fallback to original SupplierName if SupplierDisplayName is null
                         TotalAmount: 0, // Will sum from details or use main total
                         Notes: item.Notes || '',
                         productsSummary: [],
                         // Store original TotalAmount from the header for filtering/sorting purposes
                         headerTotalAmount: item.TotalAmount
                     };
                 }

                 // Add product detail summary if detail exists (ProductID or detail_quantity implies it's a detail row)
                 if (item.ProductID || item.detail_quantity != null) {
                     const productName = item.ProductName || 'منتج غير معروف';
                     const quantity = item.detail_quantity || item.Quantity || 0; // Use detail qty if available
                     const unitCost = item.detail_unit_cost || item.UnitCost || 0; // Use detail cost if available
                     const subTotal = quantity * unitCost;

                      // If the main purchase has ProductID, use its direct data (older simple purchase structure)
                     if (item.ProductID && !item.detail_quantity && item.PurchaseID === item.ProductID) { // Check if it looks like the old simple purchase structure
                         groupedPurchases[purchaseId].productsSummary.push(
                              `${productName} (${item.Quantity || 0} × ${item.UnitCost ? item.UnitCost.toFixed(2) : 'N/A'})` // Use main item data
                         );
                         groupedPurchases[purchaseId].TotalAmount = item.TotalAmount || 0; // Use main item total
                     } else if (item.detail_quantity != null || item.ProductID != null) {
                          // Use detail data for multi-item purchases or newer single-item purchase_details structure
                           groupedPurchases[purchaseId].productsSummary.push(
                              `${productName} (${quantity || 0} × ${unitCost.toFixed(2)})`
                          );
                          // Only sum from details if this purchase has details (check if any detail was added)
                          // A more robust way might be to check if the groupedPurchase object already has details pushed
                          groupedPurchases[purchaseId].TotalAmount += subTotal; // Sum subtotal from details
                     }
                 } else {
                     // This case might happen if a purchase header exists but has no details yet,
                     // or if the join didn't find matches. Display header total if available.
                     if (item.TotalAmount != null) {
                          groupedPurchases[purchaseId].TotalAmount = item.TotalAmount;
                     }
                 }
            });

             // Recalculate TotalAmount for purchases that were just headers or had missing details
             // Ensure the final TotalAmount displayed is either the sum of details or the header total if no details were found
             Object.keys(groupedPurchases).forEach(pId => {
                 // If productsSummary was populated, TotalAmount is already summed from details.
                 // If productsSummary is empty, use the headerTotalAmount if available.
                 if (groupedPurchases[pId].productsSummary.length === 0 && groupedPurchases[pId].headerTotalAmount != null) {
                     groupedPurchases[pId].TotalAmount = groupedPurchases[pId].headerTotalAmount;
                 } else if (groupedPurchases[pId].productsSummary.length > 0) {
                     // Recalculate total just in case the initial sum missed some details due to join structure
                     let currentTotal = 0;
                      data.filter(item => item.PurchaseID === groupedPurchases[pId].PurchaseID && (item.detail_quantity != null || item.ProductID != null)) // Filter original flat data for this purchase with details
                          .forEach(item => {
                               const quantity = item.detail_quantity || item.Quantity || 0;
                               const unitCost = item.detail_unit_cost || item.UnitCost || 0;
                               currentTotal += quantity * unitCost;
                          });
                      groupedPurchases[pId].TotalAmount = currentTotal;
                 } else {
                     // No details and no header total? Default to 0.
                     groupedPurchases[pId].TotalAmount = 0;
                 }
             });


            // Sort purchases by date descending
             const sortedPurchases = Object.values(groupedPurchases).sort((a, b) => new Date(b.PurchaseDate) - new Date(a.PurchaseDate));


            // Populate table rows from grouped data
            sortedPurchases.forEach(p => {
                const row = document.createElement('tr');
                row.className = 'table-row';
                 // Use headerTotalAmount for data-total attribute if available, fallback to calculated total
                const filterTotal = p.headerTotalAmount != null ? p.headerTotalAmount : p.TotalAmount;

                row.dataset.purchaseDate = formatDateForInput(p.PurchaseDate);
                row.dataset.purchaseTotal = filterTotal.toFixed(2);


                row.innerHTML = `
                    <td class="border px-2 py-1">${p.PurchaseID}</td>
                    <td class="border px-2 py-1">${formatDate(p.PurchaseDate)}</td>
                    <td class="border px-2 py-1">${p.SupplierName}</td>
                     <td class="border px-2 py-1 text-sm">${p.productsSummary.join(', ') || 'لا توجد منتجات'}</td>
                    <td class="border px-2 py-1">${p.TotalAmount.toFixed(2)}</td>
                    <td class="border px-2 py-1 space-x-2">
                        <button data-id="${p.PurchaseID}" class="view-purchase text-blue-600 hover:underline">عرض</button>
                        <button data-id="${p.PurchaseID}" class="edit-purchase text-yellow-600 hover:underline">تعديل</button>
                        <button data-id="${p.PurchaseID}" class="delete-purchase text-red-600 hover:underline">حذف</button>
                    </td>
                `;
                tbody.appendChild(row);
            });

            // Add event listeners for view, edit, and delete buttons
             document.querySelectorAll('.view-purchase').forEach(btn => {
                 btn.addEventListener('click', () => showPurchaseDetails(btn.dataset.id));
             });
             document.querySelectorAll('.edit-purchase').forEach(btn => {
                 btn.addEventListener('click', () => showEditPurchaseForm(btn.dataset.id));
             });
             document.querySelectorAll('.delete-purchase').forEach(btn => {
                 btn.addEventListener('click', async () => { // Make delete async
                     const id = btn.dataset.id;
                     deletePurchase(id); // Call the delete function
                 });
             });


            // Purchases filter logic (using data attributes)
            const filterPurchases = () => {
                const start = document.getElementById('purchasesFilterStart').value;
                const end = document.getElementById('purchasesFilterEnd').value;
                const min = parseFloat(document.getElementById('purchasesFilterMin').value);
                const max = parseFloat(document.getElementById('purchasesFilterMax').value);
                const text = document.getElementById('purchasesSearchInput').value.trim().toLowerCase();

                document.querySelectorAll('#purchasesTableBody tr').forEach(row => {
                    const date = row.dataset.purchaseDate;
                    const total = parseFloat(row.dataset.purchaseTotal);
                    const rowText = row.textContent.toLowerCase();

                    let show = true;
                    if (start && date < start) show = false;
                    if (end && date > end) show = false;
                    if (!isNaN(min) && total < min) show = false;
                    if (!isNaN(max) && total > max) show = false;
                    if (text && !rowText.includes(text)) show = false;

                    row.style.display = show ? '' : 'none';
                });
            };
            // Add event listeners to filter inputs/changes
            ['input','change'].forEach(evt => {
                ['purchasesFilterStart','purchasesFilterEnd','purchasesFilterMin','purchasesFilterMax','purchasesSearchInput'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.addEventListener(evt, filterPurchases);
                });
            });


        } catch (error) {
            console.error('Error loading purchases:', error);
            document.getElementById('content').innerHTML =
                `<p class="text-red-600 p-4">حدث خطأ أثناء تحميل المشتريات: ${error.message}</p>`;
        }
    }

    


    async function loadExpenses() {
      const res = await fetch('http://localhost:3001/api/expenses');
      const data = await res.json();
      let html = '<div class="flex justify-between items-center mb-4">'
        + '<h2 class="text-2xl">المصروفات</h2>'
        + '<button id="addExpenseBtn" class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">+ إضافة مصروف</button>'
      + '</div>';
      html += '<div class="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">'
        + '<label class="block mb-2" for="expensesFilterStart">من تاريخ</label>'
        + '<input type="date" id="expensesFilterStart" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="expensesFilterEnd">إلى تاريخ</label>'
        + '<input type="date" id="expensesFilterEnd" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="expensesFilterMin">الحد الأدنى للمبلغ</label>'
        + '<input type="number" id="expensesFilterMin" placeholder="0.00" step="0.01" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="expensesFilterMax">الحد الأقصى للمبلغ</label>'
        + '<input type="number" id="expensesFilterMax" placeholder="0.00" step="0.01" class="border px-3 py-2 rounded" />'
        + '<label class="block mb-2" for="expensesFilterText">بحث نصي</label>'
        + '<input type="text" id="expensesFilterText" placeholder="بحث بالوصف أو التاريخ..." class="border px-3 py-2 rounded" />'
      + '</div>';
      html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID</th><th class="border px-2 py-1">الوصف</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجراءات</th></tr></thead><tbody>';
      if (res.ok && data.length) {
        data.forEach(e => {
          html += `<tr class="table-row" data-expense-date="${formatDateForInput(e.ExpenseDate)}" data-expense-amount="${e.Amount.toFixed(2)}">
            <td class="border px-2 py-1">${e.ExpenseID}</td>
            <td class="border px-2 py-1">${e.Description}</td>
            <td class="border px-2 py-1">${e.Amount.toFixed(2)}</td>
            <td class="border px-2 py-1">${formatDate(e.ExpenseDate)}</td>
            <td class="border px-2 py-1"><button data-id="${e.ExpenseID}" class="edit-expense text-yellow-600 hover:underline mr-2">تعديل</button><button data-id="${e.ExpenseID}" class="delete-expense text-red-600 hover:underline">حذف</button></td>
          </tr>`;
        });
      } else html += '<tr><td colspan="5" class="text-center py-2">لا توجد بيانات</td></tr>';
      html += '</tbody></table>';
      document.getElementById('content').innerHTML = html;
      document.getElementById('addExpenseBtn')?.addEventListener('click', showAddExpenseForm); // Add null check



      function showAddExpenseForm() {
  const html = `
    <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
      <h3 class="text-xl font-semibold mb-6 text-gray-700">إضافة مصروف جديد</h3>
      <div id="expenseMsg" class="mb-4"></div>
      <form id="expenseForm" class="space-y-4">
        <div>
          <label for="expenseDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ المصروف</label>
          <input type="date" id="expenseDate" name="expenseDate" class="mt-1 block w-full" required />
        </div>
        <div>
          <label for="expenseDesc" class="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <input type="text" id="expenseDesc" name="expenseDesc" placeholder="مثال: إيجار، كهرباء..." class="mt-1 block w-full" required />
        </div>
        <div>
          <label for="expenseAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
          <input type="number" id="expenseAmount" name="expenseAmount" step="0.01" min="0" class="mt-1 block w-full" required />
        </div>
        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ</button>
      </form>
    </div>
  `;
  document.getElementById('content').innerHTML = html;

  document.getElementById('expenseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const expenseDate = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const msgDiv = document.getElementById('expenseMsg');
    if (!expenseDate || !description || isNaN(amount) || amount <= 0) {
      msgDiv.innerHTML = '<p class="text-red-600">جميع الحقول مطلوبة والمبلغ يجب أن يكون أكبر من صفر.</p>';
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ExpenseDate: expenseDate, Description: description, Amount: amount })
      });
      const data = await res.json();
      if (res.ok) {
        loadExpenses();
      } else {
        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء الحفظ.'}</p>`;
      }
    } catch (error) {
      msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
    }
  });
}


async function deleteExpense(expenseId) {
        if (!confirm(`هل أنت متأكد من حذف المصروف رقم ${expenseId}؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }

        try {
            const res = await fetch(`http://localhost:3001/api/expenses/${expenseId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (res.ok) {
                // Reload expenses list after successful deletion
                loadExpenses();
            } else {
                alert(`فشل حذف المصروف: ${data.error || 'خطأ غير معروف.'}`);
            }
        } catch (error) {
            console.error("Error deleting expense:", error);
            alert('حدث خطأ أثناء محاولة حذف المصروف.');
        }
    }
        // --- Edit Expense Form ---
        async function showEditExpenseForm(expenseId) {
        try {
            const res = await fetch(`http://localhost:3001/api/expenses/${expenseId}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Expense with ID ${expenseId} not found`);
            }
            const expense = await res.json();

            const html = `
            <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل المصروف</h3>
                <div id="expenseMsg" class="mb-4"></div>
                <form id="editExpenseForm" class="space-y-4">
                    <input type="hidden" id="editExpenseId" value="${expense.ExpenseID}">
                    <div>
                        <label for="editExpenseDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ المصروف</label>
                        <input type="date" id="editExpenseDate" value="${formatDateForInput(expense.ExpenseDate)}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                        <label for="editExpenseDesc" class="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                        <input type="text" id="editExpenseDesc" value="${expense.Description}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                        <label for="editExpenseAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                        <input type="number" step="0.01" min="0" id="editExpenseAmount" value="${expense.Amount.toFixed(2)}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                        <button type="button" id="cancelEditExpense" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">رجوع</button>
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
            </div>`;

            document.getElementById('content').innerHTML = html;

            document.getElementById('cancelEditExpense')?.addEventListener('click', loadExpenses);

            document.getElementById('editExpenseForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('expenseMsg');
                msgDiv.innerHTML = '';

                const payload = {
                    ExpenseDate: document.getElementById('editExpenseDate').value,
                    Description: document.getElementById('editExpenseDesc').value.trim(),
                    Amount: parseFloat(document.getElementById('editExpenseAmount').value)
                };

                if (!payload.ExpenseDate || !payload.Description || isNaN(payload.Amount) || payload.Amount <= 0) {
                    msgDiv.innerHTML = '<p class="text-red-600">يرجى التأكد من إدخال جميع البيانات بشكل صحيح.</p>';
                    return;
                }

                try {
                    const res = await fetch(`http://localhost:3001/api/expenses/${expense.ExpenseID}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم تحديث المصروف بنجاح.</p>';
                        setTimeout(loadExpenses, 1500);
                    } else {
                        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء تحديث المصروف.'}</p>`;
                    }
                } catch (error) {
                    console.error("Error updating expense:", error);
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });

        } catch (error) {
            document.getElementById('content').innerHTML = `
                <div class="bg-white p-6 rounded shadow-lg border border-gray-200">
                    <p class="text-red-600 mb-4">خطأ في تحميل بيانات المصروف: ${error.message}</p>
                    <button onclick="loadExpenses()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        العودة لقائمة المصروفات
                    </button>
                </div>`;
            console.error("Error loading expense for edit:", error);
        }
    }
        // --- Edit Expense Form ---
        async function showEditExpenseForm(expenseId) {
        try {
            const res = await fetch(`http://localhost:3001/api/expenses/${expenseId}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Expense with ID ${expenseId} not found`);
            }
            const expense = await res.json();

            const html = `
            <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل المصروف</h3>
                <div id="expenseMsg" class="mb-4"></div>
                <form id="editExpenseForm" class="space-y-4">
                    <input type="hidden" id="editExpenseId" value="${expense.ExpenseID}">
                    <div>
                        <label for="editExpenseDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ المصروف</label>
                        <input type="date" id="editExpenseDate" value="${formatDateForInput(expense.ExpenseDate)}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                        <label for="editExpenseDesc" class="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                        <input type="text" id="editExpenseDesc" value="${expense.Description}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div>
                        <label for="editExpenseAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                        <input type="number" step="0.01" min="0" id="editExpenseAmount" value="${expense.Amount.toFixed(2)}" class="w-full border px-3 py-2 rounded" required />
                    </div>
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                        <button type="button" id="cancelEditExpense" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">رجوع</button>
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
            </div>`;

            document.getElementById('content').innerHTML = html;

            document.getElementById('cancelEditExpense')?.addEventListener('click', loadExpenses);

            document.getElementById('editExpenseForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('expenseMsg');
                msgDiv.innerHTML = '';

                const payload = {
                    ExpenseDate: document.getElementById('editExpenseDate').value,
                    Description: document.getElementById('editExpenseDesc').value.trim(),
                    Amount: parseFloat(document.getElementById('editExpenseAmount').value)
                };

                if (!payload.ExpenseDate || !payload.Description || isNaN(payload.Amount) || payload.Amount <= 0) {
                    msgDiv.innerHTML = '<p class="text-red-600">يرجى التأكد من إدخال جميع البيانات بشكل صحيح.</p>';
                    return;
                }

                try {
                    const res = await fetch(`http://localhost:3001/api/expenses/${expense.ExpenseID}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم تحديث المصروف بنجاح.</p>';
                        setTimeout(loadExpenses, 1500);
                    } else {
                        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء تحديث المصروف.'}</p>`;
                    }
                } catch (error) {
                    console.error("Error updating expense:", error);
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });

        } catch (error) {
            document.getElementById('content').innerHTML = `
                <div class="bg-white p-6 rounded shadow-lg border border-gray-200">
                    <p class="text-red-600 mb-4">خطأ في تحميل بيانات المصروف: ${error.message}</p>
                    <button onclick="loadExpenses()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                        العودة لقائمة المصروفات
                    </button>
                </div>`;
            console.error("Error loading expense for edit:", error);
        }
    }





      // Add event listeners for edit/delete buttons
      document.querySelectorAll('.edit-expense').forEach(btn => btn.addEventListener('click', () => showEditExpenseForm(btn.dataset.id)));
      document.querySelectorAll('.delete-expense').forEach(btn => btn.addEventListener('click', () => deleteExpense(btn.dataset.id)));

      // Expenses filter logic
      const filterExpenses = () => {
        const start = document.getElementById('expensesFilterStart').value;
        const end = document.getElementById('expensesFilterEnd').value;
        const min = parseFloat(document.getElementById('expensesFilterMin').value);
        const max = parseFloat(document.getElementById('expensesFilterMax').value);
        const text = document.getElementById('expensesFilterText').value.trim().toLowerCase();
        document.querySelectorAll('#content table tbody tr').forEach(row => {
          const date = row.dataset.expenseDate;
          const amount = parseFloat(row.dataset.expenseAmount);
          let show = true;
          if (start && date < start) show = false;
          if (end && date > end) show = false;
          if (!isNaN(min) && amount < min) show = false;
          if (!isNaN(max) && amount > max) show = false;
          if (text && !row.textContent.toLowerCase().includes(text)) show = false;
          row.style.display = show ? '' : 'none';
        });
      };
      ['input','change'].forEach(evt => {
        ['expensesFilterStart','expensesFilterEnd','expensesFilterMin','expensesFilterMax','expensesFilterText'].forEach(id => {
          document.getElementById(id).addEventListener(evt, filterExpenses);
        });
      });
    }
    async function loadPayments() {
        try {
            const res = await fetch('http://localhost:3001/api/payments');
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to load payments');
            }
            const data = await res.json();
            let html = '<h2 class="text-2xl mb-4">الدفعات اليدوية للعملاء</h2>'; // Clarify these are manual payments
            html += '<div class="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">'
                + '<label class="block mb-2" for="paymentsFilterStart">من تاريخ</label>'
                + '<input type="date" id="paymentsFilterStart" class="border px-3 py-2 rounded" />'
                + '<label class="block mb-2" for="paymentsFilterEnd">إلى تاريخ</label>'
                + '<input type="date" id="paymentsFilterEnd" class="border px-3 py-2 rounded" />'
                + '<label class="block mb-2" for="paymentsFilterMin">الحد الأدنى للمبلغ</label>'
                + '<input type="number" id="paymentsFilterMin" placeholder="0.00" step="0.01" class="border px-3 py-2 rounded" />'
                + '<label class="block mb-2" for="paymentsFilterMax">الحد الأقصى للمبلغ</label>'
                + '<input type="number" id="paymentsFilterMax" placeholder="0.00" step="0.01" class="border px-3 py-2 rounded" />'
                + '<label class="block mb-2" for="paymentsFilterText">بحث نصي</label>'
                + '<input type="text" id="paymentsFilterText" placeholder="بحث بالوصف أو التاريخ أو اسم العميل..." class="border px-3 py-2 rounded" />'
            + '</div>';
            html += '<table class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID الدفعة</th><th class="border px-2 py-1">ID العميل</th><th class="border px-2 py-1">اسم العميل</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">ملاحظات</th><th class="border px-2 py-1">الإجراءات</th></tr></thead><tbody>';
            if (data.length > 0) {
                // Sort payments by date descending (newest first)
                data.sort((a, b) => new Date(b.PaymentDate) - new Date(a.PaymentDate));

                data.forEach(p => {
                    html += `<tr class="table-row" data-payment-date="${formatDateForInput(p.PaymentDate)}" data-payment-amount="${p.Amount.toFixed(2)}">
                        <td class="border px-2 py-1">${p.PaymentID}</td>
                        <td class="border px-2 py-1">${p.TraderID}</td>
                        <td class="border px-2 py-1">${p.TraderName || 'غير متوفر'}</td>
                        <td class="border px-2 py-1">${p.Amount.toFixed(2)}</td>
                        <td class="border px-2 py-1">${formatDate(p.PaymentDate)}</td>
                        <td class="border px-2 py-1">${p.Note || '-'}</td>
                        <td class="border px-2 py-1">
                            <button data-id="${p.PaymentID}" class="delete-payment text-red-600 hover:underline">حذف</button>
                        </td>
                    </tr>`;
                });
            } else {
                html += '<tr><td colspan="7" class="text-center py-4">لا توجد دفعات يدوية مسجلة.</td></tr>'; // Updated colspan
            }
            html += '</tbody></table>';
            document.getElementById('content').innerHTML = html;

            // Add event listeners for edit/delete buttons
            document.querySelectorAll('.edit-payment').forEach(btn => btn.addEventListener('click', () => showEditPaymentForm(btn.dataset.id)));
            document.querySelectorAll('.delete-payment').forEach(btn => btn.addEventListener('click', () => deletePayment(btn.dataset.id)));

            // Payments filter logic
            const filterPayments = () => {
                const start = document.getElementById('paymentsFilterStart').value;
                const end = document.getElementById('paymentsFilterEnd').value;
                const min = parseFloat(document.getElementById('paymentsFilterMin').value);
                const max = parseFloat(document.getElementById('paymentsFilterMax').value);
                const text = document.getElementById('paymentsFilterText').value.trim().toLowerCase();
                document.querySelectorAll('#content table tbody tr').forEach(row => {
                    const date = row.dataset.paymentDate;
                    const amount = parseFloat(row.dataset.paymentAmount);
                    let show = true;
                    if (start && date < start) show = false;
                    if (end && date > end) show = false;
                    if (!isNaN(min) && amount < min) show = false;
                    if (!isNaN(max) && amount > max) show = false;
                    if (text && !row.textContent.toLowerCase().includes(text)) show = false;
                    row.style.display = show ? '' : 'none';
                });
            };
            ['input','change'].forEach(evt => {
                ['paymentsFilterStart','paymentsFilterEnd','paymentsFilterMin','paymentsFilterMax','paymentsFilterText'].forEach(id => {
                    document.getElementById(id).addEventListener(evt, filterPayments);
                });
            });
        } catch (error) {
            document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل الدفعات: ${error.message}</p>`;
            console.error("Error loading payments:", error);
        }
    }
    // show add product form
    function showAddProductForm() {
      const html = `
        <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
          <h3 class="text-xl font-semibold mb-6 text-gray-700">إضافة منتج جديد</h3>
          <div id="productMsg" class="mb-4"></div>
          <form id="productForm" class="space-y-4">
            <div>
              <label for="pName" class="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
              <input type="text" id="pName" name="pName" placeholder="مثال: طماطم بلدي" class="mt-1 block w-full" required />
            </div>
            <div>
              <label for="pCategory" class="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
              <input type="text" id="pCategory" name="pCategory" placeholder="مثال: خضروات" class="mt-1 block w-full" required />
            </div>
            <div>
              <label for="pPrice" class="block text-sm font-medium text-gray-700 mb-1">سعر بيع الوحدة</label>
              <input type="number" step="0.01" min="0" id="pPrice" name="pPrice" placeholder="0.00" class="mt-1 block w-full" required />
            </div>
            <div class="flex justify-end space-x-2 space-x-reverse pt-4">
              <button type="button" id="cancelAddProduct" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
              <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">حفظ المنتج</button>
            </div>
          </form>
        </div>
      `;
      document.getElementById('content').innerHTML = html;
      document.getElementById('cancelAddProduct')?.addEventListener('click', loadProducts);

      document.getElementById('productForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const msgDiv = document.getElementById('productMsg');
        msgDiv.innerHTML = '';
        
        const payload = {
          ProductName: document.getElementById('pName').value.trim(),
          Category: document.getElementById('pCategory').value.trim(),
          UnitPrice: +document.getElementById('pPrice').value,
          StockQuantity: 0, // سيتم تحديثه عند إضافة مشتريات
          IsActive: true
        };

        // التحقق من صحة البيانات
        if (!payload.ProductName) {
          msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال اسم المنتج</p>';
          return;
        }
        if (!payload.Category) {
          msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال تصنيف المنتج</p>';
          return;
        }
        if (isNaN(payload.UnitPrice) || payload.UnitPrice <= 0) {
          msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال سعر بيع صحيح</p>';
          return;
        }

        try {
          const res = await fetch('http://localhost:3001/api/products', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          });
          
          const data = await res.json();
          if (res.ok) {
            loadProducts(); // إعادة تحميل قائمة المنتجات بعد الإضافة بنجاح
          } else {
            msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء حفظ المنتج'}</p>`;
          }
        } catch (error) {
          console.error("Error adding product:", error);
          msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم</p>';
        }
      });
    }
    // show add trader form
    function showAddTraderForm() {
      const html = `
        <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
          <h3 class="text-xl font-semibold mb-6 text-gray-700">إضافة عميل جديد</h3>
          <div id="traderMsg" class="mb-4"></div>
          <form id="traderForm" class="space-y-4">
            <div>
                <label for="tName" class="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                <input type="text" id="tName" name="tName" placeholder="اسم العميل بالكامل" class="mt-1 block w-full" required />
            </div>
            <div>
                <label for="tPhone" class="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                <input type="text" id="tPhone" name="tPhone" placeholder="01xxxxxxxxx" class="mt-1 block w-full" />
            </div>
             <div>
                <label for="tAddress" class="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                <input type="text" id="tAddress" name="tAddress" placeholder="عنوان العميل (اختياري)" class="mt-1 block w-full" />
            </div>
            <div class="flex justify-end space-x-2 space-x-reverse pt-4">
               <button type="button" id="cancelAddTrader" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
               <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">حفظ العميل</button>
            </div>
          </form>
        </div>
      `;
      document.getElementById('content').innerHTML = html;
      document.getElementById('cancelAddTrader')?.addEventListener('click', loadTraders); // Go back

      document.getElementById('traderForm')?.addEventListener('submit', async e => {
        e.preventDefault();
        const msgDiv = document.getElementById('traderMsg');
        msgDiv.innerHTML = '';
        const payload = {
          TraderName: document.getElementById('tName').value.trim(),
          Phone: document.getElementById('tPhone').value.trim() || null, // Allow empty phone
          Address: document.getElementById('tAddress').value.trim() || null, // Allow empty address
          IsActive: true
        };

        if (!payload.TraderName) {
            msgDiv.innerHTML = '<p class="text-red-600">اسم العميل مطلوب.</p>';
            return;
        }

        try {
          const res = await fetch('http://localhost:3001/api/traders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          const data = await res.json();
          if (res.ok) {
              loadTraders(); // Reload on success
          } else {
              msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء الحفظ.'}</p>`;
          }
        } catch(error) {
             console.error("Error adding trader:", error);
             msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
        }
      });
    }
    // edit product
    async function showEditProductForm(id) {
        try {
            const res = await fetch(`http://localhost:3001/api/products/${id}`);
             if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Product with ID ${id} not found`);
            }
            const p = await res.json();

            const html = `
                <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل المنتج #${id}</h3>
                <div id="productMsg" class="mb-4"></div>
                <form id="editProductForm" class="space-y-4">
                    <input type="hidden" id="editProductId" value="${p.ProductID}">
                    <div>
                        <label for="eName" class="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                        <input type="text" id="eName" name="eName" value="${p.ProductName}" class="mt-1 block w-full p-2 border border-gray-300 rounded" required />
                    </div>
                    <div>
                        <label for="eCategory" class="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
                        <input type="text" id="eCategory" name="eCategory" value="${p.Category}" class="mt-1 block w-full p-2 border border-gray-300 rounded" required />
                    </div>
                    <div>
                        <label for="ePrice" class="block text-sm font-medium text-gray-700 mb-1">سعر بيع الوحدة</label>
                        <input type="number" step="0.01" min="0" id="ePrice" name="ePrice" value="${p.UnitPrice}" class="mt-1 block w-full p-2 border border-gray-300 rounded" required />
                    </div>
                   
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                       <button type="button" id="cancelEditProduct" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                       <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
            </div>`;
            document.getElementById('content').innerHTML = html;
            document.getElementById('cancelEditProduct')?.addEventListener('click', loadProducts); // Go back

            document.getElementById('editProductForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('productMsg');
                msgDiv.innerHTML = '';
                const productId = document.getElementById('editProductId').value;
                const payload = {
                    ProductName: document.getElementById('eName').value.trim(),
                    Category: document.getElementById('eCategory').value.trim(),
                    UnitPrice: +document.getElementById('ePrice').value,
                    StockQuantity: p.StockQuantity, // Keep existing value
                    UnitCost: p.UnitCost, // Keep existing value
                    IsActive: p.IsActive // Keep existing value
                };

                // Basic validation
                if (!payload.ProductName || !payload.Category || payload.UnitPrice < 0) {
                    msgDiv.innerHTML = '<p class="text-red-600">يرجى التحقق من صحة البيانات المدخلة</p>';
                    return;
                }

                try {
                    const res = await fetch(`http://localhost:3001/api/products/${productId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                    const data = await res.json();
                    if (res.ok) {
                        loadProducts(); // Reload on success
                    } else {
                         msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء التعديل.'}</p>`;
                    }
                } catch(error) {
                    console.error("Error updating product:", error);
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });
        } catch (error) {
             document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل بيانات المنتج: ${error.message}</p><button onclick="loadProducts()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة المنتجات</button>`;
             console.error("Error loading product for edit:", error);
        }
    }
    // delete product
    async function deleteProduct(id) {
      if (!confirm(`هل أنت متأكد من حذف المنتج رقم ${id}؟ سيؤدي هذا إلى مشاكل في الفواتير والمشتريات المرتبطة به.`)) return;
      try {
          const res = await fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE' });
          const data = await res.json();
           if (res.ok) {
               alert('تم حذف المنتج بنجاح.');
               loadProducts(); // Refresh list
           } else {
               alert(`فشل حذف المنتج: ${data.error || 'خطأ غير معروف. قد يكون المنتج مستخدماً في فواتير أو مشتريات.'}`);
           }
      } catch (error) {
           console.error("Error deleting product:", error);
           alert('حدث خطأ أثناء محاولة حذف المنتج.');
      }
    }
    // edit trader
    async function showEditTraderForm(id) {
       try {
            const res = await fetch(`http://localhost:3001/api/traders/${id}`);
             if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Trader with ID ${id} not found`);
            }
            const t = await res.json();
            const html = `
                <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل بيانات العميل #${id}</h3>
                <div id="traderMsg" class="mb-4"></div>
                <form id="editTraderForm" class="space-y-4">
                    <input type="hidden" id="editTraderId" value="${t.TraderID}">
                    <div>
                        <label for="eName" class="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                        <input type="text" id="eName" name="eName" value="${t.TraderName}" class="mt-1 block w-full" required />
                    </div>
                    <div>
                        <label for="ePhone" class="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                        <input type="text" id="ePhone" name="ePhone" value="${t.Phone || ''}" placeholder="01xxxxxxxxx" class="mt-1 block w-full" />
                    </div>
                    <div>
                        <label for="eAddress" class="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
                        <input type="text" id="eAddress" name="eAddress" value="${t.Address || ''}" placeholder="عنوان العميل (اختياري)" class="mt-1 block w-full" />
                    </div>
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                       <button type="button" id="cancelEditTrader" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                       <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
                </div>
            `;
            document.getElementById('content').innerHTML = html;
            document.getElementById('cancelEditTrader')?.addEventListener('click', loadTraders); // Go back

            document.getElementById('editTraderForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('traderMsg');
                msgDiv.innerHTML = '';
                const traderId = document.getElementById('editTraderId').value;
                const payload = {
                    TraderName: document.getElementById('eName').value.trim(),
                    Phone: document.getElementById('ePhone').value.trim() || null,
                    Address: document.getElementById('eAddress').value.trim() || null,
                    IsActive: true // Assuming active on edit
                };

                 if (!payload.TraderName) {
                    msgDiv.innerHTML = '<p class="text-red-600">اسم العميل مطلوب.</p>';
                    return;
                }

                try {
                    const res = await fetch(`http://localhost:3001/api/traders/${traderId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                    const data = await res.json();
                    if (res.ok) {
                        loadTraders(); // Reload on success
                    } else {
                         msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء التعديل.'}</p>`;
                    }
                } catch(error) {
                     console.error("Error updating trader:", error);
                     msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });

        } catch (error) {
             document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل بيانات العميل: ${error.message}</p><button onclick="loadTraders()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة العملاء</button>`;
             console.error("Error loading trader for edit:", error);
        }
    }
    // delete trader
    async function deleteTrader(id) {
      if (!confirm(`هل أنت متأكد من حذف العميل رقم ${id}؟ سيتم حذف جميع الفواتير والدفعات المرتبطة به!`)) return;
      try {
          const res = await fetch(`http://localhost:3001/api/traders/${id}`, { method: 'DELETE' });
          const data = await res.json();
           if (res.ok) {
               alert('تم حذف العميل وجميع بياناته المرتبطة بنجاح.');
               loadTraders(); // Refresh list
           } else {
                alert(`فشل حذف العميل: ${data.error || 'خطأ غير معروف.'}`);
           }
      } catch(error) {
           console.error("Error deleting trader:", error);
           alert('حدث خطأ أثناء محاولة حذف العميل.');
      }
    }
    // show trader details - Enhanced
    async function showTraderDetails(id) { // Add flag
        try {
            const [traderRes, salesRes, paymentsRes] = await Promise.all([
                fetch(`http://localhost:3001/api/traders/${id}`),
                fetch(`http://localhost:3001/api/sales?trader=${id}`), // Fetch sales for this trader
                fetch(`http://localhost:3001/api/payments?trader=${id}`) // Fetch manual payments for this trader
            ]);

            if (!traderRes.ok) throw new Error('لم يتم العثور على العميل');
            const trader = traderRes.ok ? await traderRes.json() : { TraderName: `عميل #${id}`};
            const sales = salesRes.ok ? await salesRes.json() : [];
            const payments = paymentsRes.ok ? await paymentsRes.json() : [];

            // Calculate Balance (same logic as loadTraders)
            const totalSalesAmount = sales.reduce((sum, sale) => sum + (sale.TotalAmount || 0), 0);
            const totalPaidOnSales = sales.reduce((sum, sale) => sum + (sale.PaidAmount || 0), 0);
            const totalManualPayments = payments.reduce((sum, payment) => sum + (payment.Amount || 0), 0);
            const balance = (totalManualPayments + totalPaidOnSales) - totalSalesAmount;
            const balanceClass = balance < 0 ? 'text-red-600' : 'text-green-600';
            const balanceSign = balance >= 0 ? '+' : '';
            const balanceValue = Math.abs(balance).toFixed(2);

            let html = `<div class="max-w-4xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">`;
            html += `<div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-semibold text-gray-800">تفاصيل العميل: ${trader.TraderName}</h3>
                        <button id="backToTradersBtn" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">رجوع لقائمة العملاء</button>
                     </div>`;

            // Trader Info Section
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b pb-4">
                        <div><strong class="text-gray-600">ID:</strong> ${trader.TraderID}</div>
                        <div><strong class="text-gray-600">الاسم:</strong> ${trader.TraderName}</div>
                        <div><strong class="text-gray-600">الهاتف:</strong> ${trader.Phone || '-'}</div>
                        <div><strong class="text-gray-600">العنوان:</strong> ${trader.Address || '-'}</div>
                        <div><strong class="text-gray-600">إجمالي المبيعات:</strong> ${totalSalesAmount.toFixed(2)}</div>
                        <div><strong class="text-gray-600">إجمالي المدفوع (فواتير + يدوي):</strong> ${(totalPaidOnSales + totalManualPayments).toFixed(2)}</div>
                        <div class="md:col-span-2"><strong class="text-gray-600">الرصيد الحالي:</strong> <span class="font-bold ${balanceClass}">${balanceSign}${balanceValue}</span></div>
                     </div>`;

            // Add Manual Payment Form Section
            html += `<div class="mt-6 mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                        <h4 class="text-lg font-semibold mb-3 text-gray-700">إضافة دفعة يدوية لهذا العميل</h4>
                        <div id="manualPaymentMsg" class="mb-3"></div>
                        <form id="manualPaymentForm" class="space-y-3">
                        <input type="hidden" id="manualTraderId" value="${trader.TraderID}">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="manualPaymentAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                                <input type="number" step="0.01" min="0.01" id="manualPaymentAmount" placeholder="0.00" class="w-full" required />
                            </div>
                            <div>
                                <label for="manualPaymentDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الدفعة</label>
                                <input type="date" id="manualPaymentDate" value="${new Date().toISOString().split('T')[0]}" class="w-full" required />
                            </div>
                            <div class="md:col-span-3">
                                <label for="manualPaymentNote" class="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                                <textarea id="manualPaymentNote" rows="2" placeholder="سبب الدفعة أو أي تفاصيل أخرى" class="w-full"></textarea>
                            </div>
                        </div>
                        <div class="flex justify-end pt-2">
                            <button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">إضافة الدفعة</button>
                        </div>
                        </form>
                    </div>`;

            // Sales History Section
            html += `<div class="mt-6 mb-6">
                        <h4 class="text-lg font-semibold mb-3 text-gray-700">سجل الفواتير</h4>`;
            if (sales.length > 0) {
                html += `<table id="salesHistoryTable" class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID الفاتورة</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">الإجمالي</th><th class="border px-2 py-1">المدفوع</th><th class="border px-2 py-1">المتبقي</th><th class="border px-2 py-1">عرض</th></tr></thead><tbody>`;
                // Sort sales by date descending
                sales.sort((a, b) => new Date(b.SaleDate) - new Date(a.SaleDate));
                sales.forEach(s => {
                    html += `<tr class="table-row"><td class="border px-2 py-1">${s.SaleID}</td><td class="border px-2 py-1">${formatDate(s.SaleDate)}</td><td class="border px-2 py-1">${s.TotalAmount.toFixed(2)}</td><td class="border px-2 py-1">${s.PaidAmount.toFixed(2)}</td><td class="border px-2 py-1">${s.RemainingAmount.toFixed(2)}</td><td class="border px-2 py-1"><button class="view-sale-detail text-blue-600 hover:underline" data-id="${s.SaleID}">التفاصيل</button></td></tr>`;
                });
                html += `</tbody></table>`;
            } else {
                html += `<p class="text-gray-500">لا توجد فواتير مسجلة لهذا العميل.</p>`;
            }
            html += `</div>`;

            // Manual Payments History Section
            html += `<div class="mt-6">
                        <h4 class="text-lg font-semibold mb-3 text-gray-700">سجل الدفعات اليدوية</h4>`;
             if (payments.length > 0) {
                html += `<table id="paymentsHistoryTable" class="min-w-full bg-white border"><thead><tr><th class="border px-2 py-1">ID الدفعة</th><th class="border px-2 py-1">التاريخ</th><th class="border px-2 py-1">المبلغ</th><th class="border px-2 py-1">ملاحظات</th></tr></thead><tbody>`;
                 // Sort payments by date descending
                payments.sort((a, b) => new Date(b.PaymentDate) - new Date(a.PaymentDate));
                payments.forEach(p => {
                    html += `<tr class="table-row"><td class="border px-2 py-1">${p.PaymentID}</td><td class="border px-2 py-1">${formatDate(p.PaymentDate)}</td><td class="border px-2 py-1">${p.Amount.toFixed(2)}</td><td class="border px-2 py-1">${p.Note || '-'}</td></tr>`;
                });
                html += `</tbody></table>`;
            } else {
                html += `<p class="text-gray-500">لا توجد دفعات يدوية مسجلة لهذا العميل.</p>`;
            }
            html += `</div>`;


            html += `</div>`; // Close main container
            document.getElementById('content').innerHTML = html;

            // Event Listener for Back Button
            document.getElementById('backToTradersBtn')?.addEventListener('click', loadTraders);

            // Event Listener for View Sale Detail Button (within trader details)
            document.querySelectorAll('.view-sale-detail').forEach(btn => {
                 btn.addEventListener('click', () => showSaleDetails(btn.dataset.id, true)); // Pass flag to show back button to trader details
             });

            // Handle manual payment form submission
            document.getElementById('manualPaymentForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('manualPaymentMsg');
                msgDiv.innerHTML = '';
                const traderIdInput = document.getElementById('manualTraderId');
                const amountInput = document.getElementById('manualPaymentAmount');
                const dateInput = document.getElementById('manualPaymentDate');
                const noteInput = document.getElementById('manualPaymentNote');

                const payload = {
                    TraderID: traderIdInput.value,
                    Amount: parseFloat(amountInput.value),
                    PaymentDate: dateInput.value, // Already in YYYY-MM-DD
                    Note: noteInput.value.trim()
                };

                if (!payload.TraderID || isNaN(payload.Amount) || payload.Amount <= 0 || !payload.PaymentDate) {
                     msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال مبلغ وتاريخ صحيحين.</p>';
                     return;
                }

                try {
                    const res = await fetch('http://localhost:3001/api/payments', { // Use the correct endpoint
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم إضافة الدفعة بنجاح. سيتم تحديث التفاصيل.</p>';
                        // Reset form and reload details after a short delay
                        document.getElementById('manualPaymentForm').reset();
                         // Set date back to today
                        document.getElementById('manualPaymentDate').value = new Date().toISOString().split('T')[0];
                        setTimeout(() => showTraderDetails(id), 1500); // Reload trader details
                    } else {
                        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'خطأ في إضافة الدفعة'}</p>`;
                    }
                } catch (error) {
                     console.error("Error adding manual payment:", error);
                     msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });

            // Filter sales history rows
            const salesSearchEl = document.getElementById('salesSearchInput');
            if (salesSearchEl) {
                salesSearchEl.addEventListener('input', () => {
                    const filter = salesSearchEl.value.trim().toLowerCase();
                    document.querySelectorAll('#salesHistoryTable tbody tr').forEach(row => {
                        row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
                    });
                });
            }
            // Filter manual payments rows
            const paymentsSearchEl = document.getElementById('paymentsSearchInput');
            if (paymentsSearchEl) {
                paymentsSearchEl.addEventListener('input', () => {
                    const filter = paymentsSearchEl.value.trim().toLowerCase();
                    document.querySelectorAll('#paymentsHistoryTable tbody tr').forEach(row => {
                        row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
                    });
                });
            }

        } catch (error) {
            document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل تفاصيل العميل: ${error.message}</p><button onclick="loadTraders()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة العملاء</button>`;
            console.error("Error showing trader details:", error);
        }
    }

    // Function to show manual payment form (can be standalone or integrated as above)
    async function showManualPaymentForm(traderId) {
        try {
            // Optional: Fetch trader name to display
            const traderRes = await fetch(`http://localhost:3001/api/traders/${traderId}`);
            const trader = traderRes.ok ? await traderRes.json() : { TraderName: `عميل #${traderId}`};

            const html = `
            <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">إضافة دفعة يدوية للعميل: ${trader.TraderName}</h3>
                <div id="manualPaymentMsg" class="mb-4"></div>
                <form id="manualPaymentFormStandalone" class="space-y-4">
                    <input type="hidden" id="manualTraderId" value="${traderId}">
                    <div>
                        <label for="manualPaymentAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                        <input type="number" step="0.01" min="0.01" id="manualPaymentAmount" placeholder="0.00" class="w-full" required />
                    </div>
                    <div>
                        <label for="manualPaymentDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الدفعة</label>
                        <input type="date" id="manualPaymentDate" value="${new Date().toISOString().split('T')[0]}" class="w-full" required />
                    </div>
                    <div>
                        <label for="manualPaymentNote" class="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                        <textarea id="manualPaymentNote" rows="3" placeholder="سبب الدفعة أو أي تفاصيل أخرى" class="w-full"></textarea>
                    </div>
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                       <button type="button" id="cancelManualPayment" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                       <button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">إضافة الدفعة</button>
                    </div>
                </form>
            </div>`;
            document.getElementById('content').innerHTML = html;

            document.getElementById('cancelManualPayment')?.addEventListener('click', loadTraders); // Go back to traders list

             // Handle manual payment form submission
            document.getElementById('manualPaymentFormStandalone')?.addEventListener('submit', async e => {
                e.preventDefault();
                // (Same submission logic as in showTraderDetails)
                 const msgDiv = document.getElementById('manualPaymentMsg');
                msgDiv.innerHTML = '';
                const traderIdInput = document.getElementById('manualTraderId');
                const amountInput = document.getElementById('manualPaymentAmount');
                const dateInput = document.getElementById('manualPaymentDate');
                const noteInput = document.getElementById('manualPaymentNote');

                const payload = {
                    TraderID: traderIdInput.value,
                    Amount: parseFloat(amountInput.value),
                    PaymentDate: dateInput.value,
                    Note: noteInput.value.trim()
                };

                if (!payload.TraderID || isNaN(payload.Amount) || payload.Amount <= 0 || !payload.PaymentDate) {
                     msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال مبلغ وتاريخ صحيحين.</p>';
                     return;
                }

                try {
                    const res = await fetch('http://localhost:3001/api/payments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();
                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم إضافة الدفعة بنجاح.</p>';
                        // Optionally redirect back to traders list after success
                        setTimeout(loadTraders, 1500);
                    } else {
                        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'خطأ في إضافة الدفعة'}</p>`;
                    }
                } catch (error) {
                     console.error("Error adding manual payment:", error);
                     msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                }
            });

        } catch (error) {
             document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل بيانات العميل: ${error.message}</p><button onclick="loadTraders()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة العملاء</button>`;
             console.error("Error preparing manual payment form:", error);
        }
    }
    // --- Edit Payment Form ---
    async function showEditPaymentForm(paymentId) {
        try {
            const res = await fetch(`http://localhost:3001/api/payments/${paymentId}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Payment with ID ${paymentId} not found`);
            }
            const payment = await res.json();

            // Fetch trader name for display
            let traderName = `عميل #${payment.TraderID}`;
            try {
                const traderRes = await fetch(`http://localhost:3001/api/traders/${payment.TraderID}`);
                if (traderRes.ok) {
                    const trader = await traderRes.json();
                    traderName = trader.TraderName;
                }
            } catch { /* Ignore error, just use default name */ }


            const html = `
            <div class="max-w-md mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل الدفعة #${paymentId} للعميل: ${traderName}</h3>
                <div id="paymentMsg" class="mb-4"></div>
                <form id="editPaymentForm" class="space-y-4">
                    <input type="hidden" id="editPaymentId" value="${payment.PaymentID}">
                    <input type="hidden" id="editTraderId" value="${payment.TraderID}">
                    <div>
                        <label for="editPaymentAmount" class="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                        <input type="number" step="0.01" min="0.01" id="editPaymentAmount" value="${payment.Amount}" class="w-full" required />
                    </div>
                    <div>
                        <label for="editPaymentDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الدفعة</label>
                        <input type="date" id="editPaymentDate" value="${formatDateForInput(payment.PaymentDate)}" class="w-full" required />
                    </div>
                    <div>
                        <label for="editPaymentNote" class="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                        <textarea id="editPaymentNote" rows="3" class="w-full">${payment.Note || ''}</textarea>
                    </div>
                    <div class="flex justify-end space-x-2 space-x-reverse pt-4">
                       <button type="button" id="cancelEditPayment" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                       <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
            </div>`;
            document.getElementById('content').innerHTML = html;

            document.getElementById('cancelEditPayment')?.addEventListener('click', loadPayments); // Go back to payments list

            document.getElementById('editPaymentForm')?.addEventListener('submit', async e => {
                 e.preventDefault();
                 const msgDiv = document.getElementById('paymentMsg');
                 msgDiv.innerHTML = '';
                 const payId = document.getElementById('editPaymentId').value;
                 const payload = {
                    TraderID: document.getElementById('editTraderId').value, // Keep original TraderID
                    Amount: parseFloat(document.getElementById('editPaymentAmount').value),
                    PaymentDate: document.getElementById('editPaymentDate').value,
                    Note: document.getElementById('editPaymentNote').value.trim()
                 };

                 if (isNaN(payload.Amount) || payload.Amount <= 0 || !payload.PaymentDate) {
                     msgDiv.innerHTML = '<p class="text-red-600">يرجى إدخال مبلغ وتاريخ صحيحين.</p>';
                     return;
                 }

                 try {
                    const res = await fetch(`http://localhost:3001/api/payments/${payId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم تعديل الدفعة بنجاح.</p>';
                        setTimeout(loadPayments, 1500); // Go back to list
                    } else {
                         msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'خطأ في تعديل الدفعة'}</p>`;
                    }
                 } catch (error) {
                     console.error("Error updating payment:", error);
                     msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم.</p>';
                 }
            });

        } catch (error) {
             document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحميل بيانات الدفعة: ${error.message}</p><button onclick="loadPayments()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة الدفعات</button>`;
             console.error("Error loading payment for edit:", error);
        }
    }

    // --- Delete Payment ---
    async function deletePayment(paymentId) {
        if (!confirm(`هل أنت متأكد من حذف الدفعة رقم ${paymentId}؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
        try {
            const res = await fetch(`http://localhost:3001/api/payments/${paymentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                alert('تم حذف الدفعة بنجاح.');
                loadPayments(); // Refresh list
            } else {
                 alert(`فشل حذف الدفعة: ${data.error || 'خطأ غير معروف.'}`);
            }
        } catch(error) {
            console.error("Error deleting payment:", error);
            alert('حدث خطأ أثناء محاولة حذف الدفعة.');
        }
    }

    // show create sale form
    async function showAddSaleForm() {
      try {
        const [trRes, prodRes] = await Promise.all([
            fetch('http://localhost:3001/api/traders?active=true'), // Fetch only active traders
            fetch('http://localhost:3001/api/products?active=true') // Fetch only active products
        ]);
        if (!trRes.ok || !prodRes.ok) {
            throw new Error('فشل تحميل بيانات العملاء أو المنتجات');
        }
        const [traders, products] = await Promise.all([trRes.json(), prodRes.json()]);

        let html = `
            <div class="max-w-3xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
            <h3 class="text-xl font-semibold mb-6 text-gray-700">إنشاء فاتورة جديدة</h3>
            <div id="saleMsg" class="mb-4"></div>
            <form id="saleForm" class="space-y-4">
                <div>
                    <label for="sTrader" class="block text-sm font-medium text-gray-700 mb-1">العميل</label>
                    <select id="sTrader" name="sTrader" class="w-full" required>
                    <option value="">-- اختر عميل --</option>`;
        traders.forEach(t => { html += `<option value="${t.TraderID}">${t.TraderName}</option>`; });
        html += `
                    </select>
                </div>
                <div>
                    <label for="sDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الفاتورة</label>
                    <input type="date" id="sDate" name="sDate" value="${new Date().toISOString().split('T')[0]}" class="w-full" required />
                </div>

                <fieldset class="border p-4 rounded mt-4">
                    <legend class="text-lg font-medium text-gray-700 px-2">المنتجات</legend>
                    <div id="productRows" class="space-y-3 mt-2">
                    <!-- Product Row Template (will be added dynamically) -->
                    </div>
                    <button id="addProductRowBtn" type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ إضافة منتج آخر</button>
                </fieldset>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                        <label for="sPaid" class="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع</label>
                        <input id="sPaid" name="sPaid" type="number" step="0.01" min="0" value="0" placeholder="0.00" class="w-full" />
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">الإجمالي المتوقع</label>
                        <div id="saleTotalDisplay" class="mt-1 block w-full p-2 bg-gray-100 rounded border border-gray-300 text-center font-bold">0.00</div>
                    </div>
                </div>

                <div class="flex justify-end space-x-2 space-x-reverse pt-6">
                    <button type="button" id="cancelAddSale" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">حفظ الفاتورة</button>
                </div>
            </form>
            </div>`;
        document.getElementById('content').innerHTML = html;

        let productRowCount = 0;
        const productRowsContainer = document.getElementById('productRows');
        const saleTotalDisplay = document.getElementById('saleTotalDisplay');

        // Function to add a new product row
        const addProductRow = () => {
            const rowId = productRowCount++;
            const div = document.createElement('div');
            div.className = 'flex items-center space-x-2 border-b border-gray-200 pb-2 sale-product-row';
            div.dataset.rowId = rowId;

            // Product Select
            const sel = document.createElement('select');
            sel.className = 'flex-grow'; // Use flex-grow instead of flex-1
            sel.id = `sProduct${rowId}`;
            sel.name = `sProduct${rowId}`;
            sel.required = true;
            sel.innerHTML = '<option value="">-- اختر منتج --</option>';
            products.forEach(p => {
                sel.innerHTML += `<option value="${p.ProductID}" data-price="${p.UnitPrice}" data-stock="${p.StockQuantity}" data-cost="${p.UnitCost}">${p.ProductName} (متوفر: ${p.StockQuantity}, سعر: ${p.UnitPrice.toFixed(2)})</option>`;
            });
            sel.addEventListener('change', () => {
                 updateSaleTotal();
                 // Check stock on change
                 const qtyInput = document.getElementById(`sQuantity${rowId}`);
                 checkStock(sel, qtyInput);
             });

            // Quantity Input
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.min = 1;
            inp.placeholder = 'الكمية';
            inp.id = `sQuantity${rowId}`;
            inp.name = `sQuantity${rowId}`;
            inp.className = 'w-24'; // Fixed width for quantity
            inp.required = true;
            inp.addEventListener('input', () => {
                updateSaleTotal();
                checkStock(sel, inp); // Check stock on quantity change
            });


            // Price Display (Read-only)
            const priceDisplay = document.createElement('span');
            priceDisplay.id = `sPriceDisplay${rowId}`;
            priceDisplay.className = 'text-sm text-gray-500 w-20 text-center'; // Fixed width
            priceDisplay.textContent = 'سعر: -';

            // UnitCost Display (Read-only)
            const unitCostDisplay = document.createElement('input');
            unitCostDisplay.type = 'hidden';
            unitCostDisplay.id = `sUnitCost${rowId}`;
            unitCostDisplay.name = `sUnitCost${rowId}`;

            // Remove Button
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '×';
            rm.className = 'text-red-500 hover:text-red-700 font-bold px-2';
            rm.addEventListener('click', () => {
                div.remove();
                updateSaleTotal();
            });

            div.append(sel, inp, rm); // Add elements to the row div
            productRowsContainer.append(div); // Add the row div to the container
            updateSaleTotal(); // Update total when a new row is added
        };

        // Function to update sale total display
                    // Function to update sale total display
                    const updateSaleTotal = () => {
                 let total = 0;
                 document.querySelectorAll('.sale-product-row').forEach(row => {
                    const rowId = row.dataset.rowId;
                    const productSelect = document.getElementById(`sProduct${rowId}`);
                    const quantityInput = document.getElementById(`sQuantity${rowId}`);

                     if (productSelect && productSelect.value && quantityInput && quantityInput.value) {
                         const selectedOption = productSelect.options[productSelect.selectedIndex];
                         const quantity = parseFloat(quantityInput.value); // Or parseInt depending on needs

                        // *** START: Determine price for total calculation ***
                        let price;
                         const originalProductId = row.dataset.originalProductId;

                         if (originalProductId && +productSelect.value === +originalProductId) {
                            // Original product still selected, use original price stored on the row
                            price = parseFloat(row.dataset.originalPrice);
                         } else if (selectedOption) {
                             // New product selected or new row, use current product price from the selected option's data
                             price = parseFloat(selectedOption.dataset.price);
                         } else {
                             price = 0; // Fallback
                         }
                         // *** END: Determine price ***

                         if (!isNaN(price) && !isNaN(quantity) && quantity > 0) {
                            total += price * quantity;
                        }
                    }
                });
                saleTotalDisplay.textContent = total.toFixed(2);
            };

        // Function to check stock and provide visual feedback
              // Function to check stock and provide visual feedback (ADAPTED FOR EDIT)
              const checkStock = (productSelect, quantityInput) => {
                const rowDiv = quantityInput.closest('.sale-product-row'); // Get the parent row div
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const currentProductStock = parseInt(selectedOption?.dataset.stock) || 0; // Current stock from the product table
                const requestedQuantity = parseInt(quantityInput.value) || 0; // Quantity entered by user
                const msgDiv = document.getElementById('saleMsg'); // Use the main message div

                // Clear previous border styles
                quantityInput.classList.remove('border-red-500', 'ring-red-500', 'ring-opacity-50'); // Adjusted classes slightly

                if (!selectedOption?.value) return true; // No product selected, skip stock check for this row

                // Get original quantity *if* this row represents an existing detail from the sale
                // Use || 0 to handle cases where the row is new or data attribute is missing
                const originalQuantityInThisSale = parseInt(rowDiv?.dataset.originalQuantity) || 0;

                // Calculate the effective stock available *for this specific edit operation*.
                // This is the current stock + the quantity this sale originally took.
                const effectiveStockAvailableForEdit = currentProductStock + originalQuantityInThisSale;

                if (requestedQuantity > effectiveStockAvailableForEdit) {
                    quantityInput.classList.add('border-red-500', 'ring', 'ring-red-500', 'ring-opacity-50'); // Add red border/ring
                     // Display a clear error message
                     // This message replaces the main message div content. Consider appending if multiple errors needed.
                     msgDiv.innerHTML = `<p class="text-red-600">الكمية المطلوبة للمنتج "${selectedOption.text.split(' (')[0]}" (${requestedQuantity}) تتجاوز الكمية المتاحة فعلياً للتعديل (${effectiveStockAvailableForEdit} = ${currentProductStock} حالياً + ${originalQuantityInThisSale} كانت في الفاتورة).</p>`;
                     return false; // Indicate stock issue
                } else {
                     // Stock is OK for THIS item based on edit logic.
                     // Avoid clearing msgDiv here as another row might have an error.
                     // Rely on final check in submit handler to clear if all OK.
                     return true; // Indicate stock is OK
                }
            };


        // Add the first product row initially
        addProductRow();

        // Event listener for adding more product rows
        document.getElementById('addProductRowBtn')?.addEventListener('click', addProductRow);
        document.getElementById('cancelAddSale')?.addEventListener('click', loadSales); // Go back

        // Event listener for form submission
        document.getElementById('saleForm')?.addEventListener('submit', async e => {
            e.preventDefault();
            const msgDiv = document.getElementById('saleMsg');
            msgDiv.innerHTML = ''; // Clear previous messages
            const TraderID = +document.getElementById('sTrader').value;
            const SaleDate = document.getElementById('sDate').value;
            const PaidAmount = +document.getElementById('sPaid').value || 0;
            const prods = [];
            let stockIssue = false;

            document.querySelectorAll('.sale-product-row').forEach(row => {
                const rowId = row.dataset.rowId;
                const ps = document.getElementById(`sProduct${rowId}`);
                const qs = document.getElementById(`sQuantity${rowId}`);

                if (ps && ps.value && qs && qs.value) {
                    const selectedOption = ps.options[ps.selectedIndex];
                    const stock = +selectedOption.dataset.stock;
                    const quantity = +qs.value;
                    const unitPrice = +selectedOption.dataset.price; // Use actual price from selection

                     if (quantity > stock) {
                        stockIssue = true;
                        checkStock(ps, qs); // Re-run check to highlight the problematic input
                    }

                    prods.push({
                        ProductID: +ps.value,
                        Quantity: quantity,
                        UnitPrice: unitPrice, // Use the actual price at time of selection
                        UnitCost: +selectedOption.dataset.cost // Include unit cost
                    });
                }
            });

            if (!TraderID || !SaleDate) {
                msgDiv.innerHTML = '<p class="text-red-600">يرجى اختيار عميل وتحديد تاريخ الفاتورة.</p>';
                return;
            }
            if (prods.length === 0) {
                msgDiv.innerHTML = '<p class="text-red-600">يرجى إضافة منتج واحد على الأقل للفاتورة.</p>';
                return;
            }
             if (stockIssue) {
                // Message is already displayed by checkStock
                msgDiv.innerHTML = '<p class="text-red-600">يوجد خطأ في الكميات المطلوبة (تجاوز المخزون). يرجى المراجعة.</p>';
                return;
            }

            // Calculate total amount from the collected products
            const totalAmount = prods.reduce((sum, p) => sum + (p.Quantity * p.UnitPrice), 0);

            if (PaidAmount > totalAmount) {
                 msgDiv.innerHTML = `<p class="text-red-600">المبلغ المدفوع (${PaidAmount.toFixed(2)}) لا يمكن أن يكون أكبر من إجمالي الفاتورة (${totalAmount.toFixed(2)}).</p>`;
                 return;
            }

            try {
                const payload = {
                    TraderID,
                    SaleDate,
                    PaidAmount,
                    products: prods
                };

                const res = await fetch('http://localhost:3001/api/sales', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (res.ok) {
                    loadSales(); // Reload sales list on success
                } else {
                    msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ غير متوقع أثناء حفظ الفاتورة.'}</p>`;
                }
            } catch (error) {
                 console.error("Error submitting sale:", error);
                 msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم لحفظ الفاتورة.</p>';
            }
        });

       } catch (error) {
           document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحضير نموذج الفاتورة: ${error.message}</p><button onclick="loadSales()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة الفواتير</button>`;
           console.error("Error preparing add sale form:", error);
       }
    }
    // Show sale details
    async function showSaleDetails(id, fromTraderDetails = false) { // Add flag
      try {
        const res = await fetch(`http://localhost:3001/api/sales/${id}`);
        if (!res.ok) {
             const errData = await res.json();
             throw new Error(errData.error || `Sale with ID ${id} not found`);
        }
        const s = await res.json();

        let html = `<div class="max-w-2xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">`;
         html += `<div class="flex justify-between items-center mb-6">
                    <h3 class="text-2xl font-semibold text-gray-800">تفاصيل الفاتورة #${s.SaleID}</h3>`;
         // Conditional Back Button
         if (fromTraderDetails && s.TraderID) {
             html += `<button onclick="showTraderDetails(${s.TraderID})" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">رجوع لتفاصيل العميل</button>`;
         } else {
             html += `<button id="backToSalesBtn" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">رجوع لقائمة الفواتير</button>`;
         }
         html += `</div>`;

        // Sale Summary
        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b pb-4">
                    <div><strong class="text-gray-600">العميل:</strong> ${s.trader?.TraderName || 'غير محدد'}</div>
                    <div><strong class="text-gray-600">تاريخ الفاتورة:</strong> ${formatDate(s.SaleDate)}</div>
                    <div><strong class="text-gray-600">الإجمالي:</strong> ${s.TotalAmount.toFixed(2)}</div>
                    <div><strong class="text-gray-600">المدفوع:</strong> ${s.PaidAmount.toFixed(2)}</div>
                    <div class="md:col-span-2"><strong class="text-gray-600">المتبقي:</strong> <span class="font-bold ${s.RemainingAmount > 0 ? 'text-red-600' : 'text-green-600'}">${s.RemainingAmount.toFixed(2)}</span></div>
                 </div>`;

        // Sale Details (Products)
        html += `<h4 class="mt-4 mb-3 font-semibold text-lg text-gray-700">المنتجات في الفاتورة</h4>`;
        if(s.details && s.details.length > 0) {
            html += `<table class="min-w-full bg-white border">
                        <thead>
                            <tr>
                                <th class="border px-2 py-1 text-right">المنتج</th>
                                <th class="border px-2 py-1 text-center">سعر الوحدة</th>
                                <th class="border px-2 py-1 text-center">الكمية</th>
                                <th class="border px-2 py-1 text-center">المجموع الفرعي</th>
                            </tr>
                        </thead>
                        <tbody>`;
            s.details.forEach(d => {
                html += `<tr class="table-row">
                            <td class="border px-2 py-1">${d.ProductName || 'منتج محذوف'}</td>
                            <td class="border px-2 py-1 text-center">${d.UnitPrice.toFixed(2)}</td>
                            <td class="border px-2 py-1 text-center">${d.Quantity}</td>
                            <td class="border px-2 py-1 text-center">${d.SubTotal.toFixed(2)}</td>
                         </tr>`;
            });
            html += `</tbody></table>`;
        } else {
            html += `<p class="text-gray-500">لا توجد تفاصيل منتجات لهذه الفاتورة.</p>`;
        }
        html += '</div>'; // Close main container
        document.getElementById('content').innerHTML = html;
        // Add event listener only if the general back button exists
        document.getElementById('backToSalesBtn')?.addEventListener('click', loadSales);

      } catch (e) {
        document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في عرض تفاصيل الفاتورة: ${e.message}</p><button onclick="loadSales()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة الفواتير</button>`;
        console.error("Error showing sale details:", e);
      }
    }
    // Delete sale
    async function deleteSale(id) {
      if (!confirm(`هل أنت متأكد من حذف الفاتورة رقم ${id}؟ سيتم استرجاع كميات المنتجات للمخزن وتحديث رصيد العميل.`)) return;
      try {
        const res = await fetch(`http://localhost:3001/api/sales/${id}`, { method: 'DELETE' });
        const data = await res.json(); // Get response body even on error
        if (res.ok) {
            alert('تم حذف الفاتورة بنجاح.');
            loadSales(); // Refresh list
        } else {
            alert(`فشل حذف الفاتورة: ${data.error || 'خطأ غير معروف.'}`);
        }
      } catch(error) {
          console.error("Error deleting sale:", error);
          alert('حدث خطأ أثناء محاولة حذف الفاتورة.');
      }
    }
    // Show edit sale form
       // Show edit sale form
       async function showEditSaleForm(id) {
        try {
            const [sRes, trRes, prodRes] = await Promise.all([
                fetch(`http://localhost:3001/api/sales/${id}`),
                fetch('http://localhost:3001/api/traders?active=true'),
                fetch('http://localhost:3001/api/products?active=true')
            ]);

            if (!sRes.ok) throw new Error('لم يتم العثور على الفاتورة');
            if (!trRes.ok || !prodRes.ok) throw new Error('فشل تحميل بيانات العملاء أو المنتجات');

            const s = await sRes.json();
            const traders = await trRes.json();
            const products = await prodRes.json(); // Products with current stock/price/cost

            let html = `<div class="max-w-3xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل الفاتورة #${s.SaleID}</h3>
                <div id="saleMsg" class="mb-4"></div>
                <form id="editSaleForm" class="space-y-4">
                    <input type="hidden" id="editSaleId" value="${s.SaleID}">
                     <div>
                        <label for="sTrader" class="block text-sm font-medium text-gray-700 mb-1">العميل</label>
                        <select id="sTrader" name="sTrader" class="w-full" required>
                            <option value="">-- اختر عميل --</option>`;
            traders.forEach(t => { html += `<option value="${t.TraderID}"${t.TraderID === s.TraderID ? ' selected' : ''}>${t.TraderName}</option>`; });
            html += `
                        </select>
                    </div>
                     <div>
                        <label for="sDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الفاتورة</label>
                        <input type="date" id="sDate" name="sDate" value="${formatDateForInput(s.SaleDate)}" class="w-full" required />
                    </div>

                     <fieldset class="border p-4 rounded mt-4">
                        <legend class="text-lg font-medium text-gray-700 px-2">المنتجات</legend>
                        <div id="productRows" class="space-y-3 mt-2">
                        <!-- Existing product rows will be added here -->
                        </div>
                        <button id="addProductRowBtn" type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ إضافة منتج آخر</button>
                    </fieldset>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div>
                            <label for="sPaid" class="block text-sm font-medium text-gray-700 mb-1">المبلغ المدفوع</label>
                            <input id="sPaid" name="sPaid" type="number" step="0.01" min="0" value="${s.PaidAmount.toFixed(2)}" placeholder="0.00" class="w-full" />
                        </div>
                         <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">الإجمالي المتوقع</label>
                            <div id="saleTotalDisplay" class="mt-1 block w-full p-2 bg-gray-100 rounded border border-gray-300 text-center font-bold">0.00</div>
                        </div>
                    </div>

                    <div class="flex justify-end space-x-2 space-x-reverse pt-6">
                        <button type="button" id="cancelEditSale" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                    </div>
                </form>
            </div>`;
            document.getElementById('content').innerHTML = html;

            let productRowCount = 0;
            const productRowsContainer = document.getElementById('productRows');
            const saleTotalDisplay = document.getElementById('saleTotalDisplay');

            // Function to update sale total display
             const updateSaleTotal = () => {
                 let total = 0;
                 document.querySelectorAll('.sale-product-row').forEach(row => {
                    const rowId = row.dataset.rowId;
                    const productSelect = document.getElementById(`sProduct${rowId}`);
                    const quantityInput = document.getElementById(`sQuantity${rowId}`);

                     if (productSelect && productSelect.value && quantityInput && quantityInput.value) {
                         // Use the price *associated with this row's current selection/original detail*
                         // Read price from data attribute on the option, or from stored original price
                        const selectedOption = productSelect.options[productSelect.selectedIndex];
                         const quantity = parseFloat(quantityInput.value);

                        // Use the price that will actually be sent on save
                        let price;
                         if (row.dataset.originalProductId && +productSelect.value === +row.dataset.originalProductId) {
                            // Original product still selected, use original price
                            price = parseFloat(row.dataset.originalPrice);
                         } else if (selectedOption) {
                             // New product selected or new row, use current product price
                             price = parseFloat(selectedOption.dataset.price);
                         } else {
                             price = 0; // Fallback if option data is missing (shouldn't happen with required select)
                         }


                         if (!isNaN(price) && !isNaN(quantity) && quantity > 0) {
                            total += price * quantity;
                        }
                    }
                });
                saleTotalDisplay.textContent = total.toFixed(2);
            };


            // Function to check stock and provide visual feedback (ADAPTED FOR EDIT)
             const checkStock = (productSelect, quantityInput) => {
                const rowDiv = quantityInput.closest('.sale-product-row'); // Get the parent row div
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const currentProductStock = parseInt(selectedOption?.dataset.stock) || 0; // Current stock from the product table
                const requestedQuantity = parseInt(quantityInput.value) || 0; // Quantity entered by user
                const msgDiv = document.getElementById('saleMsg'); // Use the main message div

                // Clear previous border styles
                quantityInput.classList.remove('border-red-500', 'ring-red-500');

                if (!selectedOption?.value) return true; // No product selected, skip stock check for this row

                // Get original quantity *if* this row represents an existing detail from the sale
                const originalQuantityInThisSale = parseInt(rowDiv?.dataset.originalQuantity) || 0;

                // Calculate the effective stock available *for this specific edit operation*.
                // This is the current stock + the quantity this sale originally took.
                const effectiveStockAvailableForEdit = currentProductStock + originalQuantityInThisSale;

                if (requestedQuantity > effectiveStockAvailableForEdit) {
                    quantityInput.classList.add('border-red-500', 'ring', 'ring-red-500', 'ring-opacity-50'); // Add red border/ring
                     // Display a clear error message
                     // This message replaces the main message div content.
                     msgDiv.innerHTML = `<p class="text-red-600">الكمية المطلوبة للمنتج "${selectedOption.text.split(' (')[0]}" (${requestedQuantity}) تتجاوز الكمية المتاحة (${currentProductStock} حالياً + ${originalQuantityInThisSale} من هذه الفاتورة).</p>`;
                     return false; // Indicate stock issue
                } else {
                     // Stock is OK for THIS item based on edit logic.
                     // Clearing message here might hide other row errors, so rely on final check in submit handler.
                     return true; // Indicate stock is OK
                }
            };


            // Function to add a product row (same as in add form, but takes existing data)
                       // Function to add a product row (same as in add form, but takes existing data)
                       const addProductRow = (detail = null) => {
                const rowId = productRowCount++;
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2 border-b border-gray-200 pb-2 sale-product-row';
                div.dataset.rowId = rowId;
                div.dataset.detailId = detail ? detail.SaleDetailID : ''; // Store original detail ID if editing

                // *** START: Store original values if detail exists ***
                if (detail) {
                     div.dataset.originalQuantity = detail.Quantity;
                     div.dataset.originalPrice = detail.UnitPrice; // Store original price from detail
                     div.dataset.originalCost = detail.UnitCost;   // Store original cost from detail
                     div.dataset.originalProductId = detail.ProductID; // Store original product ID
                 }
                // *** END: Store original values ***


                const sel = document.createElement('select');
                sel.className = 'flex-grow';
                sel.id = `sProduct${rowId}`;
                sel.name = `sProduct${rowId}`;
                sel.required = true;
                sel.innerHTML = '<option value="">-- اختر منتج --</option>';
                products.forEach(p => {
                    // Select the product if detail exists and ProductID matches
                    const isSelected = detail && p.ProductID === detail.ProductID;
                    // Options show CURRENT product info (stock, current price) for user info
                    sel.innerHTML += `<option value="${p.ProductID}" data-price="${p.UnitPrice}" data-stock="${p.StockQuantity}" data-cost="${p.UnitCost}"${isSelected ? ' selected' : ''}>${p.ProductName} (متوفر: ${p.StockQuantity}, سعر: ${p.UnitPrice.toFixed(2)})</option>`;
                });
                 sel.addEventListener('change', (e) => {
                     // When product changes, update the total based on the *newly selected* product's price
                     updateSaleTotal();
                     // Also check stock based on the newly selected product's current stock
                     const qtyInput = document.getElementById(`sQuantity${rowId}`);
                     checkStock(e.target, qtyInput); // Pass the select and quantity input
                 });


                const inp = document.createElement('input');
                inp.type = 'number';
                inp.min = 1; // Minimum quantity is 1 for a valid sale item
                inp.placeholder = 'الكمية';
                inp.id = `sQuantity${rowId}`;
                inp.name = `sQuantity${rowId}`;
                inp.className = 'w-24';
                inp.required = true;
                 // **Use original quantity from detail if editing, otherwise empty**
                inp.value = detail ? detail.Quantity : '';
                inp.addEventListener('input', (e) => {
                    updateSaleTotal(); // Update total when quantity changes
                     checkStock(sel, e.target); // Check stock when quantity changes
                });

                // UnitCost Input (Hidden, to be sent in payload for profit calculation)
                // This input is not visible, its value will be determined in the submit handler
                // based on whether the item is original/unchanged or new/changed.
                const unitCostInput = document.createElement('input');
                unitCostInput.type = 'hidden';
                unitCostInput.id = `sUnitCost${rowId}`; // Add an ID if needed, but accessing via row.dataset is better
                unitCostInput.name = `sUnitCost${rowId}`; // Add a name if needed

                const rm = document.createElement('button');
                rm.type = 'button';
                rm.textContent = '×';
                rm.className = 'text-red-500 hover:text-red-700 font-bold px-2';
                rm.addEventListener('click', () => {
                    div.remove(); // Remove the row div
                    updateSaleTotal(); // Update total after removing a row
                });

                div.append(sel, inp, rm); // Add elements to the row div
                productRowsContainer.append(div); // Add the row div to the container
                // Note: updateSaleTotal is called after adding all initial rows below
            };


            // Populate existing product rows from s.details
            // Ensure s.details is an array before iterating
            if (Array.isArray(s.details)) {
                s.details.forEach(detail => addProductRow(detail));
            }

            // Add the first product row if the sale had no details initially (unlikely but safe)
             if (!s.details || s.details.length === 0) {
                addProductRow();
             }


            updateSaleTotal(); // Calculate initial total after adding rows

            // Add event listeners
            document.getElementById('addProductRowBtn')?.addEventListener('click', () => addProductRow()); // Add empty row
            document.getElementById('cancelEditSale')?.addEventListener('click', loadSales); // Go back

            // Handle form submission
                document.getElementById('editSaleForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                const msgDiv = document.getElementById('saleMsg');
                msgDiv.innerHTML = ''; // Clear previous messages

                const saleId = document.getElementById('editSaleId').value;
                const TraderID = +document.getElementById('sTrader').value;
                const SaleDate = document.getElementById('sDate').value;
                const PaidAmount = parseFloat(document.getElementById('sPaid').value) || 0; // Use parseFloat

                const updatedProducts = []; // Array to hold updated/new product data for the payload
                let formIsValid = true;
                let stockIssue = false;


                 // Re-run stock check and collect product data for all rows
                document.querySelectorAll('.sale-product-row').forEach(row => {
                    const rowId = row.dataset.rowId;
                    const ps = document.getElementById(`sProduct${rowId}`);
                    const qs = document.getElementById(`sQuantity${rowId}`);
                    const detailId = row.dataset.detailId || null; // Get original detail ID if exists

                    // Basic validation for each row
                    ps?.classList.remove('border-red-500'); // Reset style
                    qs?.classList.remove('border-red-500'); // Reset style

                    if (!ps || !ps.value) { // Check if product is selected
                        formIsValid = false;
                         ps?.classList.add('border-red-500'); // Add visual feedback
                    }

                    const quantityInt = parseInt(qs?.value);
                    if (!qs || isNaN(quantityInt) || quantityInt <= 0) { // Check if quantity is valid
                         formIsValid = false;
                         qs?.classList.add('border-red-500'); // Add visual feedback
                    }


                    // If the row seems valid enough to process its data:
                    if (formIsValid && ps.value && !isNaN(quantityInt) && quantityInt > 0) {
                        const selectedOption = ps.options[ps.selectedIndex];

                        // *** START: Determine UnitPrice and UnitCost to send ***
                        let unitPriceToSend;
                        let unitCostToSend;

                        // Check if this is an original row and if the product hasn't changed
                        const originalProductId = row.dataset.originalProductId;
                        if (originalProductId && +ps.value === +originalProductId) {
                            // It's an original item, and the product hasn't been changed
                            unitPriceToSend = parseFloat(row.dataset.originalPrice); // Use original price from detail
                            unitCostToSend = parseFloat(row.dataset.originalCost);   // Use original cost from detail
                        } else if (selectedOption) {
                             // It's a new item OR an original item where the product was changed
                             // Use current product price and cost from the option data
                            unitPriceToSend = parseFloat(selectedOption.dataset.price);
                            unitCostToSend = parseFloat(selectedOption.dataset.cost);
                        } else {
                            // Fallback (shouldn't happen if formIsValid is true for this row)
                            unitPriceToSend = 0;
                            unitCostToSend = 0;
                             console.warn(`Could not determine price/cost for row ${rowId}`);
                             formIsValid = false; // Mark as invalid if we can't determine price/cost
                        }
                        // *** END: Determine UnitPrice and UnitCost ***


                        // Add to the list of updated/new products
                        updatedProducts.push({
                            // Include SaleDetailID if needed by backend PUT logic (might not be necessary if backend replaces all)
                            // SaleDetailID: detailId,
                            ProductID: +ps.value,
                            Quantity: quantityInt, // Send as integer
                            UnitPrice: unitPriceToSend, // Use the determined price
                            UnitCost: unitCostToSend    // Use the determined cost
                        });

                         // Re-run stock check for THIS specific row BEFORE submitting
                         // This ensures stockIssue flag is correctly set based on all rows
                        if (!checkStock(ps, qs)) { // Call the adapted checkStock for edit
                             stockIssue = true; // Set the flag if ANY row fails stock check
                        }
                    } else if (ps || qs) { // If either product or quantity exists, but validation failed
                         // If any row failed basic validation, ensure the overall form is marked invalid
                         formIsValid = false;
                    }
                });


                 // --- Final Validation Checks ---

                if (!TraderID || !SaleDate) {
                     formIsValid = false;
                     // Add specific messages if needed, or rely on the general message below
                     if (!TraderID) document.getElementById('sTrader')?.classList.add('border-red-500'); else document.getElementById('sTrader')?.classList.remove('border-red-500');
                     if (!SaleDate) document.getElementById('sDate')?.classList.add('border-red-500'); else document.getElementById('sDate')?.classList.remove('border-red-500');
                }
                if (updatedProducts.length === 0 && document.querySelectorAll('.sale-product-row').length > 0) {
                     // If there are rows but none were valid enough to be added to updatedProducts
                    formIsValid = false;
                    if (msgDiv.innerHTML === '') msgDiv.innerHTML = '<p class="text-red-600">لا توجد منتجات صالحة في الفاتورة.</p>';
                } else if (updatedProducts.length === 0 && document.querySelectorAll('.sale-product-row').length === 0){
                     // If no rows were even added
                    formIsValid = false;
                    if (msgDiv.innerHTML === '') msgDiv.innerHTML = '<p class="text-red-600">يرجى إضافة منتج واحد على الأقل.</p>';
                }

                if (!formIsValid) {
                    // Display a general error message if specific field errors aren't clear enough
                    if (msgDiv.innerHTML === '' || msgDiv.innerHTML.indexOf('يرجى مراجعة') === -1) { // Avoid duplicate general message
                         msgDiv.innerHTML += '<p class="text-red-600">يرجى مراجعة الحقول المميزة باللون الأحمر والتأكد من صحة البيانات.</p>';
                    }
                    return; // Stop submission
                }

                 if (stockIssue) {
                    // The specific stock message should already be in msgDiv from the loop.
                    // No need to add another general message here.
                    return; // Stop submission if stock issue exists
                }

                // Calculate total amount from the collected products array
                const totalAmount = updatedProducts.reduce((sum, p) => sum + (p.Quantity * p.UnitPrice), 0);

                if (PaidAmount > totalAmount + 0.001) { // Add a small tolerance for float comparison
                     msgDiv.innerHTML = `<p class="text-red-600">المبلغ المدفوع (${PaidAmount.toFixed(2)}) لا يمكن أن يكون أكبر من إجمالي الفاتورة (${totalAmount.toFixed(2)}).</p>`;
                     document.getElementById('sPaid')?.classList.add('border-red-500');
                     return;
                } else {
                     document.getElementById('sPaid')?.classList.remove('border-red-500');
                }

                // --- Submit the form ---
                try {
                     const payload = {
                        TraderID,
                        SaleDate,
                        PaidAmount,
                        products: updatedProducts // Send updated products including correct price/cost
                    };

                    console.log("Sending Payload (Edit Sale):", JSON.stringify(payload, null, 2)); // DEBUG: Log payload

                    const res = await fetch(`http://localhost:3001/api/sales/${saleId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();

                    if (res.ok) {
                        msgDiv.innerHTML = '<p class="text-green-600">تم تحديث الفاتورة بنجاح.</p>';
                        setTimeout(loadSales, 1500); // Reload list on success after delay
                    } else {
                         // Display error message from the backend response
                        msgDiv.innerHTML = `<p class="text-red-600">${data.error || 'حدث خطأ أثناء تعديل الفاتورة.'}</p>`;
                         console.error("Backend Error (Edit Sale):", data); // DEBUG: Log backend error
                    }
                } catch (error) {
                    console.error("Error updating sale (Network/JS):", error); // DEBUG: Log fetch error
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم لتعديل الفاتورة.</p>';
                }
            });

        } catch (error) {
            // Handle errors during form preparation (e.g., failed to fetch sale data or products)
            document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحضير نموذج تعديل الفاتورة: ${error.message}</p><button onclick="loadSales()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة الفواتير</button>`;
            console.error("Error preparing edit sale form:", error);
        }
    }
    // Show add purchase form
    async function showAddPurchaseForm() {
        try {
            const res = await fetch('http://localhost:3001/api/products?active=true'); // Fetch active products
            if (!res.ok) throw new Error('فشل تحميل قائمة المنتجات');
            const products = await res.json();

            let html = `
            <div class="max-w-3xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                <h3 class="text-xl font-semibold mb-6 text-gray-700">إنشاء سجل مشتريات جديد</h3>
                <div id="purchaseMsg" class="mb-4"></div>
                <form id="purchaseForm" class="space-y-4">
                    <div>
                        <label for="supplierName" class="block text-sm font-medium text-gray-700 mb-1">اسم المورد</label>
                        <input id="supplierName" name="supplierName" type="text" placeholder="اسم المورد أو المحل" class="w-full" />
                    </div>
                     <div>
                        <label for="purchaseDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الشراء</label>
                        <input type="date" id="purchaseDate" name="purchaseDate" value="${new Date().toISOString().split('T')[0]}" class="w-full" required />
                    </div>
                     <div>
                        <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                        <textarea id="notes" name="notes" rows="2" class="w-full" placeholder="رقم فاتورة المورد، تفاصيل إضافية..."></textarea>
                    </div>

                    <fieldset class="border p-4 rounded mt-4">
                        <legend class="text-lg font-medium text-gray-700 px-2">المنتجات المشتراة</legend>
                        <div id="purchaseRows" class="space-y-3 mt-2">
                            <!-- Purchase Row Template -->
                        </div>
                        <button id="addPurchaseRowBtn" type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ إضافة منتج</button>
                    </fieldset>

                     <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">إجمالي تكلفة الشراء</label>
                        <div id="purchaseTotalDisplay" class="mt-1 block w-full p-2 bg-gray-100 rounded border border-gray-300 text-center font-bold">0.00</div>
                    </div>

                    <div class="flex justify-end space-x-2 space-x-reverse pt-6">
                        <button type="button" id="cancelAddPurchase" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                        <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">حفظ المشتريات</button>
                    </div>
                </form>
            </div>`;
            document.getElementById('content').innerHTML = html;

            let purchaseRowCount = 0;
            const purchaseRowsContainer = document.getElementById('purchaseRows');
            const purchaseTotalDisplay = document.getElementById('purchaseTotalDisplay');

            // Function to add a new purchase row
            const addPurchaseRow = (detail = null) => {
                const rowId = purchaseRowCount++;
                const div = document.createElement('div');
                div.className = 'grid grid-cols-1 md:grid-cols-10 gap-2 items-center border-b border-gray-200 pb-2 purchase-product-row';
                 div.dataset.rowId = rowId;
                 div.dataset.detailId = detail ? detail.PurchaseDetailID : '';

                const sel = document.createElement('select');
                sel.className = 'md:col-span-4';
                sel.id = `pProduct${rowId}`;
                sel.name = `pProduct${rowId}`;
                sel.required = true;
                sel.innerHTML = '<option value="">-- اختر منتج --</option>';
                products.forEach(p => {
                     const isSelected = detail && p.ProductID === detail.ProductID;
                    sel.innerHTML += `<option value="${p.ProductID}" data-cost="${p.UnitCost || 0}" data-stock="${p.StockQuantity}"${isSelected ? ' selected' : ''}>${p.ProductName} (التكلفة الحالية: ${p.UnitCost?.toFixed(2) || 'N/A'})</option>`;
                });
                sel.addEventListener('change', (e) => {
                    const costInput = document.getElementById(`pCost${rowId}`);
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const currentCost = selectedOption.dataset.cost;
                    if (e.target.value && e.target.value !== 'new' && costInput) {
                        costInput.value = parseFloat(currentCost).toFixed(2) || '';
                    }
                    updatePurchaseTotal();
                });

                const q = document.createElement('input');
                q.id = `pQuantity${rowId}`;
                q.name = `pQuantity${rowId}`;
                q.type = 'number';
                q.min = 1;
                q.placeholder = 'الكمية';
                q.className = 'md:col-span-2';
                q.required = true;
                q.value = detail ? detail.Quantity : '';
                q.addEventListener('input', updatePurchaseTotal);


                const c = document.createElement('input');
                c.id = `pCost${rowId}`;
                c.name = `pCost${rowId}`;
                c.type = 'number';
                c.step = '0.01';
                c.min = 0;
                c.placeholder = 'تكلفة الوحدة';
                c.className = 'md:col-span-2';
                c.required = true;
                 c.value = detail ? detail.UnitCost.toFixed(2) : ''; // Pre-fill if editing
                c.addEventListener('input', updatePurchaseTotal);


                const rm = document.createElement('button');
                rm.type = 'button';
                rm.textContent = '×';
                rm.className = 'md:col-span-1 text-red-500 hover:text-red-700 font-bold px-2 justify-self-center';
                rm.addEventListener('click', () => {
                    div.remove();
                    updatePurchaseTotal();
                });

                div.append(sel, q, c, rm);
                purchaseRowsContainer.append(div);
                 // Auto-fill cost for existing detail on load
                 if (detail) {
                    const selectedOption = sel.options[sel.selectedIndex];
                    if (selectedOption && selectedOption.value === String(detail.ProductID)) {
                        // c.value = detail.UnitCost.toFixed(2); // Already set above
                    }
                 }
            };

             // Re-use updatePurchaseTotal function
             const updatePurchaseTotal = () => {
                 // (Identical logic to updatePurchaseTotal in showAddPurchaseForm)
                 let total = 0;
                 document.querySelectorAll('.purchase-product-row').forEach(row => {
                    const rowId = row.dataset.rowId;
                    const quantityInput = document.getElementById(`pQuantity${rowId}`);
                    const costInput = document.getElementById(`pCost${rowId}`);
                    const productSelect = document.getElementById(`pProduct${rowId}`);

                     if (productSelect && productSelect.value && quantityInput && quantityInput.value && costInput && costInput.value) {
                        const quantity = parseInt(quantityInput.value);
                        const cost = parseFloat(costInput.value);
                         if (!isNaN(quantity) && quantity > 0 && !isNaN(cost) && cost >= 0) {
                            total += quantity * cost;
                        }
                    }
                });
                purchaseTotalDisplay.textContent = total.toFixed(2);
            };

            // Add the first row initially
            addPurchaseRow();
            updatePurchaseTotal();


            // Event listeners
            document.getElementById('addPurchaseRowBtn')?.addEventListener('click', () => addPurchaseRow()); // Add new empty row
            document.getElementById('cancelAddPurchase')?.addEventListener('click', loadPurchases);

            // Form submission handler
            document.getElementById('purchaseForm')?.addEventListener('submit', async e => {
                e.preventDefault();
                 const msgDiv = document.getElementById('purchaseMsg');
                 msgDiv.innerHTML = '';

                 const supplier_name = document.getElementById('supplierName').value.trim();
                 const purchase_date = document.getElementById('purchaseDate').value;
                 const notes = document.getElementById('notes').value.trim();
                 const rows = [];
                 let formIsValid = true;

                 document.querySelectorAll('.purchase-product-row').forEach(row => {
                    const rowId = row.dataset.rowId;
                    const ps = document.getElementById(`pProduct${rowId}`);
                    const qs = document.getElementById(`pQuantity${rowId}`);
                    const cs = document.getElementById(`pCost${rowId}`);

                     if (ps && ps.value && qs && qs.value && cs && cs.value) {
                         const quantity = +qs.value;
                         const cost = +cs.value;
                        if (quantity <= 0 || cost < 0) {
                             formIsValid = false;
                             qs.classList.toggle('border-red-500', quantity <= 0);
                             cs.classList.toggle('border-red-500', cost < 0);
                        } else {
                            qs.classList.remove('border-red-500');
                            cs.classList.remove('border-red-500');
                            rows.push({
                                product_id: +ps.value,
                                quantity: quantity,
                                unit_cost: cost
                            });
                        }
                     } else if (ps || qs || cs) {
                         formIsValid = false;
                         ps?.classList.toggle('border-red-500', !ps?.value);
                         qs?.classList.toggle('border-red-500', !qs?.value);
                         cs?.classList.toggle('border-red-500', !cs?.value);
                     }
                });

                if (!purchase_date) {
                     formIsValid = false;
                     document.getElementById('purchaseDate').classList.add('border-red-500');
                     msgDiv.innerHTML += '<p class="text-red-600">تاريخ الشراء مطلوب.</p>';
                } else {
                     document.getElementById('purchaseDate').classList.remove('border-red-500');
                }

                if (rows.length === 0) {
                    formIsValid = false;
                    msgDiv.innerHTML += '<p class="text-red-600">يجب أن يحتوي سجل المشتريات على منتج واحد على الأقل.</p>';
                }

                if (!formIsValid) {
                    msgDiv.innerHTML += '<p class="text-red-600">يرجى مراجعة الحقول المطلوبة والتأكد من إدخال قيم صحيحة.</p>';
                    return;
                }

                try {
                    const payload = {
                        supplier_name: supplier_name || null, // Allow null supplier
                        purchase_date,
                        notes: notes || null,
                        products: rows
                    };

                    const res = await fetch('http://localhost:3001/api/purchases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (res.ok) {
                        loadPurchases(); // Reload list on success
                    } else {
                        const errorMsg = result.error || (result.details ? result.details.join(', ') : 'خطأ غير معروف');
                        msgDiv.innerHTML = `<p class="text-red-600">فشل حفظ المشتريات: ${errorMsg}</p>`;
                    }
                } catch (error) {
                    console.error("Error saving purchase:", error);
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم لحفظ المشتريات.</p>';
                }
            });
        } catch (error) {
            document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحضير نموذج المشتريات: ${error.message}</p><button onclick="loadPurchases()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة المشتريات</button>`;
            console.error("Error preparing add purchase form:", error);
        }
    }
    // Function to show edit purchase form
    
    async function showEditPurchaseForm(purchaseId) {
        try {
            // Fetch purchase details and all active products
            const [purchaseRes, productsRes] = await Promise.all([
                fetch(`http://localhost:3001/api/purchases/${purchaseId}`), // Fetch structured purchase data
                fetch('http://localhost:3001/api/products?active=true') // Fetch active products for dropdown
            ]);

            if (!purchaseRes.ok) {
                const errData = await purchaseRes.json();
                 throw new Error(errData.error || `Purchase record with ID ${purchaseId} not found`);
             }
            if (!productsRes.ok) throw new Error('فشل تحميل بيانات المنتجات.');

            const purchaseData = await purchaseRes.json(); // Expected: { ..., products: [...] }
            const products = await productsRes.json();

            // Structure the HTML form for editing
            let html = `
                <div class="max-w-3xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">
                    <h3 class="text-xl font-semibold mb-6 text-gray-700">تعديل سجل المشتريات #${purchaseId}</h3>
                    <div id="purchaseMsg" class="mb-4"></div>
                    <form id="editPurchaseForm" class="space-y-4">
                        <input type="hidden" id="editPurchaseId" value="${purchaseId}">
                        <div>
                            <label for="supplierName" class="block text-sm font-medium text-gray-700 mb-1">اسم المورد (اختياري)</label>
                            <input id="supplierName" name="supplierName" type="text" value="${purchaseData.SupplierName || ''}" placeholder="اسم المورد أو المحل" class="w-full border px-3 py-2 rounded" />
                        </div>
                        <div>
                            <label for="purchaseDate" class="block text-sm font-medium text-gray-700 mb-1">تاريخ الشراء</label>
                            <input type="date" id="purchaseDate" name="purchaseDate" value="${formatDateForInput(purchaseData.PurchaseDate)}" class="w-full border px-3 py-2 rounded" required />
                        </div>
                        <div>
                            <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                            <textarea id="notes" name="notes" rows="2" class="w-full border px-3 py-2 rounded" placeholder="رقم فاتورة المورد، تفاصيل إضافية...">${purchaseData.Notes || ''}</textarea>
                        </div>

                        <fieldset class="border rounded-lg p-4">
                            <legend class="text-base font-medium text-gray-700 px-2">المنتجات</legend>
                             <div class="grid grid-cols-10 gap-2 mb-2 font-semibold text-gray-700">
                                 <div class="col-span-4">المنتج</div>
                                 <div class="col-span-2 text-center">الكمية</div>
                                 <div class="col-span-2 text-center">تكلفة الوحدة</div>
                                 <div class="col-span-2"></div> <!-- for delete button -->
                             </div>
                            <div id="purchaseRows" class="space-y-3 mt-2">
                                <!-- Existing and new product rows will be added here -->
                            </div>
                            <button id="addPurchaseRowBtn" type="button" class="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1 border rounded border-blue-600 hover:border-blue-800">+ إضافة منتج</button>
                        </fieldset>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">إجمالي تكلفة الشراء</label>
                            <div id="purchaseTotalDisplay" class="mt-1 block w-full p-2 bg-gray-100 rounded border border-gray-300 text-center font-bold">0.00</div>
                        </div>

                         <div class="flex justify-end space-x-2 space-x-reverse pt-6">
                            <button type="button" id="cancelEditPurchase" class="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400">إلغاء</button>
                            <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">حفظ التعديلات</button>
                        </div>
                    </form>
                </div>`;

            document.getElementById('content').innerHTML = html;

            const purchaseRowsContainer = document.getElementById('purchaseRows');
            const purchaseTotalDisplay = document.getElementById('purchaseTotalDisplay');
            let purchaseRowCount = 0; // Use a counter for unique element IDs

            // Re-use addPurchaseRow function - it handles pre-filling if 'detail' is provided
            const addPurchaseRow = (detail = null) => {
                const rowId = purchaseRowCount++; // Get a unique ID for this row
                const div = document.createElement('div');
                div.className = 'grid grid-cols-10 gap-2 items-center purchase-product-row'; // Use class name for easier selection
                div.dataset.rowId = rowId; // Store row ID if needed later
                 // In edit form, store original detail ID here for potential future use (backend currently replaces all)
                 // div.dataset.detailId = detail ? detail.PurchaseDetailID || '' : '';


                // Product Select
                const sel = document.createElement('select');
                sel.className = 'product-select col-span-4 border px-3 py-2 rounded'; // Use class and grid span
                sel.id = `pProductSelect_${rowId}`; // Unique ID
                sel.required = true;
                sel.innerHTML = '<option value="">-- اختر منتج --</option>';
                products.forEach(p => {
                     // Check if this product is the one from the detail object (if editing)
                    const isSelected = detail && (p.ProductID === detail.ProductID || p.ProductID === detail.product_id);
                    sel.innerHTML += `<option value="${p.ProductID}" data-cost="${p.UnitCost || 0}" data-price="${p.UnitPrice || 0}" ${isSelected ? 'selected' : ''}>${p.ProductName}</option>`;
                });

                // Quantity Input
                const q = document.createElement('input');
                q.type = 'number';
                q.className = 'quantity-input col-span-2 border px-3 py-2 rounded text-center'; // Use class and grid span
                q.id = `pQuantityInput_${rowId}`; // Unique ID
                q.min = '1'; // Quantity must be at least 1
                q.step = '1';
                q.placeholder = 'الكمية';
                q.required = true;
                 // Pre-fill if detail object is provided (editing)
                q.value = detail ? (detail.Quantity || detail.quantity || detail.detail_quantity || '') : '';

                // Unit Cost Input
                const c = document.createElement('input');
                c.type = 'number';
                c.className = 'unit-cost-input col-span-2 border px-3 py-2 rounded text-center'; // Use class and grid span
                c.id = `pCostInput_${rowId}`; // Unique ID
                c.min = '0'; // Cost can be 0
                c.step = '0.01';
                c.placeholder = 'تكلفة الوحدة';
                c.required = true;
                 // Pre-fill if detail object is provided (editing)
                 // Fallback to product's current cost if detail doesn't have cost?
                 // For ADD form, we only need cost when selected changed. For EDIT, use detail.UnitCost.
                c.value = detail ? (detail.UnitCost || detail.unit_cost || detail.detail_unit_cost || '').toFixed(2) : '';


                // Remove Button
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'remove-product-row col-span-2 text-red-600 hover:text-red-800 p-2'; // Use class and grid span, add padding
                rm.textContent = 'حذف';
                rm.addEventListener('click', () => {
                    div.remove(); // Remove the row div
                    updatePurchaseTotal(); // Update total after removing a row
                });

                 // Add event listeners for inputs to trigger total update
                [sel, q, c].forEach(el => {
                    // Using 'input' event for immediate feedback while typing numbers
                    el.addEventListener('input', updatePurchaseTotal);
                     // Using 'change' event for select dropdown or when input focus is lost
                    el.addEventListener('change', updatePurchaseTotal);
                });

                // Initial population logic for Unit Cost on select change (needed if product is pre-selected or changed)
                sel.addEventListener('change', () => {
                    const selectedOption = sel.options[sel.selectedIndex];
                    const costInput = div.querySelector('.unit-cost-input');
                     // For new rows, populate with product's current cost when selected.
                     // For edit rows, only update cost if the user changes the selected product.
                    if (selectedOption.value) { // If a product is selected
                       // Check if this is a new row (no detail provided) OR if the product selection changed from the original detail
                       const originalProductSelected = detail && detail.ProductID === parseInt(selectedOption.value);
                       if (!detail || !originalProductSelected) { // If adding OR if editing but product changed
                            costInput.value = parseFloat(selectedOption.dataset.cost || '0').toFixed(2);
                       } else if (detail && originalProductSelected) {
                            // If editing and the original product is still selected,
                            // make sure the cost input reflects the ORIGINAL DETAIL cost that was pre-filled.
                            // This prevents the cost from snapping to the *current* average product cost if the user
                            // selects the same product again during edit.
                            // The initial value is already set from `detail.UnitCost`. Do nothing here to keep it.
                       }


                    } else { // If "-- اختر منتج --" is selected
                        costInput.value = ''; // Clear cost if no product selected
                    }
                    updatePurchaseTotal(); // Always update total after select change
                });


                // Append elements to the row div
                div.append(sel, q, c, rm);
                purchaseRowsContainer.append(div);

                 // --- Important for Edit form initial load ---
                 // If loading an existing detail, ensure the select change listener runs ONCE
                 // after the row is added and populated, so the cost input reflects the detail cost
                 // and the total is calculated correctly based on initial values.
                 // Triggering 'change' event on the select handles the potential cost auto-fill logic.
                 // Triggering 'input' on quantity/cost ensures the total is calculated.
                 if (detail) {
                     // Use setTimeout with 0 delay to allow the element to be appended and rendered first
                     setTimeout(() => {
                         // We need to ensure the initial 'detail.UnitCost' is used, not the product's current cost.
                         // So, *do not* fire the 'change' event on the select here, as that might overwrite detail.UnitCost.
                         // Just fire 'input' on quantity and cost to calculate the initial total.
                         q.dispatchEvent(new Event('input')); // Trigger input for total calculation
                         c.dispatchEvent(new Event('input')); // Trigger input for total calculation
                     }, 0);
                 }


                return div; // Return the created div
            };


            // Function to update the total purchase amount display (reused for Add and Edit)
            const updatePurchaseTotal = () => {
                let total = 0;
                // Find all product rows using the class name
                document.querySelectorAll('.purchase-product-row').forEach(row => {
                    // Find inputs within this row using their class names
                    const quantityInput = row.querySelector('.quantity-input');
                    const costInput = row.querySelector('.unit-cost-input');
                    const productSelect = row.querySelector('.product-select'); // Added select to check if a product is chosen

                    // Check if a product is selected AND quantity/cost inputs have values
                    if (productSelect?.value && quantityInput?.value && costInput?.value) {
                        const quantity = parseInt(quantityInput.value);
                        const cost = parseFloat(costInput.value);
                        // Add to total only if quantity is positive and cost is non-negative
                        if (!isNaN(quantity) && quantity > 0 && !isNaN(cost) && cost >= 0) {
                            total += quantity * cost;
                        }
                    }
                });
                // Update the display element
                if (purchaseTotalDisplay) {
                     purchaseTotalDisplay.textContent = total.toFixed(2);
                }
            };


            // Populate existing rows from fetched purchase data
            if (purchaseData.products && purchaseData.products.length > 0) {
                purchaseData.products.forEach(detail => addPurchaseRow(detail));
            } else {
                addPurchaseRow(); // Add at least one empty row if the purchase had no details
            }
            // Ensure total is calculated after initial rows are added/populated
             // Use a small delay to ensure elements are fully rendered and values set.
             setTimeout(updatePurchaseTotal, 50);


            // Add event listeners
            document.getElementById('addPurchaseRowBtn')?.addEventListener('click', () => addPurchaseRow()); // Add new empty row
            document.getElementById('cancelEditPurchase')?.addEventListener('click', loadPurchases); // Go back

            // Form submission handler for EDIT
            document.getElementById('editPurchaseForm')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const msgDiv = document.getElementById('purchaseMsg');
                msgDiv.innerHTML = ''; // Clear previous messages

                const purchaseId = document.getElementById('editPurchaseId').value;
                const supplier_name = document.getElementById('supplierName').value.trim();
                const purchase_date = document.getElementById('purchaseDate').value;
                const notes = document.getElementById('notes').value.trim();
                const updatedProducts = []; // Array to hold updated product data
                let formIsValid = true; // Flag to track form validity


                // Select all product rows using the class name
                 const productRows = document.querySelectorAll('.purchase-product-row');
                 if (productRows.length === 0) {
                     formIsValid = false;
                     msgDiv.innerHTML = '<p class="text-red-600">يجب إضافة منتج واحد على الأقل لسجل المشتريات.</p>';
                 } else {
                     productRows.forEach(row => {
                        // Select inputs within the row
                        const ps = row.querySelector('.product-select');
                        const qs = row.querySelector('.quantity-input');
                        const cs = row.querySelector('.unit-cost-input');

                        // Reset validation styles for this row
                        ps?.classList.remove('border-red-500');
                        qs?.classList.remove('border-red-500');
                        cs?.classList.remove('border-red-500');

                        // Basic validation for each row
                         if (!ps?.value) {
                             formIsValid = false;
                             ps?.classList.add('border-red-500');
                             if (msgDiv.innerHTML.indexOf('يرجى اختيار منتج') === -1) msgDiv.innerHTML += '<p class="text-red-600">يرجى اختيار منتج لكل سطر.</p>';
                         }
                         if (!qs?.value || parseInt(qs.value) <= 0 || isNaN(parseInt(qs.value))) {
                             formIsValid = false;
                             qs?.classList.add('border-red-500');
                             if (msgDiv.innerHTML.indexOf('كمية صحيحة') === -1) msgDiv.innerHTML += '<p class="text-red-600">يرجى إدخال كمية صحيحة (أكبر من صفر).</p>';
                         }
                         if (!cs?.value || parseFloat(cs.value) < 0 || isNaN(parseFloat(cs.value))) {
                             formIsValid = false;
                             cs?.classList.add('border-red-500');
                             if (msgDiv.innerHTML.indexOf('تكلفة وحدة صحيحة') === -1) msgDiv.innerHTML += '<p class="text-red-600">يرجى إدخال تكلفة وحدة صحيحة (غير سالبة).</p>';
                         }


                        // If row is valid, add its data to the updatedProducts array
                        if (ps?.value && qs?.value && cs?.value && parseInt(qs.value) > 0 && parseFloat(cs.value) >= 0) {
                             updatedProducts.push({
                                product_id: parseInt(ps.value),
                                quantity: parseInt(qs.value),
                                unit_cost: parseFloat(cs.value)
                                // No need for detail_id here, backend PUT replaces all details
                             });
                        } else {
                            // If any row is invalid, the overall form is invalid
                            formIsValid = false;
                        }
                     });
                 }


                 // Validate purchase date
                if (!purchase_date) {
                    formIsValid = false;
                    document.getElementById('purchaseDate')?.classList.add('border-red-500');
                     if(msgDiv.innerHTML.indexOf('تاريخ الشراء مطلوب') === -1) msgDiv.innerHTML += '<p class="text-red-600">تاريخ الشراء مطلوب.</p>';
                } else {
                     document.getElementById('purchaseDate')?.classList.remove('border-red-500');
                }


                // If form is not valid, stop submission
                if (!formIsValid) {
                     if(msgDiv.innerHTML === '') msgDiv.innerHTML = '<p class="text-red-600">يرجى مراجعة الحقول المطلوبة والتأكد من إدخال قيم صحيحة.</p>';
                    return;
                }

                try {
                    const payload = {
                        supplier_name: supplier_name || null, // Send null if empty string
                        purchase_date: purchase_date, // YYYY-MM-DD format
                        notes: notes || null, // Send null if empty string
                        products: updatedProducts // Array of { product_id, quantity, unit_cost }
                    };

                    const res = await fetch(`http://localhost:3001/api/purchases/${purchaseId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (res.ok) {
                         msgDiv.innerHTML = '<p class="text-green-600">تم تحديث المشتريات بنجاح.</p>';
                        // Reload the purchases list after successful save
                        setTimeout(loadPurchases, 1500);
                    } else {
                        // Display error message from the backend response
                        const errorMsg = result.error || (result.details ? result.details.join(', ') : 'خطأ غير معروف');
                        msgDiv.innerHTML = `<p class="text-red-600">فشل تعديل المشتريات: ${errorMsg}</p>`;
                    }
                } catch (error) {
                    console.error("Error updating purchase:", error);
                    msgDiv.innerHTML = '<p class="text-red-600">خطأ في الاتصال بالخادم لتعديل المشتريات.</p>';
                }
            });


        } catch (error) {
            // Handle errors during form preparation (e.g., failed to fetch purchase data or products)
            document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في تحضير نموذج تعديل المشتريات: ${error.message}</p>
                <button onclick="loadPurchases()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة المشتريات</button>`;
            console.error("Error preparing edit purchase form:", error);
        }
    }

    // --- Show Purchase Details ---
    async function showPurchaseDetails(purchaseId) {
        try {
            const res = await fetch(`http://localhost:3001/api/purchases/${purchaseId}`);
             if (!res.ok) {
                const errData = await res.json();
                 throw new Error(errData.error || `Purchase record with ID ${purchaseId} not found`);
             }
            const purchaseData = await res.json(); // Expected: { ..., products: [...] }

            // Calculate total cost from details array for display footer
            let totalCostCalculated = 0;
             if (purchaseData.products && Array.isArray(purchaseData.products)) {
                 purchaseData.products.forEach(d => {
                     totalCostCalculated += (d.Quantity || 0) * (d.UnitCost || 0);
                 });
             }


            let html = `<div class="max-w-3xl mx-auto bg-white p-6 rounded shadow-lg border border-gray-200">`;
            html += `<div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-semibold text-gray-800">تفاصيل المشتريات #${purchaseId}</h3>
                        <button onclick="loadPurchases()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">رجوع لقائمة المشتريات</button>
                     </div>`;

            // Purchase Summary Section
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 border-b pb-4 text-gray-700">
                        <div><strong class="text-gray-600">رقم السجل:</strong> ${purchaseData.PurchaseID}</div>
                        <div><strong class="text-gray-600">المورد:</strong> ${purchaseData.SupplierName || '-'}</div>
                        <div><strong class="text-gray-600">تاريخ الشراء:</strong> ${formatDate(purchaseData.PurchaseDate)}</div>
                        <div><strong class="text-gray-600">الإجمالي المحفوظ:</strong> ${purchaseData.TotalAmount ? purchaseData.TotalAmount.toFixed(2) : '0.00'}</div>
                        <div class="md:col-span-2"><strong class="text-gray-600">ملاحظات:</strong> ${purchaseData.Notes || '-'}</div>
                     </div>`;

            // Purchase Details (Products) Section
            html += `<h4 class="mt-4 mb-3 font-semibold text-lg text-gray-700">المنتجات المشتراة</h4>`;
            if(purchaseData.products && purchaseData.products.length > 0) {
                html += `<table class="min-w-full bg-white border">
                            <thead>
                                <tr>
                                    <th class="border px-2 py-1 text-right">المنتج</th>
                                    <th class="border px-2 py-1 text-center">تكلفة الوحدة</th>
                                    <th class="border px-2 py-1 text-center">الكمية</th>
                                    <th class="border px-2 py-1 text-center">التكلفة الفرعية</th>
                                </tr>
                            </thead>
                            <tbody>`;
                purchaseData.products.forEach(d => {
                    const subTotal = (d.Quantity || 0) * (d.UnitCost || 0);
                    html += `<tr class="table-row">
                                <td class="border px-2 py-1 text-right">${d.ProductName || 'منتج غير معروف'}</td>
                                <td class="border px-2 py-1 text-center">${(d.UnitCost || 0).toFixed(2)}</td>
                                <td class="border px-2 py-1 text-center">${d.Quantity || 0}</td>
                                <td class="border px-2 py-1 text-center">${subTotal.toFixed(2)}</td>
                             </tr>`;
                });
                html += `</tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3" class="border px-2 py-1 text-right font-bold">الإجمالي المحسوب من المنتجات المعروضة</td>
                                    <td class="border px-2 py-1 text-center font-bold">${totalCostCalculated.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                         </table>`;
                 // Note: The "الإجمالي المحسوب من المنتجات المعروضة" might differ slightly from "الإجمالي المحفوظ"
                 // if details were added/removed directly in DB without updating the header total,
                 // or if there was rounding. Displaying both can be helpful.
            } else {
                html += `<p class="text-gray-500">لا توجد تفاصيل منتجات لهذا السجل.</p>`;
            }
            html += '</div>'; // Close main container
            document.getElementById('content').innerHTML = html;

        } catch (error) {
            // Handle errors (e.g., purchase not found, API error)
             document.getElementById('content').innerHTML = `<p class="text-red-600 p-4">خطأ في عرض تفاصيل المشتريات: ${error.message}</p>
                 <button onclick="loadPurchases()" class="bg-gray-500 text-white px-3 py-1 rounded mt-2">العودة لقائمة المشتريات</button>`;
            console.error("Error showing purchase details:", error);
        }

    }

    async function deletePurchase(purchaseId) {
        if (!confirm(`هل أنت متأكد من حذف سجل المشتريات رقم ${purchaseId}؟ سيتم عكس تأثيره على كميات المنتجات وتكاليفها في المخزن.`)) return;
        try {
            const res = await fetch(`http://localhost:3001/api/purchases/${purchaseId}`, { method: 'DELETE' });
            const result = await res.json(); // Get response body even on error
            if (res.ok) {
                alert('تم حذف سجل المشتريات بنجاح.');
                loadPurchases(); // Refresh the list
            } else {
                // Display error message from the backend response
                alert(`فشل حذف المشتريات: ${result.error || 'خطأ غير معروف'}`);
            }
        } catch (error) {
            console.error('Error deleting purchase:', error);
            alert('حدث خطأ أثناء محاولة حذف المشتريات.');
        }
     }


    // Navigation handler (already exists, ensure it calls loadPage)
    document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        const page = a.getAttribute('data-page');
        loadPage(page);
    }));

             
  

    // navigation handler
    document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        const page = a.getAttribute('data-page');
        loadPage(page); // Use a function to load page and handle active state
    }));

    // Function to load page content and set active link
    function loadPage(page) {
        // Remove active state from all links
        document.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('bg-blue-100', 'text-blue-600', 'bg-green-100', 'text-green-600', 'bg-purple-100', 'text-purple-600', 'bg-yellow-100', 'text-yellow-600', 'bg-red-100', 'text-red-600', 'bg-orange-100', 'text-orange-600');
             link.classList.remove('font-bold'); // Remove bold if used
        });

        // Find the clicked link and add active state based on page
        const activeLink = document.querySelector(`nav a[data-page="${page}"]`);
        if (activeLink) {
            let bgColor = 'bg-gray-100';
            let textColor = 'text-gray-700';
             switch (page) {
                case 'sales': bgColor = 'bg-blue-100'; textColor = 'text-blue-600'; break;
                case 'products': bgColor = 'bg-green-100'; textColor = 'text-green-600'; break;
                case 'traders': bgColor = 'bg-purple-100'; textColor = 'text-purple-600'; break;
                case 'purchases': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-600'; break;
                case 'expenses': bgColor = 'bg-red-100'; textColor = 'text-red-600'; break;
                case 'payments': bgColor = 'bg-orange-100'; textColor = 'text-orange-600'; break;
                case 'dashboard-stats': bgColor = 'bg-cyan-100'; textColor = 'text-cyan-600'; break;
            }
            activeLink.classList.add(bgColor, textColor, 'font-bold'); // Add bold for extra emphasis
        }


        // Update URL hash
        window.location.hash = page;

        // Load the content
        if (page === 'sales') loadSales();
        else if (page === 'products') loadProducts();
        else if (page === 'traders') loadTraders();
        else if (page === 'purchases') loadPurchases();
        else if (page === 'expenses') loadExpenses();
        else if (page === 'payments') loadPayments();
        else if (page === 'dashboard-stats') loadDashboardStats();
         else loadSales(); // Default to sales if page unknown
    }

    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    let isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

    function applySidebarState() {
        if (isSidebarCollapsed) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }
    }

    toggleSidebarBtn.addEventListener('click', () => {
        isSidebarCollapsed = !isSidebarCollapsed;
        localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
        applySidebarState();
    });

    // Apply initial state on load
    applySidebarState();


    // Initial load based on hash or default to 'sales'
    const initialPage = window.location.hash.substring(1) || 'sales';
    loadPage(initialPage);

  </script>
  <script src="dashboard-stats.js"></script>
</body>
</html>
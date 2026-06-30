import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  Upload, 
  Check, 
  X, 
  FileText, 
  Truck, 
  Search, 
  AlertTriangle, 
  Activity, 
  ClipboardList, 
  ShieldCheck, 
  LogOut
} from 'lucide-react';

const API_BASE = 'https://onrender.com';

interface Pharmacy {
  id: number;
  name: string;
  address: string;
  phone: string;
}

interface Product {
  id: number;
  name: string;
  activeIngredient: string;
  description: string;
  category: string;
  price: number;
  stockQuantity: number;
  sku: string;
  requiresPrescription: boolean;
  expirationDate: string;
  pharmacyId: number;
  pharmacy?: Pharmacy;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string; // CUSTOMER, PHARMACIST, DRIVER, ADMIN
  phone: string;
  address: string;
}

interface Prescription {
  id: number;
  userId: number;
  imageUrl: string;
  status: string; // PENDING, APPROVED, REJECTED
  validatedById?: number;
  validatedBy?: { name: string };
  notes?: string;
  createdAt: string;
  user?: { name: string; email: string };
}

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  priceAtPurchase: number;
  product: Product;
}

interface Order {
  id: number;
  userId: number;
  user?: { name: string; phone: string; address: string };
  totalPrice: number;
  deliveryFee: number;
  paymentStatus: string;
  orderStatus: string; // PENDING, APPROVED, PREPARING, OUT_FOR_DELIVERY, DELIVERED
  driverId?: number;
  driver?: { name: string; phone: string };
  prescriptionId?: number;
  prescription?: Prescription;
  createdAt: string;
  items: OrderItem[];
}

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [authError, setAuthError] = useState('');

  // Navigation State
  const [view, setView] = useState<'catalog' | 'prescriptions' | 'orders' | 'pharmacist-expiring' | 'admin-products'>('catalog');
  
  // Catalog / Product State
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('All');
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Cart State
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Prescription Upload State
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Pharmacist Expiring Date State
  const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);

  // Pharmacist Validation State
  const [valNotes, setValNotes] = useState<{ [id: number]: string }>({});

  // Admin Product Create/Edit Form
  const [adminForm, setAdminForm] = useState({
    name: '', activeIngredient: '', description: '', category: 'Prescription Drugs',
    price: '', stockQuantity: '', sku: '', requiresPrescription: false,
    expirationDate: '', pharmacyId: ''
  });
  const [adminError, setAdminError] = useState('');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Initialize and Fetch Profile
  useEffect(() => {
    if (token) {
      fetchProfile();
      loadPharmacies();
    } else {
      setUser(null);
    }
  }, [token]);

  // Fetch initial data based on Role
  useEffect(() => {
    loadProducts();
    if (user) {
      loadOrders();
      loadPrescriptions();
      if (user.role === 'PHARMACIST' || user.role === 'ADMIN') {
        loadExpiringProducts();
      }
      // Populate shipping address default
      setShippingAddress(user.address || '');
    }
  }, [user, search, selectedCategory, selectedPharmacy]);

  const loadPharmacies = async () => {
    try {
      const res = await fetch(`${API_BASE}/pharmacies`);
      if (res.ok) {
        const data = await res.json();
        setPharmacies(data);
      }
    } catch (e) {
      console.error('Error loading pharmacies', e);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch (e) {
      handleLogout();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCart([]);
    setView('catalog');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? 'login' : 'register';
    const payload = authMode === 'login' 
      ? { email, password }
      : { email, password, name, role, phone, address };

    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setAuthError(data.message || 'Authentication failed');
        return;
      }

      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      
      // Reset forms
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setAddress('');
    } catch (err) {
      setAuthError('Connection error to server');
    }
  };

  const loadProducts = async () => {
    setCatalogLoading(true);
    try {
      let query = `?search=${search}`;
      if (selectedCategory !== 'All') {
        query += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (selectedPharmacy !== 'All') {
        query += `&pharmacyId=${selectedPharmacy}`;
      }
      const res = await fetch(`${API_BASE}/products${query}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Error loading products', e);
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadExpiringProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products/expiring`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpiringProducts(data);
      }
    } catch (e) {
      console.error('Error loading expiring products', e);
    }
  };

  const loadPrescriptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/prescriptions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrescriptions(data);
        // Automatically select the first approved prescription in cart if available
        if (user?.role === 'CUSTOMER') {
          const approved = data.find((p: any) => p.status === 'APPROVED');
          if (approved && !selectedPrescriptionId) {
            setSelectedPrescriptionId(approved.id);
          }
        }
      }
    } catch (e) {
      console.error('Error loading prescriptions', e);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Error loading orders', e);
    }
  };

  // Cart Management
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        if (nextQty > product.stockQuantity) return prev; // Limit to stock
        return prev.map((item) => 
          item.product.id === product.id ? { ...item, quantity: nextQty } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product.id === productId) {
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.product.stockQuantity) return item; // limit to stock
          return { ...item, quantity: nextQty };
        }
        return item;
      }).filter(Boolean) as any;
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Checkouts & Order Placement
  const handleCheckout = async () => {
    setCheckoutMessage(null);
    if (!shippingAddress.trim()) {
      setCheckoutMessage({ type: 'error', text: 'Shipping address is required' });
      return;
    }

    const payload = {
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
      prescriptionId: selectedPrescriptionId,
      shippingAddress,
    };

    try {
      const res = await fetch(`${API_BASE}/orders/checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutMessage({ type: 'error', text: data.message || 'Checkout failed' });
        return;
      }

      setCheckoutMessage({ type: 'success', text: `Order #${data.orderId} placed successfully! Redirecting to orders...` });
      setCart([]);
      loadOrders();
      loadProducts(); // refresh catalog stock levels
      
      setTimeout(() => {
        setCartOpen(false);
        setView('orders');
        setCheckoutMessage(null);
      }, 2000);
    } catch (e) {
      setCheckoutMessage({ type: 'error', text: 'Network connection failed' });
    }
  };

  // Prescription Upload (Base64 file reader simulation)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG/JPG)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.onerror = () => {
      setUploadError('Error reading file');
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedImage) {
      setUploadError('Please select an image file to upload');
      return;
    }

    setUploadLoading(true);
    try {
      const res = await fetch(`${API_BASE}/prescriptions/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl: uploadedImage,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message || 'Failed to upload prescription');
        return;
      }

      // Success
      setNotes('');
      setUploadedImage(null);
      loadPrescriptions();
      // Reset input element
      const fileInput = document.getElementById('presc-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setUploadError('Connection error');
    } finally {
      setUploadLoading(false);
    }
  };

  // Pharmacist Actions
  const handleValidatePrescription = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`${API_BASE}/prescriptions/${id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          notes: valNotes[id] || '',
        }),
      });

      if (res.ok) {
        loadPrescriptions();
      }
    } catch (e) {
      console.error('Error validating prescription', e);
    }
  };

  // Order status transitions (Pharmacists, Admin, Drivers)
  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadOrders();
      }
    } catch (e) {
      console.error('Error updating order status', e);
    }
  };

  const handleClaimOrder = async (orderId: number) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/claim`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        loadOrders();
      }
    } catch (e) {
      console.error('Error claiming order', e);
    }
  };

  // Admin Actions: Create/Edit Products
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const payload = {
      ...adminForm,
      price: parseFloat(adminForm.price),
      stockQuantity: parseInt(adminForm.stockQuantity),
      pharmacyId: parseInt(adminForm.pharmacyId)
    };

    const url = editingProductId 
      ? `${API_BASE}/products/${editingProductId}`
      : `${API_BASE}/products`;
    const method = editingProductId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        setAdminError(data.message || 'Failed to save product');
        return;
      }

      // Success
      setAdminForm({
        name: '', activeIngredient: '', description: '', category: 'Prescription Drugs',
        price: '', stockQuantity: '', sku: '', requiresPrescription: false,
        expirationDate: '', pharmacyId: ''
      });
      setEditingProductId(null);
      loadProducts();
      loadExpiringProducts();
    } catch (err) {
      setAdminError('Network error');
    }
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setAdminForm({
      name: prod.name,
      activeIngredient: prod.activeIngredient,
      description: prod.description,
      category: prod.category,
      price: String(prod.price),
      stockQuantity: String(prod.stockQuantity),
      sku: prod.sku,
      requiresPrescription: prod.requiresPrescription,
      expirationDate: prod.expirationDate.split('T')[0],
      pharmacyId: String(prod.pharmacyId)
    });
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadProducts();
        loadExpiringProducts();
      }
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  // Helper calculations for Cart
  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cartPharmacyIds = new Set(cart.map((item) => item.product.pharmacyId));
  const cartDeliveryFee = cart.length > 0 ? 5.00 + (cartPharmacyIds.size - 1) * 2.00 : 0;
  const cartTotal = cartSubtotal + cartDeliveryFee;
  const cartRequiresPrescription = cart.some((item) => item.product.requiresPrescription);

  const approvedPrescriptions = prescriptions.filter((p) => p.status === 'APPROVED');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER NAVBAR */}
      <header className="app-header">
        <div className="header-container">
          <a href="#" className="logo-section" onClick={() => setView('catalog')}>
            <Activity size={28} />
            <span className="gradient-text">MedNet Marketplace</span>
          </a>

          {user && (
            <nav className="nav-links">
              <span className="nav-link" onClick={() => setView('catalog')}>Catalog</span>
              <span className="nav-link" onClick={() => setView('prescriptions')}>Prescription Portal</span>
              <span className="nav-link" onClick={() => setView('orders')}>Order Tracking</span>
              
              {(user.role === 'PHARMACIST' || user.role === 'ADMIN') && (
                <span className="nav-link" onClick={() => setView('pharmacist-expiring')}>Expiration Tracking</span>
              )}
              {user.role === 'ADMIN' && (
                <span className="nav-link" onClick={() => setView('admin-products')}>Manage Inventory</span>
              )}
            </nav>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>{user.name}</span>
                  <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700 }}>
                    {user.role}
                  </span>
                </div>
                {user.role === 'CUSTOMER' && (
                  <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={() => setCartOpen(true)}>
                    <ShoppingBag size={20} />
                    {cart.length > 0 && (
                      <span style={{ 
                        background: 'var(--primary)', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '18px', 
                        height: '18px', 
                        fontSize: '0.7rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginLeft: '-4px'
                      }}>
                        {cart.reduce((a, b) => a + b.quantity, 0)}
                      </span>
                    )}
                  </button>
                )}
                <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={handleLogout} title="Log Out">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sign in to order</span>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1 }}>
        <div className="container">

          {/* UNAUTHENTICATED SCREEN (LOGIN / SIGNUP) */}
          {!token && (
            <div style={{ maxWidth: '420px', margin: '4rem auto' }} className="glass-panel">
              <div style={{ padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <Activity size={40} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <h2>Welcome to MedNet</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Pharmacy Network & Prescription Verification Portal
                  </p>
                </div>

                <form onSubmit={handleAuthSubmit}>
                  {authMode === 'register' && (
                    <>
                      <div className="form-group">
                        <label>Full Name</label>
                        <input 
                          type="text" 
                          required 
                          className="form-control" 
                          placeholder="e.g. John Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Account Role Type</label>
                        <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                          <option value="CUSTOMER">Customer (Order & Upload)</option>
                          <option value="PHARMACIST">Pharmacist (Verify & Manage)</option>
                          <option value="DRIVER">Delivery Driver (Deliver Orders)</option>
                          <option value="ADMIN">System Administrator (Full Access)</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      className="form-control" 
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input 
                      type="password" 
                      required 
                      className="form-control" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)} 
                    />
                  </div>

                  {authMode === 'register' && (
                    <>
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="+1 (555) 000-0000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)} 
                        />
                      </div>
                      <div className="form-group">
                        <label>Physical Address (For Deliveries)</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="123 Street Name, City"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)} 
                        />
                      </div>
                    </>
                  )}

                  {authError && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={14} /> {authError}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                    {authMode === 'login' ? 'Login to Portal' : 'Create Account'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {authMode === 'login' ? "Don't have an account? " : "Already registered? "}
                  </span>
                  <a 
                    href="#" 
                    style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                    onClick={() => {
                      setAuthMode(authMode === 'login' ? 'register' : 'login');
                      setAuthError('');
                    }}
                  >
                    {authMode === 'login' ? 'Sign Up' : 'Log In'}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* AUTHENTICATED VIEWS */}
          {token && user && (
            <>
              {/* VIEW 1: PRODUCT CATALOG (For Customers & Admins/Pharmacists viewing) */}
              {view === 'catalog' && (
                <div>
                  {/* Hero banner */}
                  <div className="hero">
                    <h1>Get Your Medicines <span className="gradient-text">Delivered Instantly</span></h1>
                    <p>
                      Order from local verified pharmacy branches. Upload prescriptions securely 
                      for quick review by on-duty network pharmacists.
                    </p>
                    
                    {/* Search & Filters Panel */}
                    <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                          type="text" 
                          placeholder="Search medicines, active ingredients, SKU..." 
                          className="form-control" 
                          style={{ paddingLeft: '2.5rem' }}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select 
                          className="form-control" 
                          style={{ width: '180px' }}
                          value={selectedPharmacy}
                          onChange={(e) => setSelectedPharmacy(e.target.value)}
                        >
                          <option value="All">All Pharmacy Branches</option>
                          {pharmacies.map((pharm) => (
                            <option key={pharm.id} value={pharm.id}>{pharm.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Categories Filter Tabs */}
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', justifyContent: 'center' }}>
                    {['All', 'Prescription Drugs', 'OTC Medicines', 'Cosmetics', 'Medical Equipment'].map((cat) => (
                      <button
                        key={cat}
                        className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Products Grid */}
                  {catalogLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading inventory...</div>
                    </div>
                  ) : products.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                      <ShoppingBag size={48} style={{ strokeWidth: 1.5, marginBottom: '1rem' }} />
                      <p>No products match your filters. Check back later!</p>
                    </div>
                  ) : (
                    <div className="grid-catalog">
                      {products.map((prod) => {
                        const isExpired = new Date(prod.expirationDate) < new Date();
                        const isCloseToExpire = !isExpired && 
                          (new Date(prod.expirationDate).getTime() - new Date().getTime()) < 90 * 24 * 60 * 60 * 1000; // 90 days
                        
                        return (
                          <div key={prod.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                              <span className={`badge ${
                                prod.category === 'Prescription Drugs' ? 'badge-prescription' : 
                                prod.category === 'OTC Medicines' ? 'badge-otc' :
                                prod.category === 'Cosmetics' ? 'badge-cosmetics' : 'badge-equipment'
                              }`}>
                                {prod.category}
                              </span>
                              {prod.requiresPrescription && (
                                <span className="badge badge-prescription" style={{ fontSize: '0.65rem' }}>
                                  Prescription Required
                                </span>
                              )}
                            </div>

                            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{prod.name}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                              Active: {prod.activeIngredient}
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexGrow: 1, marginBottom: '1rem' }}>
                              {prod.description}
                            </p>

                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                <span>Branch: {prod.pharmacy?.name}</span>
                                <span>SKU: {prod.sku}</span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    ${prod.price.toFixed(2)}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: prod.stockQuantity > 0 ? 'var(--text-secondary)' : 'var(--danger)' }}>
                                    Stock: {prod.stockQuantity > 0 ? prod.stockQuantity : 'Out of Stock'}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Exp: {new Date(prod.expirationDate).toLocaleDateString()}
                                  </span>
                                  {isExpired ? (
                                    <span className="badge badge-danger" style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                                      EXPIRED
                                    </span>
                                  ) : isCloseToExpire ? (
                                    <span className="badge badge-warning" style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                                      Expiring Soon
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {user?.role === 'CUSTOMER' && (
                                <button 
                                  className="btn btn-primary" 
                                  style={{ width: '100%', padding: '0.6rem' }}
                                  disabled={prod.stockQuantity <= 0 || isExpired}
                                  onClick={() => addToCart(prod)}
                                >
                                  {isExpired ? 'Expired Drug' : prod.stockQuantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: PRESCRIPTION PORTAL */}
              {view === 'prescriptions' && (
                <div>
                  <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Prescription Portal</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Upload doctor prescriptions for authorization. Pharmacists review and approve files to enable purchase of gated items.
                  </p>

                  <div className="grid-dashboard">
                    {/* LEFT PANEL: UPLOAD PRESCRIPTION (For Customers) */}
                    <div>
                      {user.role === 'CUSTOMER' ? (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={20} className="gradient-text" />
                            Upload Prescription
                          </h3>

                          <form onSubmit={handleUploadPrescription}>
                            <div className="form-group">
                              <label>Prescription Document Scan (Image)</label>
                              <div style={{ 
                                border: '2px dashed var(--glass-border)', 
                                borderRadius: 'var(--radius-md)', 
                                padding: '2rem 1rem', 
                                textAlign: 'center',
                                background: 'rgba(0,0,0,0.2)',
                                cursor: 'pointer',
                                transition: 'var(--transition)'
                              }}
                              onClick={() => document.getElementById('presc-file')?.click()}
                              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                              >
                                {uploadedImage ? (
                                  <div>
                                    <FileText size={40} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>Image file loaded successfully.</p>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Click to change</span>
                                  </div>
                                ) : (
                                  <div>
                                    <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click to select/drag image</p>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG or JPG (Max 2MB)</span>
                                  </div>
                                )}
                              </div>
                              <input 
                                type="file" 
                                id="presc-file" 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                                onChange={handleFileChange}
                              />
                            </div>

                            <div className="form-group">
                              <label>Doctor Notes / Remarks (Optional)</label>
                              <textarea 
                                className="form-control" 
                                rows={3} 
                                placeholder="Add doctor name, expiration, or any specific instructions..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                              />
                            </div>

                            {uploadError && (
                              <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <AlertTriangle size={14} /> {uploadError}
                              </div>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={uploadLoading || !uploadedImage}>
                              {uploadLoading ? 'Uploading File...' : 'Submit to Pharmacist'}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                          <h3 style={{ marginBottom: '0.5rem' }}>Role Access</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            As a <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{user.role}</span>, 
                            you have read-write queue access to review customer prescriptions on the right list panel.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* RIGHT PANEL: PRESCRIPTIONS LIST (All for Pharmacists, Personal for Customers) */}
                    <div>
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ClipboardList size={20} className="gradient-text" />
                          {user.role === 'CUSTOMER' ? 'My Prescriptions' : 'Validation Queue'}
                        </h3>

                        {prescriptions.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <FileText size={40} style={{ strokeWidth: 1.5, marginBottom: '0.5rem' }} />
                            <p>No prescriptions uploaded yet.</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {prescriptions.map((presc) => (
                              <div key={presc.id} style={{ 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: 'var(--radius-md)', 
                                padding: '1rem',
                                background: 'rgba(0,0,0,0.1)'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                      Prescription #{presc.id}
                                    </span>
                                    <span className={`badge ${
                                      presc.status === 'APPROVED' ? 'badge-otc' :
                                      presc.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                                    }`}>
                                      {presc.status}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {new Date(presc.createdAt).toLocaleDateString()}
                                  </span>
                                </div>

                                {presc.user && (
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                    Patient: <strong>{presc.user.name}</strong> ({presc.user.email})
                                  </p>
                                )}

                                {presc.notes && (
                                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px' }}>
                                    Notes: {presc.notes}
                                  </p>
                                )}

                                {/* Image Preview */}
                                <div style={{ marginBottom: '1rem' }}>
                                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Document Scan Preview</label>
                                  <div style={{ maxHeight: '160px', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
                                    <img src={presc.imageUrl} alt="Prescription" style={{ width: '100%', objectFit: 'cover' }} />
                                  </div>
                                </div>

                                {/* Pharmacist Validation Actions */}
                                {(user.role === 'PHARMACIST' || user.role === 'ADMIN') && presc.status === 'PENDING' && (
                                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                      <input 
                                        type="text" 
                                        placeholder="Verification Feedback / Notes..." 
                                        className="form-control" 
                                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                                        value={valNotes[presc.id] || ''}
                                        onChange={(e) => setValNotes({ ...valNotes, [presc.id]: e.target.value })}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button 
                                        className="btn btn-primary" 
                                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                                        onClick={() => handleValidatePrescription(presc.id, 'APPROVED')}
                                      >
                                        <Check size={14} /> Approve
                                      </button>
                                      <button 
                                        className="btn btn-danger" 
                                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                                        onClick={() => handleValidatePrescription(presc.id, 'REJECTED')}
                                      >
                                        <X size={14} /> Reject
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {presc.validatedBy && (
                                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Validated By: {presc.validatedBy.name}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: ORDER TRACKING */}
              {view === 'orders' && (
                <div>
                  <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Order Pipeline</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Track status of marketplace orders in real-time. Delivery drivers claim pending shipments for dispatch.
                  </p>

                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Truck size={20} className="gradient-text" />
                      Orders List
                    </h3>

                    {orders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <ShoppingBag size={40} style={{ strokeWidth: 1.5, marginBottom: '0.5rem' }} />
                        <p>No orders recorded in your history.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {orders.map((ord) => (
                          <div key={ord.id} style={{ 
                            border: '1px solid var(--glass-border)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '1.5rem',
                            background: 'rgba(0,0,0,0.1)'
                          }}>
                            {/* Order Top Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                              <div>
                                <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Order #{ord.id}</h4>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Placed: {new Date(ord.createdAt).toLocaleString()}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px' }}>
                                  Payment: <strong>{ord.paymentStatus}</strong>
                                </span>
                                
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  padding: '0.25rem 0.6rem', 
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  background: 
                                    ord.orderStatus === 'DELIVERED' ? 'rgba(16, 185, 129, 0.15)' :
                                    ord.orderStatus === 'OUT_FOR_DELIVERY' ? 'rgba(6, 182, 212, 0.15)' :
                                    ord.orderStatus === 'PREPARING' ? 'rgba(245, 158, 11, 0.15)' :
                                    ord.orderStatus === 'APPROVED' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                  color: 
                                    ord.orderStatus === 'DELIVERED' ? '#34d399' :
                                    ord.orderStatus === 'OUT_FOR_DELIVERY' ? '#22d3ee' :
                                    ord.orderStatus === 'PREPARING' ? '#fbbf24' :
                                    ord.orderStatus === 'APPROVED' ? '#a78bfa' : '#94a3b8'
                                }}>
                                  Status: {ord.orderStatus}
                                </span>
                              </div>
                            </div>

                            {/* Order Details / Patient details */}
                            {ord.user && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '6px' }}>
                                <p><strong>Customer:</strong> {ord.user.name} | {ord.user.phone}</p>
                                <p><strong>Delivery Address:</strong> {ord.user.address}</p>
                              </div>
                            )}

                            {/* Order Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                              {ord.items.map((item) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                  <span>
                                    {item.product?.name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span>
                                  </span>
                                  <span>${(item.priceAtPurchase * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            {/* Totals */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <div>Delivery Fee: ${ord.deliveryFee.toFixed(2)}</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                Total Charged: ${ord.totalPrice.toFixed(2)}
                              </div>
                            </div>

                            {/* Driver Assignment Detail */}
                            {ord.driver && (
                              <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Truck size={14} /> Assigned Driver: {ord.driver.name} ({ord.driver.phone})
                              </div>
                            )}

                            {/* ROLE SPECIFIC PIPELINE CONTROLS */}
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                              
                              {/* Pharmacist / Admin Controls */}
                              {(user.role === 'PHARMACIST' || user.role === 'ADMIN') && (
                                <>
                                  {ord.orderStatus === 'PENDING' && (
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'APPROVED')}
                                    >
                                      Approve Order for Pickup
                                    </button>
                                  )}
                                  {ord.orderStatus === 'APPROVED' && (
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'PREPARING')}
                                    >
                                      Prepare Packages
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Driver Controls */}
                              {user.role === 'DRIVER' && (
                                <>
                                  {!ord.driverId && ['APPROVED', 'PREPARING'].includes(ord.orderStatus) && (
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => handleClaimOrder(ord.id)}
                                    >
                                      Claim for Delivery
                                    </button>
                                  )}
                                  {ord.driverId === user.id && ord.orderStatus === 'PREPARING' && (
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'OUT_FOR_DELIVERY')}
                                    >
                                      Mark Out for Delivery
                                    </button>
                                  )}
                                  {ord.driverId === user.id && ord.orderStatus === 'OUT_FOR_DELIVERY' && (
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: '#10b981' }}
                                      onClick={() => handleUpdateOrderStatus(ord.id, 'DELIVERED')}
                                    >
                                      Confirm Delivery Completed
                                    </button>
                                  )}
                                </>
                              )}

                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 4: PHARMACIST BATCH EXPIRATION DATE TRACKING */}
              {view === 'pharmacist-expiring' && (
                <div>
                  <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Batch Expiration Date Tracking</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Critical inventory safety audit tool. Outlines all catalog products approaching batch expiration thresholds.
                  </p>

                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.75rem' }}>Product & SKU</th>
                          <th style={{ padding: '0.75rem' }}>Active Ingredient</th>
                          <th style={{ padding: '0.75rem' }}>Pharmacy Vendor</th>
                          <th style={{ padding: '0.75rem' }}>Expiration Date</th>
                          <th style={{ padding: '0.75rem' }}>Status</th>
                          <th style={{ padding: '0.75rem' }}>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiringProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No expiring batches found within standard limits.
                            </td>
                          </tr>
                        ) : (
                          expiringProducts.map((prod) => {
                            const isExpired = new Date(prod.expirationDate) < new Date();
                            const diffDays = Math.ceil(
                              (new Date(prod.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                            );
                            
                            return (
                              <tr key={prod.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '0.75rem' }}>
                                  <strong>{prod.name}</strong><br/>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{prod.sku}</span>
                                </td>
                                <td style={{ padding: '0.75rem' }}>{prod.activeIngredient}</td>
                                <td style={{ padding: '0.75rem' }}>{prod.pharmacy?.name}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  {new Date(prod.expirationDate).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {isExpired ? (
                                    <span className="badge badge-danger">EXPIRED</span>
                                  ) : (
                                    <span className="badge badge-warning">{diffDays} Days Left</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <span style={{ color: prod.stockQuantity > 0 ? 'inherit' : 'var(--danger)' }}>
                                    {prod.stockQuantity}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 5: ADMIN / PHARMACIST INVENTORY MANAGER */}
              {view === 'admin-products' && (
                <div>
                  <h2 className="gradient-text" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Inventory Control</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Add new medicines, adjust real-time stock levels, check requires_prescription flags, and update batch SKU catalogs.
                  </p>

                  <div className="grid-dashboard">
                    {/* LEFT PANEL: PRODUCT CREATION/EDIT FORM */}
                    <div>
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem' }}>
                          {editingProductId ? 'Edit Product SKU' : 'Register New Product'}
                        </h3>

                        <form onSubmit={handleProductSubmit}>
                          <div className="form-group">
                            <label>Product Name</label>
                            <input 
                              type="text" 
                              required
                              className="form-control" 
                              placeholder="e.g. Amoxicillin 500mg"
                              value={adminForm.name}
                              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label>Active Chemical Ingredient</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="e.g. Amoxicillin"
                              value={adminForm.activeIngredient}
                              onChange={(e) => setAdminForm({ ...adminForm, activeIngredient: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label>Category</label>
                            <select 
                              className="form-control"
                              value={adminForm.category}
                              onChange={(e) => setAdminForm({ ...adminForm, category: e.target.value })}
                            >
                              <option value="Prescription Drugs">Prescription Drugs</option>
                              <option value="OTC Medicines">OTC Medicines</option>
                              <option value="Cosmetics">Cosmetics</option>
                              <option value="Medical Equipment">Medical Equipment</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Price ($)</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                required
                                className="form-control" 
                                placeholder="19.99"
                                value={adminForm.price}
                                onChange={(e) => setAdminForm({ ...adminForm, price: e.target.value })}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Stock Qty</label>
                              <input 
                                type="number" 
                                required
                                className="form-control" 
                                placeholder="100"
                                value={adminForm.stockQuantity}
                                onChange={(e) => setAdminForm({ ...adminForm, stockQuantity: e.target.value })}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>SKU Code</label>
                              <input 
                                type="text" 
                                required
                                className="form-control" 
                                placeholder="AMX-500-DWT"
                                value={adminForm.sku}
                                onChange={(e) => setAdminForm({ ...adminForm, sku: e.target.value })}
                              />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                              <label>Pharmacy Branch</label>
                              <select 
                                className="form-control"
                                value={adminForm.pharmacyId}
                                required
                                onChange={(e) => setAdminForm({ ...adminForm, pharmacyId: e.target.value })}
                              >
                                <option value="">Select branch</option>
                                {pharmacies.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Batch Expiration Date</label>
                            <input 
                              type="date" 
                              required
                              className="form-control" 
                              value={adminForm.expirationDate}
                              onChange={(e) => setAdminForm({ ...adminForm, expirationDate: e.target.value })}
                            />
                          </div>

                          <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={adminForm.requiresPrescription}
                                onChange={(e) => setAdminForm({ ...adminForm, requiresPrescription: e.target.checked })}
                              />
                              Requires Medical Prescription Validation
                            </label>
                          </div>

                          <div className="form-group">
                            <label>Product Description</label>
                            <textarea 
                              className="form-control" 
                              rows={2} 
                              placeholder="Brief description of instructions or side effects..."
                              value={adminForm.description}
                              onChange={(e) => setAdminForm({ ...adminForm, description: e.target.value })}
                            />
                          </div>

                          {adminError && (
                            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                              {adminError}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                              {editingProductId ? 'Update Inventory' : 'Register Product'}
                            </button>
                            {editingProductId && (
                              <button 
                                type="button" 
                                className="btn btn-secondary"
                                onClick={() => {
                                  setEditingProductId(null);
                                  setAdminForm({
                                    name: '', activeIngredient: '', description: '', category: 'Prescription Drugs',
                                    price: '', stockQuantity: '', sku: '', requiresPrescription: false,
                                    expirationDate: '', pharmacyId: ''
                                  });
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>

                    {/* RIGHT PANEL: PRODUCTS STOCK LIST */}
                    <div>
                      <div className="glass-panel" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem' }}>Catalog Inventory</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {products.map((prod) => (
                            <div key={prod.id} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              borderBottom: '1px solid var(--glass-border)',
                              paddingBottom: '0.75rem',
                              fontSize: '0.9rem'
                            }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{prod.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  SKU: {prod.sku} | Stock: {prod.stockQuantity}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => handleEditProduct(prod)}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="btn btn-danger" 
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => handleDeleteProduct(prod.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* CART DRAWER PANEL (For Customers) */}
      {cartOpen && user && user.role === 'CUSTOMER' && (
        <div className="modal-overlay" onClick={() => setCartOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: '480px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingBag size={22} className="gradient-text" />
                Your Cart
              </h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem', borderRadius: '50%' }}
                onClick={() => setCartOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={48} style={{ strokeWidth: 1.5, marginBottom: '1rem' }} />
                  <p>Your cart is empty.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.75rem' }}>
                    <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Branch: {item.product.pharmacy?.name} | Price: ${item.product.price.toFixed(2)}
                      </div>
                      {item.product.requiresPrescription && (
                        <span className="badge badge-prescription" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', marginTop: '4px' }}>
                          Prescription Needed
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem' }} onClick={() => updateCartQty(item.product.id, -1)}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, width: '20px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.4rem' }} 
                        disabled={item.quantity >= item.product.stockQuantity}
                        onClick={() => updateCartQty(item.product.id, 1)}
                      >
                        <Plus size={12} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.3rem', color: 'var(--danger)', border: 'none' }} onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                
                {/* Prescription Gating Input */}
                {cartRequiresPrescription && (
                  <div style={{ marginBottom: '1.25rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', color: '#f87171', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      <ShieldCheck size={16} /> Prescription Drugs Gating Verified
                    </div>
                    
                    {approvedPrescriptions.length === 0 ? (
                      <div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          You have no approved prescriptions. You must upload a prescription in the <strong>Prescription Portal</strong> first and wait for pharmacist validation.
                        </p>
                      </div>
                    ) : (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select Authorized Prescription Ticket</label>
                        <select 
                          className="form-control" 
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }}
                          value={selectedPrescriptionId || ''}
                          onChange={(e) => setSelectedPrescriptionId(parseInt(e.target.value, 10))}
                        >
                          <option value="">-- Choose Approved Ticket --</option>
                          {approvedPrescriptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              Ticket #{p.id} (Approved {new Date(p.createdAt).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery Address Input */}
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Confirm Delivery Address</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Where should we deliver?" 
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </div>

                {/* Checkout Summary Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Medicines Subtotal:</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Multi-vendor routing fee ({cartPharmacyIds.size} vendor branches):</span>
                    <span>${cartDeliveryFee.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span>Total Amount Charged:</span>
                    <span style={{ color: 'var(--primary)' }}>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {checkoutMessage && (
                  <div style={{ 
                    padding: '0.75rem', 
                    borderRadius: '6px', 
                    fontSize: '0.85rem', 
                    marginBottom: '1rem', 
                    textAlign: 'center',
                    background: checkoutMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: checkoutMessage.type === 'success' ? '#34d399' : '#f87171'
                  }}>
                    {checkoutMessage.text}
                  </div>
                )}

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  disabled={cartRequiresPrescription && !selectedPrescriptionId}
                  onClick={handleCheckout}
                >
                  Confirm Purchase & Pay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '2rem 0', background: 'rgba(5, 7, 12, 0.8)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'auto' }}>
        <p>© 2026 MedNet Pharmacy Network. All rights reserved.</p>
        <p style={{ marginTop: '0.25rem' }}>Fully secure HIPAA compliant relational data systems.</p>
      </footer>
    </div>
  );
}

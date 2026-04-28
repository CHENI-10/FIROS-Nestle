import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const MarketIntelligence = ({ token, user, onLogout }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/salesrep');
    }
  }, [token, navigate]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [region, setRegion] = useState('');
  const [retailerName, setRetailerName] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Product List State
  const [products, setProducts] = useState([]);
  const [lineItems, setLineItems] = useState({});
  const [selectedSkus, setSelectedSkus] = useState([]); 
  const [allDistributors, setAllDistributors] = useState([]); 

  useEffect(() => {
    if (token) {
      fetchProducts();
      fetchDistributors();
    }
  }, [token]);

  const fetchDistributors = async () => {
    try {
      const response = await fetch('/api/distributors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setAllDistributors(data);
      }
    } catch (e) {
      console.error('Error fetching distributors:', e);
    }
  };

  useEffect(() => {
    setDistributorName('');
  }, [region]);

  const availableDistributors = allDistributors.filter(d => d.region === region);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setProducts(data);
        const initialItems = {};
        data.forEach(p => {
          initialItems[p.sku] = {
            sku: p.sku,
            productName: p.productName,
            category: p.category,
            isEmptyShelf: false,
            movementSpeedRaw: 2,
            shelfAvailability: 'in_stock'
          };
        });
        setLineItems(initialItems);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLineItemChange = (sku, field, value) => {
    setLineItems(prev => ({
      ...prev,
      [sku]: { ...prev[sku], [field]: value }
    }));
  };

  const toggleProductSelection = (sku) => {
    setSelectedSkus(prev => 
      prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
    );
  };

  const selectAllProducts = () => {
    if (selectedSkus.length === products.length) {
      setSelectedSkus([]);
    } else {
      setSelectedSkus(products.map(p => p.sku));
    }
  };

  const submitAudit = async () => {
    setSubmitLoading(true);
    try {
      const filteredLineItems = Object.values(lineItems).filter(item => selectedSkus.includes(item.sku));
      
      const payload = {
        region,
        retailerName,
        distributorName,
        auditDate,
        notes,
        lineItems: filteredLineItems
      };

      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          setStep(1);
          setRegion('');
          setRetailerName('');
          setNotes('');
          setSelectedSkus([]);
          setSuccess(false);
          fetchProducts(); 
        }, 3000);
      } else {
        alert('Failed to submit audit');
      }
    } catch (e) {
      alert('Network error submitting audit');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getProductImage = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('milo')) return '/images/milo.png';
    if (lower.includes('nestomalt')) return '/images/nestomalt.png';
    if (lower.includes('nescafe')) return '/images/nescafe.png';
    if (lower.includes('maggi')) return '/images/maggi.png';
    return 'https://via.placeholder.com/100x100.png?text=Nestle';
  };

  // Styles
  const containerStyle = { backgroundColor: '#2A1301', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '20px 0', fontFamily: 'sans-serif' };
  const appStyle = { width: '100%', maxWidth: '375px', backgroundColor: '#FAFAF9', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 32px rgba(0,0,0,0.6)', minHeight: '600px' };
  const headerStyle = { backgroundColor: '#E8DDD0', padding: '16px 20px', borderBottom: '2px solid #C8A96E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const titleStyle = { color: '#8B5E3C', margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' };
  const contentStyle = { padding: '20px', flex: 1, overflowY: 'auto' };
  const inputGroupStyle = { marginBottom: '20px' };
  const labelStyle = { display: 'block', fontSize: '13px', color: '#555', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box', fontSize: '15px', backgroundColor: '#fff', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' };
  const cardStyle = { backgroundColor: '#fff', padding: '16px', borderRadius: '12px', marginBottom: '16px', color: '#8B5E3C', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #eee' };
  const btnPrimary = { width: '100%', padding: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px', boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)', transition: '0.2s' };
  const btnSecondary = { ...btnPrimary, backgroundColor: '#8B5E3C', boxShadow: '0 4px 12px rgba(139, 94, 60, 0.3)' };

  const getPillStyle = (isActive, type) => {
    let bg = '#F5F5F5';
    let color = '#555';
    let border = '1px solid #E0E0E0';
    if (isActive) {
      color = '#fff';
      border = '1px solid transparent';
      if (type === 'good') bg = '#4CAF50';
      else if (type === 'warn') bg = '#FF9800';
      else bg = '#F44336';
    }
    return { flex: 1, padding: '10px 4px', fontSize: '13px', fontWeight: isActive ? 'bold' : 'normal', borderRadius: '20px', backgroundColor: bg, color, border, cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center' };
  };

  const renderStep1 = () => (
    <div style={contentStyle}>
      <h3 style={{ color: '#8B5E3C', marginTop: 0, fontSize: '22px' }}>Retailer Selection</h3>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '24px' }}>Select the outlet to begin your shelf check audit.</p>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>REGION</label>
        <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">Select Region</option>
          <option value="Colombo">Colombo</option>
          <option value="Kandy">Kandy</option>
          <option value="Galle">Galle</option>
          <option value="Jaffna">Jaffna</option>
          <option value="Kurunegala">Kurunegala</option>
        </select>
      </div>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>RETAILER NAME</label>
        <input style={inputStyle} placeholder="Search Keells, Arpico..." value={retailerName} onChange={e => setRetailerName(e.target.value)} />
      </div>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>DISTRIBUTOR</label>
        <select style={{...inputStyle, opacity: region ? 1 : 0.5}} value={distributorName} onChange={e => setDistributorName(e.target.value)} disabled={!region}>
          <option value="">Select Distributor</option>
          {availableDistributors.map(d => (
            <option key={d.distributor_id} value={d.distributor_name}>{d.distributor_name}</option>
          ))}
        </select>
        {!region && <div style={{fontSize: '11px', color: '#888', marginTop: '6px'}}>Please select a region first</div>}
      </div>

      <div style={cardStyle}>
        <label style={{...labelStyle, color: '#8B5E3C', marginBottom: '4px'}}>Audit Date</label>
        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>{auditDate}</div>
      </div>

      <button style={{...btnPrimary, opacity: (!region || !retailerName || !distributorName) ? 0.5 : 1}} onClick={() => setStep(2)} disabled={!region || !retailerName || !distributorName}>
        Proceed &rarr;
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div style={contentStyle}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#8B5E3C', margin: 0, fontSize: '22px' }}>Product Assortment</h3>
        <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>{retailerName}</p>
      </div>

      <button onClick={selectAllProducts} style={{ width: '100%', padding: '12px', marginBottom: '20px', backgroundColor: '#E8DDD0', border: 'none', color: '#8B5E3C', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
        {selectedSkus.length === products.length ? 'Deselect All' : 'Select All Products'}
      </button>

      {loading ? <p>Loading catalog...</p> : (
        <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '12px', padding: '10px', backgroundColor: '#fff', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          {products.map(p => (
            <label key={p.sku} style={{ display: 'flex', alignItems: 'center', padding: '12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', transition: '0.2s', backgroundColor: selectedSkus.includes(p.sku) ? '#f9fbe7' : 'transparent', borderRadius: '8px' }}>
              <input type="checkbox" checked={selectedSkus.includes(p.sku)} onChange={() => toggleProductSelection(p.sku)} style={{ marginRight: '16px', transform: 'scale(1.2)' }} />
              <img src={getProductImage(p.productName)} alt={p.productName} style={{ width: '40px', height: '40px', objectFit: 'contain', marginRight: '12px', borderRadius: '4px', backgroundColor: '#fff', border: '1px solid #eee' }} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>{p.productName}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{p.category} • SKU: {p.sku}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button style={{...btnSecondary, flex: 1}} onClick={() => setStep(1)}>&larr; Back</button>
        <button style={{...btnPrimary, flex: 2, opacity: selectedSkus.length === 0 ? 0.5 : 1}} onClick={() => setStep(3)} disabled={selectedSkus.length === 0}>
          Confirm ({selectedSkus.length}) &rarr;
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const productsArray = Object.values(lineItems).filter(item => selectedSkus.includes(item.sku));
    const checkedCount = productsArray.filter(p => p.isEmptyShelf || p.movementSpeedRaw !== 2).length;
    const progress = Math.round((checkedCount / (productsArray.length || 1)) * 100);

    return (
      <div style={contentStyle}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#8B5E3C', margin: 0, fontSize: '22px' }}>Shelf Check</h3>
          <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>{retailerName}</p>
        </div>

        <div style={{ backgroundColor: '#E0E0E0', height: '10px', borderRadius: '10px', marginBottom: '6px', overflow: 'hidden' }}>
          <div style={{ backgroundColor: '#4CAF50', height: '100%', width: `${progress}%`, transition: 'width 0.4s ease' }}></div>
        </div>
        <p style={{ fontSize: '12px', color: '#666', textAlign: 'right', marginBottom: '24px', fontWeight: 'bold' }}>
          {checkedCount} / {productsArray.length} checked ({progress}%)
        </p>

        {productsArray.map(item => {
          const isErr = item.isEmptyShelf;
          const cardBg = isErr ? '#FFF5F5' : '#fff';
          const cardBorder = isErr ? '1px solid #FFCDD2' : '1px solid #eee';

          return (
            <div key={item.sku} style={{ backgroundColor: cardBg, border: cardBorder, borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ width: '60px', height: '60px', backgroundColor: '#fff', borderRadius: '8px', marginRight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <img src={getProductImage(item.productName)} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: isErr ? 0.6 : 1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: isErr ? '#D32F2F' : '#333', marginBottom: '4px' }}>{item.productName}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}><span style={{backgroundColor: '#E8DDD0', padding: '2px 6px', borderRadius: '12px', color: '#8B5E3C', fontWeight: 'bold', marginRight: '6px'}}>{item.category}</span> SKU: {item.sku}</div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: isErr ? '#D32F2F' : '#666', fontWeight: 'bold', padding: '12px', backgroundColor: isErr ? '#FFEBEE' : '#F9F9F9', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}>
                <input type="checkbox" checked={item.isEmptyShelf} onChange={(e) => handleLineItemChange(item.sku, 'isEmptyShelf', e.target.checked)} style={{ marginRight: '12px', transform: 'scale(1.2)' }} />
                🚨 Flag as Empty Shelf
              </label>

              <div style={{ overflow: 'hidden', maxHeight: isErr ? '0px' : '200px', opacity: isErr ? 0 : 1, transition: 'all 0.4s ease', marginTop: isErr ? '0' : '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>MOVEMENT SPEED</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleLineItemChange(item.sku, 'movementSpeedRaw', 1)} style={getPillStyle(item.movementSpeedRaw === 1, 'warn')}>Slow</button>
                    <button onClick={() => handleLineItemChange(item.sku, 'movementSpeedRaw', 2)} style={getPillStyle(item.movementSpeedRaw === 2, 'good')}>Normal</button>
                    <button onClick={() => handleLineItemChange(item.sku, 'movementSpeedRaw', 3)} style={getPillStyle(item.movementSpeedRaw === 3, 'good')}>Fast</button>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.5px' }}>STOCK LEVEL</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleLineItemChange(item.sku, 'shelfAvailability', 'low')} style={getPillStyle(item.shelfAvailability === 'low', 'err')}>Low</button>
                    <button onClick={() => handleLineItemChange(item.sku, 'shelfAvailability', 'in_stock')} style={getPillStyle(item.shelfAvailability === 'in_stock', 'warn')}>Med</button>
                    <button onClick={() => handleLineItemChange(item.sku, 'shelfAvailability', 'high')} style={getPillStyle(item.shelfAvailability === 'high', 'good')}>High</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button style={{...btnSecondary, flex: 1}} onClick={() => setStep(2)}>Products</button>
          <button style={{...btnPrimary, flex: 2}} onClick={() => setStep(4)}>Review &rarr;</button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div style={contentStyle}>
      <h3 style={{ color: '#8B5E3C', marginTop: 0, fontSize: '22px' }}>Additional Observations</h3>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '24px' }}>{retailerName}</p>

      <div style={inputGroupStyle}>
        <label style={labelStyle}>Store Observations</label>
        <textarea 
          style={{...inputStyle, minHeight: '160px', resize: 'vertical'}} 
          placeholder="Enter observations about shelf stock, competitor activity, visibility issues, or expired products..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        ></textarea>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
        <button style={{...btnSecondary, flex: 1}} onClick={() => setStep(3)}>&larr; Back</button>
        <button style={{...btnPrimary, flex: 2}} onClick={() => setStep(5)}>Final Review &rarr;</button>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const productsArray = Object.values(lineItems).filter(item => selectedSkus.includes(item.sku));
    const emptyProducts = productsArray.filter(p => p.isEmptyShelf);
    const availableProducts = productsArray.filter(p => !p.isEmptyShelf);

    return (
      <div style={contentStyle}>
        <h3 style={{ color: '#8B5E3C', marginTop: 0, fontSize: '22px' }}>Review Audit</h3>
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>{retailerName}</p>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{...cardStyle, flex: 1, textAlign: 'center', margin: 0, backgroundColor: '#F9FBE7', border: '1px solid #DCEDC8'}}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#33691E' }}>{productsArray.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#558B2F', textTransform: 'uppercase' }}>Products</div>
          </div>
          <div style={{...cardStyle, flex: 1, textAlign: 'center', margin: 0, backgroundColor: emptyProducts.length > 0 ? '#FFEBEE' : '#F5F5F5', border: emptyProducts.length > 0 ? '1px solid #FFCDD2' : '1px solid #EEE'}}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: emptyProducts.length > 0 ? '#D32F2F' : '#999' }}>{emptyProducts.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: emptyProducts.length > 0 ? '#C62828' : '#777', textTransform: 'uppercase' }}>Empty Shelves</div>
          </div>
        </div>

        {emptyProducts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#D32F2F', fontSize: '13px', borderBottom: '2px solid #FFCDD2', paddingBottom: '8px', textTransform: 'uppercase' }}>🚨 Action Required</h4>
            {emptyProducts.map(p => (
              <div key={p.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img src={getProductImage(p.productName)} alt="" style={{width: '30px', height: '30px', marginRight: '10px', objectFit: 'contain'}} />
                  <span style={{fontWeight: 'bold', color: '#333'}}>{p.productName}</span>
                </div>
                <button style={{ backgroundColor: '#D32F2F', color: '#fff', border: 'none', borderRadius: '20px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Restock</button>
              </div>
            ))}
          </div>
        )}

        <div>
          <h4 style={{ color: '#8B5E3C', fontSize: '13px', borderBottom: '2px solid #E8DDD0', paddingBottom: '8px', textTransform: 'uppercase' }}>Available Stock</h4>
          {availableProducts.map(p => (
            <div key={p.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img src={getProductImage(p.productName)} alt="" style={{width: '30px', height: '30px', marginRight: '10px', objectFit: 'contain'}} />
                <span style={{color: '#444'}}>{p.productName}</span>
              </div>
              <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '12px' }}>✓ Audited</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '30px' }}>
          <button style={{...btnSecondary, flex: 1, marginTop: '0'}} onClick={() => setStep(4)} disabled={submitLoading}>&larr; Back</button>
          <button style={{...btnPrimary, flex: 2, marginTop: '0', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#4CAF50'}} onClick={submitAudit} disabled={submitLoading}>
            {submitLoading ? 'Submitting...' : <><span style={{marginRight: '8px', fontSize: '20px'}}>📤</span> Submit Audit</>}
          </button>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div style={{...contentStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <div style={{ fontSize: '64px', marginBottom: '20px', animation: 'bounce 1s ease' }}>✅</div>
      <h3 style={{ color: '#4CAF50', margin: '0 0 12px 0', fontSize: '24px' }}>Audit Submitted!</h3>
      <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.5' }}>The intelligence data has been securely synced to the FIROS Field Server.</p>
    </div>
  );

  return (
    <div style={containerStyle}>
      <div style={appStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>FIROS <span style={{color: '#4CAF50'}}>MI</span></div>
          <button onClick={onLogout} style={{ backgroundColor: '#8B5E3C', border: 'none', color: '#fff', fontSize: '12px', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>
        
        {success ? renderSuccess() : (
          <>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </>
        )}
      </div>
    </div>
  );
};

export default MarketIntelligence;

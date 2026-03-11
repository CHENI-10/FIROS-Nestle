import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BarcodeScanner from '../components/BarcodeScanner';
import './BatchRegistration.css';

const BatchRegistration = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Form State
  const [formData, setFormData] = useState({
    ean13: '',
    productName: '',
    packSize: '',
    batchId: '',
    quantity: '',
    mfgDate: '',
    zone: 'A'
  });

  // Handle direct barcode typing
  const handleBarcodeChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, ean13: value }));
    
    // Automatically fetch if it looks like a valid EAN-13 (13 digits)
    if (value.length === 13 && /^\d+$/.test(value)) {
      fetchProductDetails(value);
    } else if (value.length < 13) {
      // Clear product details if barcode is modified
      setFormData(prev => ({ ...prev, productName: '', packSize: '' }));
      setMessage({ type: '', text: '' });
    }
  };

  // Triggered by manual "Fetch" button
  const handleManualFetch = () => {
    if (formData.ean13) {
      fetchProductDetails(formData.ean13);
    }
  };

  // Triggered by BarcodeScanner component
  const handleScan = (scannedBarcode) => {
    setFormData(prev => ({ ...prev, ean13: scannedBarcode }));
    setShowScanner(false); // Auto-close scanner on success
    fetchProductDetails(scannedBarcode);
  };

  const fetchProductDetails = async (barcode) => {
    if (!barcode) return;
    
    setIsLoadingProduct(true);
    setMessage({ type: '', text: '' });
    
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/products/barcode/${barcode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFormData(prev => ({
        ...prev,
        productName: response.data.name,
        packSize: response.data.packSize
      }));
    } catch (error) {
      console.error('Error fetching product:', error);
      setFormData(prev => ({ ...prev, productName: '', packSize: '' }));
      
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Product not found. Please check barcode.'
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.productName) {
      setMessage({ type: 'error', text: 'Please scan or enter a valid product barcode first.' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/batches',
        {
          ean13: formData.ean13,
          batchId: formData.batchId,
          quantity: Number(formData.quantity),
          mfgDate: formData.mfgDate,
          zone: formData.zone
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // On Success
      const { batchId, expiryDate } = response.data;
      const formattedExpiry = new Date(expiryDate).toLocaleDateString();
      
      setMessage({
        type: 'success',
        text: `Batch ${batchId} registered successfully! Expiry Date: ${formattedExpiry}`
      });

      // Reset form but optionally keep zone/date for faster next entry
      setFormData({
        ean13: '',
        productName: '',
        packSize: '',
        batchId: '',
        quantity: '',
        mfgDate: '',
        zone: 'A'
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to register batch. Batch ID might already exist.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-header">
        <h1>Batch Registration</h1>
        <p>Scan or enter product details to register a new batch.</p>
      </div>

      <div className="registration-card">
        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'error' ? (
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon">
                <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor"/>
              </svg>
            ) : (
               <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="icon">
                <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM10.5858 15.4142L17.6569 8.34315L16.2426 6.92893L10.5858 12.5858L7.75736 9.75736L6.34315 11.1716L10.5858 15.4142Z" fill="currentColor"/>
              </svg>
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Barcode Section */}
        <div className="scanner-section">
          <div className="barcode-input-group">
            <div className="input-with-button">
              <input
                type="text"
                placeholder="Enter EAN-13 Barcode manually"
                value={formData.ean13}
                onChange={handleBarcodeChange}
                maxLength="13"
                className="barcode-input"
              />
              <button 
                type="button" 
                onClick={handleManualFetch}
                className="fetch-btn"
                disabled={!formData.ean13 || isLoadingProduct}
              >
                {isLoadingProduct ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div className="divider"><span>OR</span></div>
            <button 
              type="button" 
              className={`toggle-scanner-btn ${showScanner ? 'active' : ''}`}
              onClick={() => setShowScanner(!showScanner)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon">
                <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M2 12h20M9 12h6"/>
              </svg>
              {showScanner ? 'Hide Camera' : 'Scan Barcode with Camera'}
            </button>
          </div>
          
          {showScanner && (
            <div className="scanner-container">
              <BarcodeScanner onScan={handleScan} />
            </div>
          )}
        </div>

        {/* Main form */}
        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-row">
            <div className="form-group read-only">
              <label>Product Name</label>
              <input 
                type="text" 
                value={formData.productName || 'Pending scan...'} 
                readOnly 
                className={formData.productName ? 'filled' : 'empty'}
              />
            </div>
            <div className="form-group read-only">
              <label>Pack Size</label>
              <input 
                type="text" 
                value={formData.packSize || '-'} 
                readOnly 
                className={formData.packSize ? 'filled' : 'empty'}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="batchId">Batch Number / ID</label>
              <input
                type="text"
                id="batchId"
                name="batchId"
                value={formData.batchId}
                onChange={handleInputChange}
                placeholder="e.g. BATCH123"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Quantity</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="1"
                placeholder="Enter quantity"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mfgDate">Manufacturing Date</label>
              <input
                type="date"
                id="mfgDate"
                name="mfgDate"
                value={formData.mfgDate}
                onChange={handleInputChange}
                max={new Date().toISOString().split('T')[0]} // Cannot be future date
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="zone">Storage Zone</label>
              <div className="select-wrapper">
                <select
                  id="zone"
                  name="zone"
                  value={formData.zone}
                  onChange={handleInputChange}
                  required
                >
                  <option value="A">Zone A</option>
                  <option value="B">Zone B</option>
                  <option value="C">Zone C</option>
                  <option value="D">Zone D</option>
                </select>
                <svg className="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className={`submit-btn ${isSubmitting ? 'loading' : ''}`}
            disabled={isSubmitting || !formData.productName}
          >
            {isSubmitting ? <span className="spinner"></span> : 'Register Batch'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BatchRegistration;

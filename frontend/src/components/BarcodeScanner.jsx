import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const BarcodeScanner = ({ onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);

  const startScanner = async () => {
    if (isScanning) return;
    setErrorMsg('');
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('reader');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { 
          fps: 20, 
          // Dynamic qrbox that scales with the screen size
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            return {
              width: viewfinderWidth * 0.8,
              height: viewfinderHeight * 0.4
            };
          },
          // Only process EAN-13 barcodes as requested
          formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13 ],
          aspectRatio: 1.0
        },
        (decodedText, decodedResult) => {
          // On successful scan
          if (onScan) {
            onScan(decodedText);
          }
        },
        (errorMessage) => {
          // Ignore scanning process errors (thrown when frame has no code)
        }
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error("Error starting barcode scanner:", err);
      const errMsg = String(err).toLowerCase();
      if (errMsg.includes("notallowederror") || errMsg.includes("permission denied")) {
        setErrorMsg("Camera access was denied. Please allow camera permissions in your browser settings to scan barcodes.");
      } else if (errMsg.includes("notfounderror")) {
        setErrorMsg("No camera device found on this device.");
      } else {
        setErrorMsg("Could not start camera. Please check your permissions and try again.");
      }
    }
  };

  const stopScanner = async () => {
    if (!isScanning || !scannerRef.current) return;
    
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
      setIsScanning(false);
    } catch (err) {
      console.error("Error stopping barcode scanner:", err);
    }
  };

  useEffect(() => {
    // Cleanup sequence on component unmount
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current.clear();
        }).catch(err => {
          console.error("Error during cleanup:", err);
        });
      }
    };
  }, []);

  return (
    <div className="barcode-scanner-wrapper">
      {errorMsg && (
        <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', borderLeft: '4px solid #ef4444', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
          {errorMsg}
        </div>
      )}
      <div 
        id="reader" 
        style={{ 
          width: '100%', 
          maxWidth: '500px', 
          margin: '0 auto', 
          overflow: 'hidden', 
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      ></div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        {!isScanning ? (
          <button 
            type="button" 
            onClick={startScanner}
            style={styles.startBtn}
          >
            Start Scanner
          </button>
        ) : (
          <button 
            type="button" 
            onClick={stopScanner}
            style={styles.stopBtn}
          >
            Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
};

const styles = {
  startBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#5c3a21', // Nestlé brown primary
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem'
  },
  stopBtn: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#E5002C', // Error red
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem'
  }
};

export default BarcodeScanner;

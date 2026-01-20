'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('pdf-cart-context');

const PdfCartContext = createContext(null);

const STORAGE_KEY = 'timesheet_pdf_cart';

export function PdfCartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from sessionStorage on mount (session-only persistence)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        log.info({ itemCount: parsed.length }, 'PDF cart loaded from sessionStorage');
        setCartItems(parsed);
      }
    } catch (error) {
      log.error({ error: error.message }, 'Error loading PDF cart from sessionStorage');
    }
    setIsLoaded(true);
  }, []);

  // Save cart to sessionStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
        log.debug({ itemCount: cartItems.length }, 'PDF cart saved to sessionStorage');
      } catch (error) {
        log.error({ error: error.message }, 'Error saving PDF cart to sessionStorage');
      }
    }
  }, [cartItems, isLoaded]);

  // Add a PDF to the cart
  const addToCart = (pdfData) => {
    const newItem = {
      id: Date.now(),
      name: pdfData.name,
      data: pdfData.data, // Base64 or ArrayBuffer
      size: pdfData.size,
      source: pdfData.source, // 'csv-to-pdf' or 'greatday-to-pdf'
      createdAt: new Date().toISOString()
    };

    log.info({ fileName: newItem.name, source: newItem.source }, 'Adding PDF to cart');
    setCartItems(prev => [...prev, newItem]);
    return newItem.id;
  };

  // Remove a PDF from the cart
  const removeFromCart = (id) => {
    const item = cartItems.find(i => i.id === id);
    log.info({ fileName: item?.name, id }, 'Removing PDF from cart');
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  // Clear all items from the cart
  const clearCart = () => {
    log.info({ itemCount: cartItems.length }, 'Clearing PDF cart');
    setCartItems([]);
  };

  // Get cart count
  const cartCount = cartItems.length;

  // Reorder items in cart
  const reorderCart = (fromIndex, toIndex) => {
    const newItems = [...cartItems];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    log.debug({ fromIndex, toIndex }, 'Reordering PDF cart');
    setCartItems(newItems);
  };

  // Move item up/down
  const moveItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cartItems.length) return;
    reorderCart(index, newIndex);
  };

  return (
    <PdfCartContext.Provider value={{
      cartItems,
      cartCount,
      isLoaded,
      addToCart,
      removeFromCart,
      clearCart,
      reorderCart,
      moveItem
    }}>
      {children}
    </PdfCartContext.Provider>
  );
}

export function usePdfCart() {
  const context = useContext(PdfCartContext);
  if (!context) {
    throw new Error('usePdfCart must be used within a PdfCartProvider');
  }
  return context;
}

export default PdfCartContext;

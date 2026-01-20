'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('user-data-context');

const UserDataContext = createContext(null);

const STORAGE_KEY = 'timesheet_user_data';

// Default user data structure
const defaultUserData = {
  employeeName: '',
  teamLeader: '',
  checkedBy: '',
  approvedBy: '',
  signatureImage: null
};

export function UserDataProvider({ children }) {
  const [userData, setUserData] = useState(defaultUserData);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        log.info('User data loaded from localStorage');
        setUserData({ ...defaultUserData, ...parsed });
      }
    } catch (error) {
      log.error({ error: error.message }, 'Error loading user data from localStorage');
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        log.debug('User data saved to localStorage');
      } catch (error) {
        log.error({ error: error.message }, 'Error saving user data to localStorage');
      }
    }
  }, [userData, isLoaded]);

  // Update a single field
  const updateField = (field, value) => {
    log.info({ field }, 'Updating user data field');
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  // Update multiple fields at once
  const updateFields = (fields) => {
    log.info({ fields: Object.keys(fields) }, 'Updating multiple user data fields');
    setUserData(prev => ({ ...prev, ...fields }));
  };

  // Clear all user data
  const clearUserData = () => {
    log.info('Clearing all user data');
    setUserData(defaultUserData);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      log.error({ error: error.message }, 'Error clearing user data from localStorage');
    }
  };

  return (
    <UserDataContext.Provider value={{
      userData,
      isLoaded,
      updateField,
      updateFields,
      clearUserData
    }}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
}

export default UserDataContext;

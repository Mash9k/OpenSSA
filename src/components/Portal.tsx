'use client';

import React from 'react';
import { createPortal } from 'react-dom';

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(
    <div>{children}</div>,
    document.body
  );
};

export default Portal;
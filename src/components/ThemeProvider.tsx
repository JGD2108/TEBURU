"use client";

import { useEffect } from 'react';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function loadTheme() {
      try {
        const response = await fetch('/api/public/settings');
        const { data } = await response.json();
          
        if (data && data.primary_color) {
          document.documentElement.style.setProperty('--primary', data.primary_color);
        }
      } catch (error) {
        console.error("Error loading theme:", error);
      }
    }
    loadTheme();
  }, []);

  return <>{children}</>;
}

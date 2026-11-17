'use client';

import React from 'react';
import { 
  Home, 
  Shield, 
  Trash2, 
  Activity, 
  BarChart3, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TabId } from '@/lib/types';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'safety', label: 'Safety', icon: Shield },
  { id: 'remove', label: 'Remove', icon: Trash2 },
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'apps', label: 'Insights', icon: BarChart3 },
];

export function Sidebar({ activeTab, onTabChange, isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside className={cn('sidebar', isCollapsed && 'collapsed')}>
      <div className="sidebar-header">
        {!isCollapsed && <span className="font-bold text-lg tracking-tight text-white px-2">OpenSSA</span>}
        <button onClick={onToggle} className="sidebar-toggle">
          {isCollapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as TabId)}
              className={cn('sidebar-nav-item w-full', isActive && 'active')}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="icon" />
              {!isCollapsed && <span className="label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer overflow-hidden">
        <button
          onClick={() => onTabChange('settings')}
          className={cn('sidebar-nav-item w-full flex justify-center', activeTab === 'settings' && 'active')}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <span className="sr-only">Settings</span>
          {isCollapsed ? (
            <SettingsIcon className="h-5 w-5" />
          ) : (
            <>
              <SettingsIcon className="h-5 w-5" />
              <span className="label">Settings</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
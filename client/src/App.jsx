import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MobileNav from './components/MobileNav';

import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import ExpensesPage from './pages/ExpensesPage';
import LoansPage from './pages/LoansPage';
import LeavesPage from './pages/LeavesPage';
import PayrollPage from './pages/PayrollPage';
import RequestsPage from './pages/RequestsPage';
import EmployeePortalPage from './pages/EmployeePortalPage';
import WarehousePortalPage from './pages/WarehousePortalPage';
import BiometricPage from './pages/BiometricPage';
import TreasuryPage from './pages/TreasuryPage';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
  });

  // Check if standalone URL was opened directly
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const isStandaloneWarehouse = pathname.startsWith('/warehouse') || pathname === '/manager' || hash === '#warehouse';
  const isStandaloneEmployee = pathname.startsWith('/portal') || hash === '#portal';

  // If user opens http://<IP>:5000/warehouse-portal directly, show standalone Warehouse Portal
  if (isStandaloneWarehouse) {
    return <WarehousePortalPage />;
  }

  // If user opens http://<IP>:5000/portal directly, show standalone Employee Portal
  if (isStandaloneEmployee) {
    return <EmployeePortalPage />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'employees':
        return <EmployeesPage />;
      case 'attendance':
        return <AttendancePage setActiveTab={setActiveTab} />;
      case 'biometric':
        return <BiometricPage />;
      case 'treasury':
        return <TreasuryPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'loans':
        return <LoansPage />;
      case 'leaves':
        return <LeavesPage />;
      case 'payroll':
        return <PayrollPage />;
      case 'requests':
        return <RequestsPage />;
      case 'warehouse':
        return <WarehousePortalPage />;
      case 'portal':
        return <EmployeePortalPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-['Cairo',sans-serif]">
      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Top Header & Navigation */}
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Desktop Header */}
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

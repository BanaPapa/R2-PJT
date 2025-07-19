import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">
                부동산 데이터 비교 플랫폼
              </h1>
            </div>
          </div>
          
          {/* Navigation or Actions */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">MVP 버전</span>
          </div>
        </div>
      </div>
    </header>
  );
};
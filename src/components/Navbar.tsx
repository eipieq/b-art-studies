'use client';

import Link from 'next/link';

interface NavbarProps {
  yarndings20ClassName: string;
  brandName: string;
}

export default function Navbar({
  yarndings20ClassName,
  brandName,
}: NavbarProps) {
  return (
    <nav className="inset-x-0 top-0 z-50 border-b border-gray-100 bg-white">
      <div className="max-w mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-semibold text-indigo-700"
          >
            {brandName}
          </Link>
          {/* <p className="text-sm font-medium text-gray-500"></p> */}
        </div>
      </div>
    </nav>
  );
}

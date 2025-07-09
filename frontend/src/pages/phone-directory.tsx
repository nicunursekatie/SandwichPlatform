import { Sandwich, LogOut, LayoutDashboard, ListTodo, MessageCircle, ClipboardList, FolderOpen, BarChart3, Users, Car, Building2, FileText, Phone } from "lucide-react";
import PhoneDirectory from "@/components/phone-directory";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

export default function PhoneDirectoryPage() {
  const [location] = useLocation();

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { id: "projects", label: "Projects", icon: ListTodo, path: "/" },
    { id: "messages", label: "Messages", icon: MessageCircle, path: "/" },
    { id: "meetings", label: "Meetings", icon: ClipboardList, path: "/meetings" },
    { id: "toolkit", label: "Toolkit", icon: FileText, path: "/" },
    { id: "collections", label: "Collections", icon: BarChart3, path: "/" },
    { id: "hosts", label: "Hosts", icon: Building2, path: "/" },
    { id: "recipients", label: "Recipients", icon: Users, path: "/" },
    { id: "directory", label: "Phone Directory", icon: Phone, path: "/phone-directory" },
    { id: "drivers", label: "Drivers", icon: Car, path: "/" },
    { id: "development", label: "Development", icon: FileText, path: "/development" },
  ];

  return (
    <div className="bg-slate-50 min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Sandwich className="text-amber-500 w-6 h-6" />
            <h1 className="text-lg font-semibold text-slate-900">The Sandwich Project</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <li key={item.id}>
                  <Link 
                    href={item.path}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Welcome, Team</span>
            <button 
              onClick={async () => {
                try {
                  await fetch('/api/logout', { method: 'POST' });
                  queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
                  queryClient.clear();
                  window.location.href = '/';
                } catch (error) {
                  queryClient.clear();
                  window.location.href = '/';
                }
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <PhoneDirectory />
      </div>
    </div>
  );
}
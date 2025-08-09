"use client";

import { cn } from "../../lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider
} from "../ui/sidebar";
import {
  HomeIcon,
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  CogIcon,
  UserIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  {
    name: "Listings",
    href: "/listings",
    icon: BuildingOfficeIcon,
    children: [
      { name: "All Properties", href: "/listings" },
      { name: "By Location", href: "/listings/locations" },
      { name: "Price History", href: "/listings/prices" },
      { name: "Time on Market", href: "/listings/time-on-market" },
    ],
  },
  { name: "Search & Filters", href: "/search", icon: MagnifyingGlassIcon },
  { name: "Trends & Analytics", href: "/analytics", icon: ArrowTrendingUpIcon },
  { name: "Scraper Controls", href: "/scraper", icon: PlayIcon },
  { name: "Admin Settings", href: "/admin", icon: CogIcon },
  { name: "Profile", href: "/profile", icon: UserIcon },
];

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <BuildingOfficeIcon className="h-8 w-8 text-primary" />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-sidebar-foreground">
              Property Scraper
            </h1>
            <p className="text-sm text-sidebar-foreground/70">Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Application
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.children && pathname.startsWith(item.href) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <SidebarMenuButton
                          key={child.name}
                          asChild
                          size="sm"
                          isActive={pathname === child.href}
                        >
                          <Link href={child.href}>
                            <span className="text-xs">{child.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      ))}
                    </div>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <div className="flex items-center gap-2 p-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col flex-1">
            <p className="text-sm font-medium text-sidebar-foreground">
              Admin User
            </p>
            <p className="text-xs text-sidebar-foreground/70">View profile</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

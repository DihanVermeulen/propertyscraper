"use client";

import { cn } from "../../lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
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
  SidebarProvider,
} from "../ui/sidebar";
import {
  HomeIcon,
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  CogIcon,
  UserIcon,
  PlayIcon,
  ChartBarSquareIcon,
} from "@heroicons/react/24/outline";

// Navigation items that depend on user role
const getNavigation = (userRole?: string) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: HomeIcon, visible: true },
    {
      name: "Listings",
      href: "/listings",
      icon: BuildingOfficeIcon,
      visible: true,
      children: [
        { name: "All Properties", href: "/listings", visible: true },
        { name: "By Location", href: "/listings/locations", visible: true },
        {
          name: "Price History",
          href: "/listings/prices",
          visible:
            process.env.NEXT_PUBLIC_FEATURE_PRICE_History_ENABLED === "true" ||
            false,
        },
        {
          name: "Time on Market",
          href: "/listings/time-on-market",
          visible:
            process.env.NEXT_PUBLIC_FEATURE_TIME_ON_MARKET_ENABLED === "true" ||
            false,
        },
      ],
    },
    {
      name: "Investor Dashboard",
      href: "/investor",
      icon: ChartBarSquareIcon,
      visible:
        process.env.NEXT_PUBLIC_FEATURE_INVESTOR_DASHBOARD_ENABLED === "true" ||
        false,
      children: [
        { name: "Overview", href: "/investor", visible: true },
        {
          name: "Yield Calculator",
          href: "/investor/calculator",
          visible: true,
        },
        { name: "Market Analysis", href: "/investor/market", visible: true },
        {
          name: "Opportunities",
          href: "/investor/opportunities",
          visible: true,
        },
      ],
    },
    {
      name: "Trends & Analytics",
      href: "/analytics",
      icon: ArrowTrendingUpIcon,
      visible:
        process.env.NEXT_PUBLIC_FEATURE_TRENDS_ANALYTICS_ENABLED === "true" ||
        false,
    },
  ];

  // Add admin-specific navigation
  if (userRole === "admin") {
    baseNavigation.push(
      {
        name: "Scraper Controls",
        href: "/scraper",
        icon: PlayIcon,
        visible: true,
      },
      {
        name: "Admin Settings",
        href: "/admin/users",
        icon: CogIcon,
        visible: true,
        children: [
          { name: "User Management", href: "/admin/users", visible: true },
        ],
      }
    );
  }

  return baseNavigation;
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const navigation = getNavigation(user?.role);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-sidebar-foreground">
              KSP Property Scraper
            </h1>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name} hidden={!item.visible}>
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
                          hidden={!child.visible}
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

      <SidebarFooter></SidebarFooter>
    </Sidebar>
  );
}

'use client';

import { BellIcon } from '@heroicons/react/20/solid';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export default function TopBar() {
  return (
    <div className="flex items-center justify-end flex-1">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <BellIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">Notifications</span>
        </div>
        <UserCircleIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>
  );
}

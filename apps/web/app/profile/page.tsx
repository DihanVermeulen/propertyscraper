'use client';

import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import PasswordUpdateForm from '../../components/profile/PasswordUpdateForm';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { 
  User, 
  Mail, 
  Shield, 
  Crown, 
  Eye, 
  Calendar,
  Settings
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'user':
        return <Shield className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'user':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string | null | undefined, formatStr: string = 'MMMM dd, yyyy') => {
    if (!dateString) return 'Not available';
    
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
      if (isValid(date)) {
        return format(date, formatStr);
      }
      return 'Invalid date';
    } catch (error) {
      console.error('Date formatting error:', error, dateString);
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and security preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details and role information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Avatar/Initials */}
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-semibold text-primary">
                  {user.firstName?.charAt(0)?.toUpperCase() || ''}
                  {user.lastName?.charAt(0)?.toUpperCase() || ''}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {user.firstName} {user.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={getRoleBadgeVariant(user.role)}
                    className="flex items-center gap-1"
                  >
                    {getRoleIcon(user.role)}
                    <span className="capitalize">{user.role}</span>
                  </Badge>
                  <Badge variant={user.isActive ? "secondary" : "destructive"}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Email Address</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Member Since</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Role Description */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm font-medium mb-1">Role Permissions:</div>
              <div className="text-xs text-muted-foreground">
                {user.role === 'admin' && (
                  <ul className="space-y-1">
                    <li>• Full system access and management</li>
                    <li>• User management and role assignment</li>
                    <li>• System configuration and settings</li>
                    <li>• All property and data access</li>
                  </ul>
                )}
                {user.role === 'user' && (
                  <ul className="space-y-1">
                    <li>• Standard property search and viewing</li>
                    <li>• Investment analysis tools</li>
                    <li>• Market data access</li>
                    <li>• Profile management</li>
                  </ul>
                )}
                {user.role === 'viewer' && (
                  <ul className="space-y-1">
                    <li>• Read-only access to properties</li>
                    <li>• Basic market data viewing</li>
                    <li>• Limited search functionality</li>
                    <li>• Profile viewing only</li>
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Update */}
        <PasswordUpdateForm />
      </div>

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Security Information</CardTitle>
          <CardDescription>
            Important security practices for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Password Security:</strong> Your password is encrypted and cannot be viewed by administrators. Only you can change your password by providing your current password.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Account Security:</strong> Changing your password will log you out from all devices for security purposes.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Role Changes:</strong> Only administrators can modify user roles. If you need different permissions, contact your system administrator.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

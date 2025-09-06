'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { userApi, User } from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { 
  Crown, 
  Shield, 
  Eye, 
  Plus, 
  UserX, 
  Edit3, 
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  Mail,
  User as UserIcon,
  Calendar
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New user form state
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
  });

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser?.role]);

  // Check if current user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You need administrator privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await userApi.getAllUsers(1, 50);
      setUsers(response.users);
    } catch (error: any) {
      setError('Failed to load users');
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');
    
    try {
      await userApi.createUser(newUser);
      setSuccess('User created successfully');
      setShowCreateForm(false);
      setNewUser({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'user',
      });
      fetchUsers();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: 'admin' | 'user' | 'viewer') => {
    try {
      await userApi.updateUserRole(userId, newRole);
      setSuccess('User role updated successfully');
      setEditingUserId(null);
      fetchUsers();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update user role');
    }
  };

  const handleDeactivateUser = async (userId: number) => {
    if (userId === currentUser?.id) {
      setError('You cannot deactivate your own account');
      return;
    }

    if (!confirm('Are you sure you want to deactivate this user? They will be logged out and unable to access the system.')) {
      return;
    }

    try {
      await userApi.deactivateUser(userId);
      setSuccess('User deactivated successfully');
      fetchUsers();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to deactivate user');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'user':
        return <Shield className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
      default:
        return <UserIcon className="h-4 w-4" />;
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

  // Safe date formatting function
  const formatDate = (dateString: string | null | undefined, formatStr: string = 'MMM dd, yyyy') => {
    if (!dateString) return 'Never';
    
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage system users, roles, and access permissions
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button variant="ghost" size="sm" onClick={() => setError('')} className="ml-auto">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
          <CheckCircle2 className="h-4 w-4" />
          {success}
          <Button variant="ghost" size="sm" onClick={() => setSuccess('')} className="ml-auto">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New User
            </CardTitle>
            <CardDescription>
              Add a new user to the system with specified role and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    required
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    required
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required
                  disabled={isCreating}
                  placeholder="Minimum 8 characters, include uppercase, lowercase, number, and special character"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <select
                  className="w-full h-9 px-3 py-1 text-sm border border-input bg-background rounded-md"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as 'admin' | 'user' | 'viewer'})}
                  disabled={isCreating}
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="user">User - Standard access</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create User'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Security Policy</CardTitle>
          <CardDescription>
            Important information about user management and security practices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Password Security:</strong> User passwords are encrypted and cannot be viewed or modified by administrators. Users must change their own passwords through their profile settings.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Initial Passwords:</strong> When creating new users, provide a secure temporary password. Users should be instructed to change it immediately upon first login.
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Role Management:</strong> Only administrators can modify user roles and account status. Changes take effect immediately.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>System Users ({users.length})</CardTitle>
          <CardDescription>
            Manage existing users and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.firstName} {user.lastName}
                      {user.id === currentUser?.id && (
                        <span className="text-xs text-muted-foreground ml-2">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {formatDate(user.createdAt)}
                      </span>
                      {user.lastLogin && (
                        <span className="text-green-600">
                          Last login {formatDate(user.lastLogin, 'MMM dd, yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Role Badge/Editor */}
                  {editingUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 px-2 text-sm border border-input bg-background rounded-md"
                        defaultValue={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as 'admin' | 'user' | 'viewer')}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingUserId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Badge 
                      variant={getRoleBadgeVariant(user.role)}
                      className="flex items-center gap-1"
                    >
                      {getRoleIcon(user.role)}
                      <span className="capitalize">{user.role}</span>
                    </Badge>
                  )}

                  {/* Status */}
                  <Badge variant={user.isActive ? "secondary" : "destructive"}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingUserId(editingUserId === user.id ? null : user.id)}
                      disabled={user.id === currentUser?.id}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivateUser(user.id)}
                      disabled={user.id === currentUser?.id || !user.isActive}
                      className="text-destructive hover:text-destructive"
                    >
                      <UserX className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

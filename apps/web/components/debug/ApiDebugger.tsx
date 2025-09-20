'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export default function ApiDebugger() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        ...options,
        credentials: 'include', // Include cookies
      });
      
      const data = await response.json();
      
      setResults((prev: any) => ({
        ...prev,
        [endpoint]: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data,
          success: response.ok
        }
      }));
    } catch (error: any) {
      setResults((prev: any) => ({
        ...prev,
        [endpoint]: {
          error: error.message,
          success: false
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

  const tests = [
    {
      name: 'API Health Check',
      endpoint: `${baseURL}/api/health`,
      method: 'GET'
    },
    {
      name: 'CORS Test',
      endpoint: `${baseURL}/api/cors-test`,
      method: 'GET'
    },
    {
      name: 'Login Test (Invalid Creds)',
      endpoint: `${baseURL}/api/users/auth/login`,
      method: 'POST',
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'invalid'
        })
      }
    }
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>API Debug Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tests.map((test, index) => (
            <Button 
              key={index}
              onClick={() => testEndpoint(test.endpoint, test.options)}
              disabled={loading}
              variant="outline"
            >
              {test.name}
            </Button>
          ))}
        </div>
        
        <Button onClick={() => setResults({})} variant="secondary">
          Clear Results
        </Button>

        <div className="space-y-4">
          {Object.entries(results).map(([endpoint, result]: [string, any]) => (
            <div key={endpoint} className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">{endpoint}</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

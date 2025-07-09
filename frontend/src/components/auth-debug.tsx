import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface AuthDebugInfo {
  hasSession: boolean;
  sessionId: string;
  sessionStore: boolean;
  sessionUser: any;
  reqUser: any;
  cookies: string;
  userAgent: string;
  timestamp: string;
  environment: string;
}

interface AuthStatus {
  isAuthenticated: boolean;
  sessionExists: boolean;
  userInSession: boolean;
  userInRequest: boolean;
  userId: string | null;
  userEmail: string | null;
  userRole: string | null;
  sessionId: string;
  timestamp: string;
}

export default function AuthDebug() {
  const [debugInfo, setDebugInfo] = useState<AuthDebugInfo | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [sessionResponse, statusResponse] = await Promise.all([
        fetch('/api/debug/session'),
        fetch('/api/debug/auth-status')
      ]);

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setDebugInfo(sessionData);
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setAuthStatus(statusData);
      }
    } catch (err) {
      setError('Failed to fetch debug information');
      console.error('Debug fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugInfo();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (status: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? trueText : falseText}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Authentication Debug Panel
          </CardTitle>
          <CardDescription>
            Debug authentication issues and session status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={fetchDebugInfo} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Debug Info
            </Button>
          </div>

          {error && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {authStatus && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Authentication Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Authenticated:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(authStatus.isAuthenticated)}
                      {getStatusBadge(authStatus.isAuthenticated, "Yes", "No")}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Session Exists:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(authStatus.sessionExists)}
                      {getStatusBadge(authStatus.sessionExists, "Yes", "No")}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>User in Session:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(authStatus.userInSession)}
                      {getStatusBadge(authStatus.userInSession, "Yes", "No")}
                    </div>
                  </div>
                  
                  {authStatus.userEmail && (
                    <div className="pt-2 border-t">
                      <div className="text-sm text-gray-600">User: {authStatus.userEmail}</div>
                      <div className="text-sm text-gray-600">Role: {authStatus.userRole}</div>
                      <div className="text-sm text-gray-600">ID: {authStatus.userId}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {debugInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Session Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Session Store:</span>
                      {getStatusBadge(debugInfo.sessionStore, "PostgreSQL", "None")}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>Environment:</span>
                      <Badge variant="outline">{debugInfo.environment}</Badge>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div><strong>Session ID:</strong> {debugInfo.sessionId}</div>
                      <div><strong>Timestamp:</strong> {new Date(debugInfo.timestamp).toLocaleString()}</div>
                    </div>
                    
                    {debugInfo.cookies && (
                      <div className="pt-2 border-t">
                        <div className="text-sm">
                          <strong>Cookies:</strong>
                          <div className="text-xs text-gray-600 break-all">
                            {debugInfo.cookies}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {authStatus && !authStatus.isAuthenticated && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                User is not authenticated. Try logging in again or check if cookies are being blocked.
                <div className="mt-2">
                  <Button size="sm" onClick={() => window.location.href = "/api/login"}>
                    Go to Login Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
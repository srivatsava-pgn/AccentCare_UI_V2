import { authService } from "./authService";

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

class ApiClient {
  private baseURL =
    import.meta.env.VITE_API_BASE_URL ||
    "https://acc-icdbackend-dev.penguinai.co";

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const { method = "GET", headers = {}, body } = options;

    // Default headers
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      accept: "application/json",
      ...headers,
    };

    // Add Authorization header if token exists and not login endpoint
    const token = authService.getToken();
    if (token && !endpoint.includes("/login")) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: defaultHeaders,
        body,
      });

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401 && !endpoint.includes("/login")) {
        console.warn("Received 401 Unauthorized, clearing token");
        authService.clearToken();
        // Optionally trigger a logout event or redirect
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        throw new Error("Authentication expired. Please log in again.");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return {} as T;
      }
    } catch (error) {
      console.error(`API request failed for ${method} ${url}:`, error);
      throw error;
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", headers });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", headers });
  }

  // Timer API methods
  async getTime(documentId: string) {
    return this.get(`/get-time/${documentId}`);
  }

  async submitTime(documentId: string, timeSpent: string) {
    return this.post("/submit-time", {
      document_id: documentId,
      time_spent: timeSpent,
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Console message interception and forwarding to server
interface ConsoleMessage {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  url?: string;
  user_agent?: string;
  stack_trace?: string;
}

class ConsoleLogger {
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };

  private isEnabled = true;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };
  }

  /**
   * Initialize console interception
   */
  init(): void {
    this.interceptConsole();
    console.info(
      "[ConsoleLogger] Console message forwarding to server enabled",
    );
  }

  /**
   * Disable console forwarding (useful for debugging)
   */
  disable(): void {
    this.isEnabled = false;
    console.info("[ConsoleLogger] Console message forwarding disabled");
  }

  /**
   * Enable console forwarding
   */
  enable(): void {
    this.isEnabled = true;
    console.info("[ConsoleLogger] Console message forwarding enabled");
  }

  /**
   * Intercept all console methods and forward to server
   */
  private interceptConsole(): void {
    // Intercept console.log
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.forwardToServer("log", args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.forwardToServer("info", args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.forwardToServer("warn", args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.forwardToServer("error", args);
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.forwardToServer("debug", args);
    };

    // Intercept global error handler for unhandled errors
    window.addEventListener("error", (event) => {
      const errorMessage = `Uncaught ${event.error?.name || "Error"}: ${event.error?.message || event.message}`;
      const stackTrace =
        event.error?.stack ||
        `at ${event.filename}:${event.lineno}:${event.colno}`;

      this.forwardToServer("error", [errorMessage], stackTrace);
    });

    // Intercept unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const errorMessage = `Unhandled Promise Rejection: ${event.reason}`;
      const stackTrace = event.reason?.stack || "";

      this.forwardToServer("error", [errorMessage], stackTrace);
    });
  }

  /**
   * Format console arguments into a single message string
   */
  private formatMessage(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
  }

  /**
   * Forward console message to server
   */
  private async forwardToServer(
    level: ConsoleMessage["level"],
    args: any[],
    stackTrace?: string,
    retryCount = 0,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const message: ConsoleMessage = {
        level,
        message: this.formatMessage(args),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        user_agent: navigator.userAgent,
        stack_trace: stackTrace,
      };

      const response = await fetch("/api/console-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Optional: Log successful forwarding (only for debugging)
      // const result = await response.json();
    } catch (error) {
      // Retry logic for failed requests
      if (retryCount < this.maxRetries) {
        setTimeout(
          () => {
            this.forwardToServer(level, args, stackTrace, retryCount + 1);
          },
          this.retryDelay * Math.pow(2, retryCount),
        ); // Exponential backoff
      } else {
        // Use original console methods to avoid infinite recursion
        this.originalConsole.warn(
          "[ConsoleLogger] Failed to forward console message to server after retries:",
          error,
        );
      }
    }
  }

  /**
   * Restore original console methods (for cleanup)
   */
  restore(): void {
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    this.originalConsole.info("[ConsoleLogger] Console methods restored");
  }
}

// Global console logger instance
export const consoleLogger = new ConsoleLogger();

// Auto-initialize when module is imported
consoleLogger.init();
